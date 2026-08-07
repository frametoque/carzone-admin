"use server";

import sql from "@/lib/db";
import { promises as fs } from 'fs';
import path from 'path';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-carzone-jwt-token-key-change-me";

// --- Activity Logger ---
// Call this from any mutation action to log the activity.
// It auto-reads the user email from the session cookie and IP from headers.
export async function logActivity(action: string, extraInfo?: { os?: string; client?: string }) {
  try {
    // Get user email from session
    let userEmail = "System";
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("session");
      if (sessionCookie?.value) {
        const decoded: any = jwt.verify(sessionCookie.value, JWT_SECRET);
        userEmail = decoded.email || "System";
      }
    } catch {}

    // Get IP from request headers
    let ip = "Unknown";
    try {
      const hdrs = await headers();
      const forwarded = hdrs.get("x-forwarded-for");
      ip = forwarded ? forwarded.split(",")[0].trim() : hdrs.get("x-real-ip") || "Unknown";
    } catch {}

    await sql`
      INSERT INTO system_activity_logs (user_email, ip_address, action, os, client)
      VALUES (${userEmail}, ${ip}, ${action}, ${extraInfo?.os || null}, ${extraInfo?.client || null})
    `;

    // Periodically clean up logs older than 3 months (lightweight — runs inline)
    await sql`DELETE FROM system_activity_logs WHERE timestamp < NOW() - INTERVAL '3 months'`;
  } catch (err) {
    // Silently fail — logging should never block the main action
    console.error("Activity log failed:", err);
  }
}

export async function uploadReceipt(formData: FormData, type: 'income' | 'expenses'): Promise<string> {
  const file = formData.get('file') as File;
  if (!file) throw new Error("No file uploaded");

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const uploadDir = path.join(process.cwd(), 'public', 'admin', 'receipts', type);
  
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  
  return `/admin/receipts/${type}/${filename}`;
}

// -- DASHBOARD --
export async function getDashboardData(startDateString?: string, endDateString?: string) {
  const startLimit = startDateString ? new Date(startDateString) : new Date("1970-01-01");
  const endLimit = endDateString ? new Date(endDateString) : new Date("2099-12-31");
  endLimit.setHours(23, 59, 59, 999);

  // Cash flow chart date range
  const refDate = endDateString ? new Date(endDateString) : new Date();
  const startFlow = new Date(refDate.getFullYear(), refDate.getMonth() - 11, 1);
  const endFlow = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);

  // Run all independent queries in parallel for speed
  const [incomes, expenses, unpaid, compIncomes, compExpenses, flowIncomes, flowExpenses, recentInvoicesRaw, recentTransactionsRaw] = await Promise.all([
    sql`SELECT category, amount, date FROM admin_incomes WHERE date >= ${startLimit} AND date <= ${endLimit}`,
    sql`SELECT category, amount, date FROM admin_expenses WHERE date >= ${startLimit} AND date <= ${endLimit}`,
    sql`SELECT COUNT(*) as count FROM invoices WHERE payment_status = 'unpaid' AND date >= ${startLimit} AND date <= ${endLimit}`,
    sql`SELECT category, amount, date FROM admin_incomes`,
    sql`SELECT category, amount, date FROM admin_expenses`,
    sql`SELECT category, amount, date FROM admin_incomes WHERE date >= ${startFlow} AND date <= ${endFlow}`,
    sql`SELECT category, amount, date FROM admin_expenses WHERE date >= ${startFlow} AND date <= ${endFlow}`,
    sql`
      SELECT
        i.invoice_id as id,
        COALESCE(ac.full_name, i.user_email, 'Unknown Client') as client,
        i.total as amount,
        i.payment_status as status
      FROM invoices i
      LEFT JOIN admin_clients ac ON 
        (i.client_id IS NOT NULL AND i.client_id = ac.id) OR 
        (i.client_id IS NULL AND i.user_email IS NOT NULL AND LOWER(i.user_email) = LOWER(ac.email))
      WHERE i.date >= ${startLimit} AND i.date <= ${endLimit}
      ORDER BY i.created_at DESC
      LIMIT 4
    `,
    sql`
      SELECT id, 'income' as type, description as name, date, amount FROM admin_incomes WHERE date >= ${startLimit} AND date <= ${endLimit}
      UNION ALL
      SELECT id, 'expense' as type, description as name, date, amount FROM admin_expenses WHERE date >= ${startLimit} AND date <= ${endLimit}
      ORDER BY date DESC
      LIMIT 5
    `,
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;

  incomes.forEach((r: any) => {
    totalIncome += parseFloat(r.amount) || 0;
  });

  expenses.forEach((r: any) => {
    totalExpenses += parseFloat(r.amount) || 0;
  });

  const netProfit = totalIncome - totalExpenses;

  // 1. Calculate Previous (2025) vs Current (2026) Comparison
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  let currentIncome = 0;
  let currentExpenses = 0;

  let previousIncome = 0;
  let previousExpenses = 0;

  compIncomes.forEach((r: any) => {
    const entryDate = new Date(r.date);
    const amt = parseFloat(r.amount) || 0;
    const yr = entryDate.getFullYear();

    if (yr === currentYear) {
      currentIncome += amt;
    } else if (yr === previousYear) {
      previousIncome += amt;
    }
  });

  compExpenses.forEach((r: any) => {
    const entryDate = new Date(r.date);
    const amt = parseFloat(r.amount) || 0;
    const yr = entryDate.getFullYear();

    if (yr === currentYear) {
      currentExpenses += amt;
    } else if (yr === previousYear) {
      previousExpenses += amt;
    }
  });

  const netIncomeComparison = {
    previous: {
      income: previousIncome,
      expenses: previousExpenses,
      netIncome: previousIncome - previousExpenses
    },
    current: {
      income: currentIncome,
      expenses: currentExpenses,
      netIncome: currentIncome - currentExpenses
    }
  };

  // 2. Calculate Expense Breakdown for filtered date range
  const currentExpensesBreakdown: Record<string, number> = {};
  expenses.forEach((r: any) => {
    const cat = r.category || "Other";
    const amt = parseFloat(r.amount) || 0;
    currentExpensesBreakdown[cat] = (currentExpensesBreakdown[cat] || 0) + amt;
  });

  const expenseBreakdown = Object.entries(currentExpensesBreakdown).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  // 3. Cash Flow Bipolar Stacked Data (Last 12 Months relative to filtered end date)
  const last12MonthsMap: Record<string, { name: string, monthNum: number, income: number, expenses: number, negativeExpenses: number, netChange: number }> = {};
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    last12MonthsMap[key] = {
      name: label,
      monthNum: d.getMonth() + 1,
      income: 0,
      expenses: 0,
      negativeExpenses: 0,
      netChange: 0
    };
  }

  flowIncomes.forEach((r: any) => {
    const entryDate = new Date(r.date);
    const key = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
    if (last12MonthsMap[key]) {
      last12MonthsMap[key].income += parseFloat(r.amount) || 0;
    }
  });

  flowExpenses.forEach((r: any) => {
    const entryDate = new Date(r.date);
    const key = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
    if (last12MonthsMap[key]) {
      last12MonthsMap[key].expenses += parseFloat(r.amount) || 0;
    }
  });

  Object.values(last12MonthsMap).forEach(row => {
    row.negativeExpenses = -row.expenses;
    row.netChange = row.income - row.expenses;
  });

  const cashFlowData = Object.values(last12MonthsMap);

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    unpaidCount: parseInt(unpaid[0]?.count || '0'),
    chartData: cashFlowData,
    expenseBreakdown,
    netIncomeComparison,
    recentInvoices: recentInvoicesRaw.map(row => ({
      id: row.id,
      client: row.client,
      amount: parseFloat(row.amount),
      status: row.status,
    })),
    recentTransactions: recentTransactionsRaw.map((row, index) => ({
      id: index,
      type: row.type,
      name: row.name,
      date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(row.amount)
    }))
  };
}

function getCutoffDate(range: string) {
  const d = new Date();
  if (range === 'this year') return new Date(d.getFullYear(), 0, 1).toISOString();
  if (range === '6 months') { d.setMonth(d.getMonth() - 6); return d.toISOString(); }
  if (range === 'three months') { d.setMonth(d.getMonth() - 3); return d.toISOString(); }
  if (range === 'one month') { d.setMonth(d.getMonth() - 1); return d.toISOString(); }
  return new Date(0).toISOString();
}

function combineDateWithCurrentTime(inputDate: any): Date {
  if (!inputDate) return new Date();
  const dateObj = new Date(inputDate);
  if (isNaN(dateObj.getTime())) {
    return new Date();
  }
  const now = new Date();
  dateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return dateObj;
}

// -- INCOMES --
export async function getIncomes(range = 'lifetime') {
  const cutoff = getCutoffDate(range);
  const statsThisMonth = await sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date_trunc('month', date) = date_trunc('month', current_date)`;
  const statsLastMonth = await sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date_trunc('month', date) = date_trunc('month', current_date - interval '1 month')`;
  const statsYtd = await sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date_trunc('year', date) = date_trunc('year', current_date)`;

  const rows = await sql`
    SELECT i.id, i.date, i.amount, c.full_name as client, i.client_id as "clientId", i.description as desc, i.category, i.invoice_id as invoice, i.receipt_url as "receiptUrl", i.account_id as "accountId", a.name as "accountName"
    FROM admin_incomes i
    LEFT JOIN admin_clients c ON i.client_id = c.id
    LEFT JOIN accounts a ON i.account_id = a.id
    WHERE i.date >= ${cutoff}
    ORDER BY i.date DESC
  `;

  return {
    thisMonth: parseFloat(statsThisMonth[0]?.total || 0),
    lastMonth: parseFloat(statsLastMonth[0]?.total || 0),
    ytd: parseFloat(statsYtd[0]?.total || 0),
    items: rows.map(r => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(r.amount),
      accountId: r.accountId ? parseInt(r.accountId) : null
    }))
  };
}

export async function createIncome(data: any) {
  const result = await sql`
    INSERT INTO admin_incomes (date, amount, description, category, payment_method, invoice_id, client_id, receipt_url, account_id)
    VALUES (${data.date}, ${data.amount}, ${data.description}, ${data.category}, ${data.paymentMethod}, ${data.invoiceId || null}, ${data.clientId || null}, ${data.receiptUrl || null}, ${data.accountId || null})
    RETURNING id
  `;
  const newId = result[0]?.id ? parseInt(result[0].id) : null;
  if (newId && data.accountId) {
    await syncLedgerEntry('income', newId, data.date, data.amount, data.description, data.accountId);
  }
  await logActivity(`Created income: Recorded $${data.amount} for "${data.description || ''}"`);
}

export async function createClient(data: { name: string; email?: string | null; company?: string | null; phone?: string | null; address?: string | null; birthday?: string | null }): Promise<string> {
  const clientId = 'C-' + Date.now();
  await sql`
    INSERT INTO admin_clients (id, full_name, email, company, phone, address, birthday, active)
    VALUES (${clientId}, ${data.name}, ${data.email || null}, ${data.company || null}, ${data.phone || null}, ${data.address || null}, ${data.birthday || null}, true)
  `;
  await logActivity(`Created client: "${data.name} " (${data.email || 'no email'})`);
  return clientId;
}

export async function updateClient(clientId: string, data: { name?: string; email?: string | null; company?: string | null; phone?: string | null; address?: string | null; birthday?: string | null }) {
  // Fetch current email first so we can cascade if it changes
  const existing = await sql`SELECT email FROM admin_clients WHERE id = ${clientId}`;
  if (existing.length === 0) throw new Error("Client not found");
  const oldEmail = existing[0].email as string | null;
  const newEmail = data.email?.trim() || null;
  const emailChanged = oldEmail && newEmail && (newEmail.toLowerCase() !== oldEmail.toLowerCase());

  // Update admin_clients row
  await sql`
    UPDATE admin_clients
    SET 
      full_name = COALESCE(${data.name  || null}, full_name),
      email   = ${newEmail},
      company = ${data.company ?? null},
      phone   = ${data.phone   ?? null},
      address = ${data.address ?? null},
      birthday = ${data.birthday ?? null}
    WHERE id = ${clientId}
  `;

  // Cascade email change to every table that stores user_email
  if (emailChanged) {
    await sql`UPDATE invoices  SET user_email = ${newEmail} WHERE LOWER(user_email) = LOWER(${oldEmail})`;
  }
  await logActivity(`Updated client: "${data.name || clientId}"`);
}

export async function deleteClient(clientId: string) {
  await sql`DELETE FROM admin_clients WHERE id = ${clientId}`;
  await logActivity(`Deleted client: ${clientId}`);
}

export async function updateIncome(id: number, data: any) {
  await sql`
    UPDATE admin_incomes 
    SET date = ${data.date}, amount = ${data.amount}, description = ${data.description}, category = ${data.category}, payment_method = ${data.paymentMethod}, invoice_id = ${data.invoiceId || null}, client_id = ${data.clientId || null}, receipt_url = ${data.receiptUrl || null}, account_id = ${data.accountId || null}
    WHERE id = ${id}
  `;
  await syncLedgerEntry('income', id, data.date, data.amount, data.description, data.accountId || null);
  await logActivity(`Updated income ${id}: recorded $${data.amount} for "${data.description || ''}"`);
}

export async function deleteIncome(id: number) {
  const existing = await sql`SELECT account_id FROM admin_incomes WHERE id = ${id}`;
  const oldAccountId = existing[0]?.account_id ? parseInt(existing[0].account_id) : null;

  await sql`DELETE FROM admin_incomes WHERE id = ${id}`;

  if (oldAccountId) {
    await syncLedgerEntry('income', id, new Date(), 0, '', null);
  }
  await logActivity(`Deleted income record ${id}`);
}

// -- EXPENSES --
export async function getExpenses(range = 'lifetime') {
  const cutoff = getCutoffDate(range);
  const statsThisMonth = await sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date_trunc('month', date) = date_trunc('month', current_date)`;
  const statsLastMonth = await sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date_trunc('month', date) = date_trunc('month', current_date - interval '1 month')`;
  const statsYtd = await sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date_trunc('year', date) = date_trunc('year', current_date)`;

  const rows = await sql`
    SELECT e.id, e.date, e.amount, e.description as desc, e.category, e.payment_method as "paidVia", e.receipt_url as "receiptUrl", e.account_id as "accountId", a.name as "accountName"
    FROM admin_expenses e
    LEFT JOIN accounts a ON e.account_id = a.id
    WHERE e.date >= ${cutoff}
    ORDER BY e.date DESC
  `;

  return {
    thisMonth: parseFloat(statsThisMonth[0]?.total || 0),
    lastMonth: parseFloat(statsLastMonth[0]?.total || 0),
    ytd: parseFloat(statsYtd[0]?.total || 0),
    items: rows.map(r => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(r.amount),
      accountId: r.accountId ? parseInt(r.accountId) : null
    }))
  };
}

export async function createExpense(data: any) {
  const result = await sql`
    INSERT INTO admin_expenses (date, amount, description, category, payment_method, receipt_url, account_id)
    VALUES (${data.date}, ${data.amount}, ${data.description}, ${data.category}, ${data.paymentMethod}, ${data.receiptUrl || null}, ${data.accountId || null})
    RETURNING id
  `;
  const newId = result[0]?.id ? parseInt(result[0].id) : null;
  if (newId && data.accountId) {
    await syncLedgerEntry('expense', newId, data.date, data.amount, data.description, data.accountId);
  }
  await logActivity(`Created expense: Recorded $${data.amount} for "${data.description || ''}"`);
}

export async function updateExpense(id: number, data: any) {
  await sql`
    UPDATE admin_expenses 
    SET date = ${data.date}, amount = ${data.amount}, description = ${data.description}, category = ${data.category}, payment_method = ${data.paymentMethod}, receipt_url = ${data.receiptUrl || null}, account_id = ${data.accountId || null}
    WHERE id = ${id}
  `;
  await syncLedgerEntry('expense', id, data.date, data.amount, data.description, data.accountId || null);
  await logActivity(`Updated expense ${id}: recorded $${data.amount} for "${data.description || ''}"`);
}

export async function deleteExpense(id: number) {
  const existing = await sql`SELECT account_id FROM admin_expenses WHERE id = ${id}`;
  const oldAccountId = existing[0]?.account_id ? parseInt(existing[0].account_id) : null;

  await sql`DELETE FROM admin_expenses WHERE id = ${id}`;

  if (oldAccountId) {
    await syncLedgerEntry('expense', id, new Date(), 0, '', null);
  }
  await logActivity(`Deleted expense record ${id}`);
}

// -- INVOICES --
export async function getInvoices() {
  const totalIssuedCount = await sql`SELECT COUNT(*) as count FROM invoices`;
  const paidCount = await sql`SELECT COUNT(*) as count FROM invoices WHERE payment_status = 'paid'`;
  const pendingCount = await sql`SELECT COUNT(*) as count FROM invoices WHERE payment_status = 'unpaid'`;
  const overdueCount = await sql`SELECT COUNT(*) as count FROM invoices WHERE payment_status = 'overdue'`;

  const rows = await sql`
    SELECT
      i.invoice_id as id,
      i.user_email as client_email,
      i.client_id,
      COALESCE(ac.full_name, i.user_email, 'Unknown Client') as client,
      i.total as amount,
      i.total_due,
      i.date as due_date,
      i.payment_status as status
    FROM invoices i
    LEFT JOIN admin_clients ac ON 
      (i.client_id IS NOT NULL AND i.client_id = ac.id) OR 
      (i.client_id IS NULL AND i.user_email IS NOT NULL AND LOWER(i.user_email) = LOWER(ac.email))
    ORDER BY i.created_at DESC
  `;

  return {
    totalIssued: parseInt(totalIssuedCount[0]?.count || '0'),
    paid: parseInt(paidCount[0]?.count || '0'),
    pending: parseInt(pendingCount[0]?.count || '0'),
    overdue: parseInt(overdueCount[0]?.count || '0'),
    items: rows.map(r => ({
      id: r.id,
      client: r.client || 'Unknown',
      clientEmail: r.client_email,
      amount: parseFloat(r.amount),
      totalDue: parseFloat(r.total_due != null ? r.total_due : r.amount),
      due: r.due_date ? new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
      status: r.status,
      overdue: r.status === 'overdue' || (r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid')
    }))
  };
}

export async function deleteInvoice(id: string) {
  await sql`
    UPDATE admin_quotations
    SET linked_invoice_id = NULL,
        status = 'draft'
    WHERE linked_invoice_id = ${id}
  `;
  await sql`DELETE FROM invoices WHERE invoice_id = ${id}`;
  await logActivity(`Deleted invoice: ${id}`);
}

export async function recordInvoicePayment(invoiceId: string, paidAmount: number, accountId: number, paymentDateString?: string) {
  try {
    const result = await sql`
      SELECT
        i.invoice_id,
        i.user_email,
        i.date,
        i.currency,
        i.category,
        i.subtotal,
        i.discount,
        i.total,
        i.advance,
        i.total_due,
        i.payment_status
      FROM invoices i
      WHERE i.invoice_id = ${invoiceId}
    `;

    if (result.length === 0) throw new Error("Invoice not found");
    const invoice = result[0];

    const currentTotalDue = parseFloat(invoice.total_due != null ? invoice.total_due : invoice.total);
    const fullAmount = parseFloat(invoice.total || 0);

    // If entered amount equals the full invoice amount OR the remaining total_due, it is fully paid
    const isFullPayment = Math.abs(paidAmount - currentTotalDue) < 0.01 || Math.abs(paidAmount - fullAmount) < 0.01;
    const newStatus = isFullPayment ? 'paid' : 'partially-paid';
    const newTotalDue = Math.max(0, currentTotalDue - paidAmount);

    // Update invoice payment status and total_due
    await sql`
      UPDATE invoices
      SET payment_status = ${newStatus},
          total_due = ${newTotalDue}
      WHERE invoice_id = ${invoiceId}
    `;

    // Find client_id
    let clientId = null;
    if (invoice.user_email) {
      const clientRows = await sql`SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${invoice.user_email})`;
      clientId = clientRows[0]?.id || null;
    }

    // Create income entry
    const paymentDate = paymentDateString || new Date().toISOString().split('T')[0];
    const incomeResult = await sql`
      INSERT INTO admin_incomes (date, amount, description, category, payment_method, invoice_id, client_id, receipt_url, account_id)
      VALUES (${paymentDate}, ${paidAmount}, ${`Payment for Invoice #${invoiceId}`}, ${invoice.category || 'Spare Parts'}, 'Bank Transfer', ${invoiceId}, ${clientId}, null, ${accountId})
      RETURNING id
    `;

    const newId = incomeResult[0]?.id ? parseInt(incomeResult[0].id) : null;
    if (newId && accountId) {
      await syncLedgerEntry('income', newId, paymentDate, paidAmount, `Payment for Invoice #${invoiceId}`, accountId);
    }

    await logActivity(`Recorded payment of $${paidAmount} via Bank Transfer for invoice ${invoiceId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to record invoice payment:", error);
    throw new Error(error?.message || "Failed to record invoice payment");
  }
}

export async function getInvoiceByIdAdmin(invoiceId: string) {
  // Join with admin_clients and bank_accs to get client name + billing address + bank account
  const result = await sql`
    SELECT
      i.id,
      i.invoice_id,
      i.user_email,
      i.client_id,
      i.date,
      i.currency,
      i.category,
      i.subtotal,
      i.discount,
      i.total,
      i.advance,
      i.total_due,
      i.payment_status,
      COALESCE(ac.full_name, i.user_email, 'Unknown Client') as client_name,
      ac.address as billing_address
    FROM invoices i
    LEFT JOIN admin_clients ac ON 
      (i.client_id IS NOT NULL AND i.client_id = ac.id) OR 
      (i.client_id IS NULL AND i.user_email IS NOT NULL AND LOWER(i.user_email) = LOWER(ac.email))
    WHERE i.invoice_id = ${invoiceId}
  `;

  if (result.length === 0) return null;
  const invoice = result[0];

  const itemsResult = await sql`
    SELECT description, price, total, quantity 
    FROM invoice_items 
    WHERE invoice_id = ${invoiceId} OR invoice_id = ${String(invoice.id)}
    ORDER BY id ASC
  `;

  const paymentsResult = await sql`
    SELECT 
      ai.id, 
      ai.date, 
      ai.amount, 
      ai.description, 
      ai.payment_method,
      a.name as account_name
    FROM admin_incomes ai
    LEFT JOIN accounts a ON ai.account_id = a.id
    WHERE ai.invoice_id = ${invoiceId}
    ORDER BY ai.date DESC, ai.id DESC
  `;

  invoice.items = itemsResult;
  invoice.payments = paymentsResult.map((p: any) => ({
    id: p.id,
    date: p.date,
    amount: parseFloat(p.amount),
    description: p.description,
    paymentMethod: p.payment_method,
    accountName: p.account_name || "N/A"
  }));

  return invoice;
}

// -- CLIENTS --
export async function getClients() {
  const rows = await sql`
    SELECT c.id,
           c.full_name as name,
           c.email,
           c.active,
           c.company,
           c.phone,
           c.address,
           c.birthday,
           c.clerk_id,
           (SELECT COUNT(*) FROM invoices i WHERE LOWER(i.user_email) = LOWER(c.email)) as invoices,
           COALESCE((SELECT SUM(amount) FROM admin_incomes inc WHERE inc.client_id = c.id), 0) as revenue,
           (SELECT COUNT(*) FROM admin_incomes inc WHERE inc.client_id = c.id) as income_count
    FROM admin_clients c
    ORDER BY c.id DESC
  `;

  const clients = rows.map(r => ({
    id: r.id,
    name: r.name || r.email.split('@')[0],
    email: r.email,
    active: r.active,
    company: r.company,
    phone: r.phone,
    address: r.address,
    birthday: r.birthday,
    imageUrl: null,
    invoices: parseInt(r.invoices),
    revenue: parseFloat(r.revenue),
    incomeCount: parseInt(r.income_count),
    projectCount: 0,
  }));

  return clients;
}

export async function getTodayBirthdays() {
  const allClients = await sql`
    SELECT id, full_name as name, email, phone, birthday
    FROM admin_clients
    WHERE birthday IS NOT NULL AND birthday != ''
  `;

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate(); // 1-31

  const todayBirthdays = allClients.filter(c => {
    if (!c.birthday) return false;
    const parts = c.birthday.split('-');
    if (parts.length < 3) return false;
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return month === currentMonth && day === currentDay;
  });

  return todayBirthdays.map(c => ({
    id: c.id,
    name: c.name || c.email?.split('@')[0] || 'Client',
    phone: c.phone,
    email: c.email,
    birthday: c.birthday
  }));
}


export async function getClientById(clientId: string) {
  const rows = await sql`
    SELECT c.id,
           c.full_name as name,
           c.email,
           c.active,
           c.company,
           c.phone,
           c.address,
           c.birthday,
           c.clerk_id,
           c.website
    FROM admin_clients c
    WHERE c.id = ${clientId}
  `;

  if (rows.length === 0) return null;
  const c = rows[0];

  let imageUrl = null;

  const invoices = await sql`
    SELECT invoice_id as id, total as amount, date as due_date, payment_status as status
    FROM invoices
    WHERE LOWER(user_email) = LOWER(${c.email})
    ORDER BY date DESC
  `;

  // Also fetch manual income entries linked to this client
  const incomes = await sql`
    SELECT id, description as service, amount, date, category, invoice_id
    FROM admin_incomes
    WHERE client_id = ${clientId}
    ORDER BY date DESC
  `;

  // Build unified orders list — skip income rows already represented by a linked invoice
  const invoiceIds = new Set(invoices.map((r: any) => r.id));

  const invoiceOrders = invoices.map((r: any) => ({
    id: r.id,
    type: 'invoice',
    amount: parseFloat(r.amount),
    date: r.due_date ? new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
    status: r.status,
    overdue: r.status === 'overdue' || (r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid'),
    rawDate: r.due_date ? new Date(r.due_date) : new Date(0),
  }));

  const incomeOrders = incomes
    .filter((r: any) => !r.invoice_id || !invoiceIds.has(r.invoice_id))
    .map((r: any) => ({
      id: `INC-${r.id}`,
      type: 'income',
      amount: parseFloat(r.amount),
      date: r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
      status: 'paid', // manual incomes are already received
      overdue: false,
      rawDate: r.date ? new Date(r.date) : new Date(0),
    }));

  const orders = [...invoiceOrders, ...incomeOrders]
    .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return {
    id: c.id,
    name: c.name || c.email.split('@')[0],
    email: c.email,
    active: c.active,
    company: c.company,
    phone: c.phone,
    address: c.address,
    website: c.website,
    imageUrl,
    orders,
    invoices: invoiceOrders, // kept for backward compatibility
  };
}

async function generateNextInvoiceId(): Promise<string> {
  const existingInvoices = await sql`SELECT invoice_id FROM invoices`;
  const numbers = new Set<number>();
  for (const row of existingInvoices) {
    const invoiceId = row.invoice_id || row.field_0 || row.id;
    if (typeof invoiceId === 'string') {
      const match = invoiceId.match(/^INV-(\d+)$/i);
      if (match) {
        numbers.add(parseInt(match[1], 10));
      }
    }
  }

  let nextNum = 1;
  while (numbers.has(nextNum)) {
    nextNum++;
  }

  if (nextNum <= 9999) {
    return `INV-${String(nextNum).padStart(4, '0')}`;
  }
  return `INV-${nextNum}`;
}

export async function createInvoice(invoiceData: any, lineItems: any[]) {
  const email = invoiceData.userEmail?.trim() || null;
  const clientName = invoiceData.clientName?.trim() || null;
  const company = invoiceData.company?.trim() || null;
  const phone = invoiceData.phone?.trim() || null;
  const billingAddress = invoiceData.billingAddress?.trim() || null;
  const date = invoiceData.date || new Date().toISOString().split("T")[0];
  const subtotal = parseFloat(invoiceData.subtotal) || 0;
  const discount = parseFloat(invoiceData.discount) || 0;
  const total = parseFloat(invoiceData.total) || 0;
  const advance = parseFloat(invoiceData.advance) || 0;
  const totalDue = parseFloat(invoiceData.totalDue) || 0;
  const paymentStatus = invoiceData.paymentStatus || "unpaid";
  const currency = invoiceData.currency || "LKR";
  const category = invoiceData.category?.trim() || null;

  // Upsert client
  let existingClient: any[] = [];
  if (invoiceData.clientId && invoiceData.clientId !== "new") {
    existingClient = await sql`SELECT id FROM admin_clients WHERE id = ${invoiceData.clientId}`;
  } else if (email) {
    existingClient = await sql`SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${email})`;
  }
  
  let resolvedClientId: string | null = null;
  if (invoiceData.clientId && invoiceData.clientId !== "new") {
    resolvedClientId = invoiceData.clientId;
  } else if (existingClient.length > 0) {
    resolvedClientId = existingClient[0].id;
  }
  
  if (existingClient.length === 0 && (clientName || email)) {
    const clientId = resolvedClientId || 'C-' + Date.now();
    await sql`
      INSERT INTO admin_clients (id, full_name, company, email, phone, address, active)
      VALUES (
        ${clientId},
        ${clientName || (email ? email.split('@')[0] : 'Client')},
        ${company},
        ${email},
        ${phone},
        ${billingAddress},
        true
      )
    `;
    resolvedClientId = clientId;
  } else if (existingClient.length > 0) {
    // Update name/address on existing client whenever new values were entered
    await sql`
      UPDATE admin_clients
      SET 
        full_name = COALESCE(${clientName}, full_name),
        address = COALESCE(${billingAddress}, address)
      WHERE id = ${existingClient[0].id}
    `;
  }

  const invoiceId = await generateNextInvoiceId();
  await sql`
    INSERT INTO invoices (
      invoice_id, user_email, date, 
      subtotal, discount, total, advance, total_due, 
      payment_status, currency, category, client_id
    ) VALUES (
      ${invoiceId}, ${email}, ${date},
      ${subtotal}, ${discount}, ${total}, ${advance}, ${totalDue},
      ${paymentStatus}, ${currency}, ${category}, ${resolvedClientId}
    )
  `;

  for (const item of lineItems) {
    if (item.description) {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const itemTotal = quantity * rate;
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, price, total)
        VALUES (${invoiceId}, ${item.description}, ${quantity}, ${rate}, ${itemTotal})
      `;
    }
  }

  await logActivity(`Created invoice: "${category || 'Invoice'}" (${invoiceId}) for $${total}`);
  return { success: true, invoiceId };
}

export async function updateInvoice(invoiceId: string, invoiceData: any, lineItems: any[]) {
  const email = invoiceData.userEmail?.trim() || null;
  const date = invoiceData.date || new Date().toISOString().split("T")[0];
  const subtotal = parseFloat(invoiceData.subtotal) || 0;
  const discount = parseFloat(invoiceData.discount) || 0;
  const total = parseFloat(invoiceData.total) || 0;
  const advance = parseFloat(invoiceData.advance) || 0;
  const totalDue = parseFloat(invoiceData.totalDue) || 0;
  const paymentStatus = invoiceData.paymentStatus || "unpaid";
  const currency = invoiceData.currency || "LKR";
  const category = invoiceData.category?.trim() || null;
  const billingAddress = invoiceData.billingAddress?.trim() || null;

  // Resolve clientId
  let resolvedClientId: string | null = null;
  if (invoiceData.clientId && invoiceData.clientId !== "new") {
    resolvedClientId = invoiceData.clientId;
  } else if (email) {
    const existing = await sql`SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${email})`;
    if (existing.length > 0) {
      resolvedClientId = existing[0].id;
    }
  }

  // If a billing address was edited, persist it back to admin_clients
  if (billingAddress && resolvedClientId) {
    await sql`
      UPDATE admin_clients
      SET address = ${billingAddress}
      WHERE id = ${resolvedClientId}
    `;
  } else if (billingAddress && email) {
    await sql`
      UPDATE admin_clients
      SET address = ${billingAddress}
      WHERE LOWER(email) = LOWER(${email})
    `;
  }

  await sql`
    UPDATE invoices SET
      user_email = ${email},
      client_id = ${resolvedClientId},
      date = ${date},
      subtotal = ${subtotal},
      discount = ${discount},
      total = ${total},
      advance = ${advance},
      total_due = ${totalDue},
      payment_status = ${paymentStatus},
      currency = ${currency},
      category = ${category}
    WHERE invoice_id = ${invoiceId}
  `;

  await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}`;

  for (const item of lineItems) {
    if (item.description) {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const itemTotal = quantity * rate;
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, price, total)
        VALUES (${invoiceId}, ${item.description}, ${quantity}, ${rate}, ${itemTotal})
      `;
    }
  }

  await logActivity(`Updated invoice: (${invoiceId}) for $${total}`);
  return { success: true };
}

// -- REPORTS --
export async function getReports(range = 'lifetime') {
  const cutoff = getCutoffDate(range);
  const incomeStats = await sql`SELECT SUM(amount) as total FROM admin_incomes WHERE date >= ${cutoff}`;
  const expenseStats = await sql`SELECT SUM(amount) as total FROM admin_expenses WHERE date >= ${cutoff}`;
  
  const annualRevenue = parseFloat(incomeStats[0]?.total || 0);
  const annualExpenses = parseFloat(expenseStats[0]?.total || 0);
  const netProfit = annualRevenue - annualExpenses;
  const profitMargin = annualRevenue > 0 ? ((netProfit / annualRevenue) * 100).toFixed(1) : '0.0';

  const rawIncome = await sql`
    SELECT category, amount
    FROM admin_incomes
    WHERE date >= ${cutoff}
  `;

  const serviceMap: Record<string, number> = {};
  for (const row of rawIncome) {
    const services = (row.category || 'Other')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    for (const service of services) {
      serviceMap[service] = (serviceMap[service] || 0) + parseFloat(row.amount);
    }
  }
  const incomeByService = Object.entries(serviceMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const expensesBreakdown = await sql`
    SELECT category as name, SUM(amount) as value
    FROM admin_expenses
    WHERE date >= ${cutoff}
    GROUP BY category
    ORDER BY value DESC
  `;

  // Fetch chronological journal entries
  const incomes = await sql`
    SELECT id, date, description, category, amount
    FROM admin_incomes
    WHERE date >= ${cutoff}
  `;
  
  const expenses = await sql`
    SELECT id, date, description, category, amount
    FROM admin_expenses
    WHERE date >= ${cutoff}
  `;
  
  const journalEntries = [
    ...incomes.map(i => ({
      id: `inc-${i.id}`,
      date: i.date,
      type: 'income',
      description: i.description || 'Sale/Invoice payment',
      category: i.category || 'Other',
      amount: parseFloat(i.amount)
    })),
    ...expenses.map(e => ({
      id: `exp-${e.id}`,
      date: e.date,
      type: 'expense',
      description: e.description || 'Business expense',
      category: e.category || 'Other',
      amount: parseFloat(e.amount)
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const accounts = await sql`
    SELECT id, name, type, current_balance as "currentBalance"
    FROM accounts
    ORDER BY name ASC
  `;

  return {
    annualRevenue,
    annualExpenses,
    netProfit,
    profitMargin,
    incomeByService,
    expensesBreakdown: expensesBreakdown.map(r => ({ name: r.name || 'Other', value: parseFloat(r.value) })),
    journalEntries,
    accounts: accounts.map(a => ({
      id: parseInt(a.id),
      name: a.name,
      type: a.type,
      currentBalance: parseFloat(a.currentBalance || 0)
    }))
  };
}

// -- QUOTATIONS --
export async function getQuotations(range = 'lifetime') {
  const cutoff = getCutoffDate(range);
  
  const rows = await sql`
    SELECT q.id, q.date, q.amount, q.advance, q.total_due as "totalDue",
           c.full_name as client, q.client_id as "clientId", q.description as desc, q.category,
           q.invoice_id as invoice, q.receipt_url as "receiptUrl", q.status
    FROM admin_quotations q
    LEFT JOIN admin_clients c ON q.client_id = c.id
    WHERE q.date >= ${cutoff}
    ORDER BY q.date DESC
  `;
 
  const confirmedCount = rows.filter((r: any) => r.status === 'confirmed').length;
  const totalValue = rows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);
 
  return {
    confirmedCount,
    totalValue,
    items: rows.map(r => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: parseFloat(r.amount),
      advance: parseFloat(r.advance || 0),
      totalDue: parseFloat(r.totalDue || r.amount),
      paymentMethod: 'Bank Transfer'
    }))
  };
}
 
// ─── REPLACE createQuotation in actions.ts ───────────────────────────────────
export async function createQuotation(data: any, lineItems: any[] = []) {
  const advance = data.advance || 0;
  const discount = data.discount || 0;
  const totalDue = data.totalDue ?? (data.amount - advance);

  if (data.clientId && data.billingAddress) {
    await sql`
      UPDATE admin_clients
      SET address = ${data.billingAddress}
      WHERE id = ${data.clientId} AND (address IS NULL OR address = '')
    `;
  }

  const result = await sql`
    INSERT INTO admin_quotations (
      date, amount, advance, total_due, discount,
      description, category, payment_method, invoice_id, client_id, receipt_url, status
    )
    VALUES (
      ${data.date}, ${data.amount}, ${advance}, ${totalDue}, ${discount},
      ${data.description}, ${data.category}, ${data.paymentMethod},
      ${data.invoiceId || null}, ${data.clientId || null}, ${data.receiptUrl || null}, 'draft'
    )
    RETURNING id
  `;

  const quotationId = result[0].id;

  for (const item of lineItems) {
    if (item.description) {
      await sql`
        INSERT INTO quotation_items (quotation_id, description, quantity, price, total)
        VALUES (${quotationId}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.quantity * item.rate})
      `;
    }
  }
  await logActivity(`Created quotation #${quotationId} for $${data.amount}`);
}

// ─── REPLACE updateQuotation in actions.ts ───────────────────────────────────
export async function updateQuotation(id: number, data: any, lineItems: any[] = []) {
  try {
    const advance = data.advance || 0;
    const discount = data.discount || 0;
    const totalDue = data.totalDue ?? (data.amount - advance);

    if (data.clientId && data.billingAddress) {
      await sql`
        UPDATE admin_clients
        SET address = ${data.billingAddress}
        WHERE id = ${data.clientId}
      `;
    }

    await sql`
      UPDATE admin_quotations 
      SET 
        date          = ${data.date}, 
        amount        = ${data.amount},
        advance       = ${advance},
        total_due     = ${totalDue},
        discount      = ${discount},
        description   = ${data.description}, 
        category      = ${data.category}, 
        payment_method= ${data.paymentMethod}, 
        invoice_id    = ${data.invoiceId || null}, 
        receipt_url   = ${data.receiptUrl || null}
      WHERE id = ${id} AND status != 'confirmed'
    `;

    await sql`DELETE FROM quotation_items WHERE quotation_id = ${id}`;

    for (const item of lineItems) {
      if (item.description) {
        await sql`
          INSERT INTO quotation_items (quotation_id, description, quantity, price, total)
          VALUES (${id}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.quantity * item.rate})
        `;
      }
    }
  } catch (e) {
    console.error("Failed to update quotation:", e);
    throw new Error("Failed to update quotation");
  }
}
 
export async function deleteQuotation(id: number) {
  const q = await sql`SELECT linked_invoice_id FROM admin_quotations WHERE id = ${id}`;
  const linkedInvoiceId = q[0]?.linked_invoice_id;

  if (linkedInvoiceId) {
    await sql`UPDATE admin_quotations SET linked_invoice_id = NULL WHERE id = ${id}`;
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${linkedInvoiceId}`;
    await sql`DELETE FROM invoices WHERE invoice_id = ${linkedInvoiceId}`;
  }

  await sql`DELETE FROM admin_quotations WHERE id = ${id}`;
  await logActivity(`Deleted quotation #${id}`);
}
 
export async function confirmQuotation(quotationId: number, quotationData: any) {
  const quotation = await sql`
    SELECT q.*, c.id as client_id_val, c.email, c.full_name as client_name, c.company, c.address as billing_address
    FROM admin_quotations q
    LEFT JOIN admin_clients c ON q.client_id = c.id
    WHERE q.id = ${quotationId}
  `;

  if (quotation.length === 0) throw new Error(`Quotation #${quotationId} not found`);

  const q = quotation[0];

  if (q.status === 'confirmed') {
    throw new Error("Quotation is already confirmed");
  }

  const userEmail = q.email || null;
  const amount   = parseFloat(q.amount   || 0);
  const advance  = parseFloat(q.advance  || 0);
  const totalDue = parseFloat(q.total_due != null ? q.total_due : amount - advance);
  const description = q.description || 'Project';

  // Resolve or create client
  let resolvedClientId: string | null = q.client_id_val || null;
  if (!resolvedClientId && userEmail) {
    const existingClient = await sql`SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${userEmail})`;
    if (existingClient.length === 0) {
      const clientId = 'C-' + Date.now();
      await sql`
        INSERT INTO admin_clients (id, full_name, company, email, phone, address, active)
        VALUES (
          ${clientId},
          ${q.client_name || userEmail.split('@')[0]},
          ${q.company || null},
          ${userEmail},
          null,
          ${q.billing_address || null},
          true
        )
      `;
      resolvedClientId = clientId;
    } else {
      resolvedClientId = existingClient[0].id;
    }
  }

  const invoiceId = await generateNextInvoiceId();

  try {
    // Create invoice
    await sql`
      INSERT INTO invoices (
        invoice_id, user_email, date,
        subtotal, discount, total, advance, total_due,
        payment_status, currency, category, client_id
      ) VALUES (
        ${invoiceId},
        ${userEmail},
        ${q.date},
        ${amount},
        ${q.discount || 0},
        ${amount},
        ${advance},
        ${totalDue},
        'unpaid',
        'LKR',
        ${q.category || 'Spare Parts'},
        ${resolvedClientId}
      )
    `;

    const qItems = await sql`
      SELECT description, quantity, price, total FROM quotation_items WHERE quotation_id = ${quotationId}
    `;

    if (qItems.length > 0) {
      for (const item of qItems) {
        await sql`
          INSERT INTO invoice_items (invoice_id, description, quantity, price, total)
          VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.price}, ${item.total})
        `;
      }
    } else {
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, price, total)
        VALUES (${invoiceId}, ${description}, 1, ${amount}, ${amount})
      `;
    }

    await sql`
      UPDATE admin_quotations
      SET status = 'confirmed', linked_invoice_id = ${invoiceId}
      WHERE id = ${quotationId}
    `;

    return { success: true, invoiceId };

  } catch (e: any) {
    console.error("confirmQuotation DB error:", e);
    throw new Error(e?.message ?? "Failed to confirm quotation and create invoice");
  }
}

export async function getQuotationById(quotationId: string) {
  try {
    const quotation = await sql`
      SELECT q.*,
             c.full_name as client_name, c.email, c.company, c.phone,
             c.address as billing_address
      FROM admin_quotations q
      LEFT JOIN admin_clients c ON q.client_id = c.id
      WHERE q.id = ${parseInt(quotationId)}
    `;
 
    if (quotation.length === 0) return null;
 
    const q = quotation[0];

    const itemRows = await sql`
      SELECT id, description, quantity, price, total
      FROM quotation_items
      WHERE quotation_id = ${parseInt(quotationId)}
      ORDER BY id ASC
    `;
 
    return {
      id: q.id,
      date: q.date,
      amount: parseFloat(q.amount),
      advance: parseFloat(q.advance || 0),
      total_due: parseFloat(q.total_due || q.amount),
      billing_address: q.billing_address || '',
      client_name: q.client_name || q.email?.split('@')[0] || '',
      email: q.email,
      company: q.company,
      phone: q.phone,
      description: q.description,
      category: q.category,
      payment_method: q.payment_method,
      invoice_id: q.invoice_id,
      receipt_url: q.receipt_url,
      status: q.status,
      created_at: q.created_at,
      updated_at: q.updated_at,
      discount: q.discount || 0,
      items: itemRows.map((i: any) => ({
        id: i.id,
        description: i.description,
        quantity: parseInt(i.quantity),
        rate: parseFloat(i.price),
        total: parseFloat(i.total),
      }))
    };
  } catch (e) {
    console.error("Failed to fetch quotation by ID:", e);
    throw new Error("Failed to fetch quotation");
  }
}
// -- LEDGER & ACCOUNTS HELPERS --

export async function recalculateLedger(accountId: number) {
  const acc = await sql`SELECT initial_balance FROM accounts WHERE id = ${accountId}`;
  if (acc.length === 0) return;

  const entries = await sql`
    SELECT id, debit, credit 
    FROM ledger_entries 
    WHERE account_id = ${accountId} 
    ORDER BY date ASC, id ASC
  `;

  let current = 0;
  for (const entry of entries) {
    current = current + parseFloat(entry.debit) - parseFloat(entry.credit);
    await sql`UPDATE ledger_entries SET running_balance = ${current} WHERE id = ${entry.id}`;
  }

  await sql`UPDATE accounts SET current_balance = ${current} WHERE id = ${accountId}`;
}

export async function syncLedgerEntry(
  refType: 'income' | 'expense',
  refId: number | string,
  date: any,
  amount: number,
  description: string,
  accountId: number | null
) {
  const strRefId = String(refId);

  // Find if there was an existing ledger entry
  const existing = await sql`
    SELECT account_id FROM ledger_entries 
    WHERE reference_type = ${refType} AND reference_id = ${strRefId}
  `;
  const oldAccountId = existing[0]?.account_id ? parseInt(existing[0].account_id) : null;

  // Delete existing entry
  await sql`
    DELETE FROM ledger_entries 
    WHERE reference_type = ${refType} AND reference_id = ${strRefId}
  `;

  // Insert new entry if accountId is provided
  if (accountId) {
    const debit = refType === 'income' ? amount : 0;
    const credit = refType === 'expense' ? amount : 0;
    const typeVal = debit > 0 ? 'Debit' : (credit > 0 ? 'Credit' : 'Credit');
    const entryDate = combineDateWithCurrentTime(date);
    await sql`
      INSERT INTO ledger_entries (account_id, date, description, type, debit, credit, running_balance, reference_type, reference_id)
      VALUES (${accountId}, ${entryDate}, ${description}, ${typeVal}, ${debit}, ${credit}, 0, ${refType}, ${strRefId})
    `;
  }

  // Recalculate affected accounts
  if (accountId) {
    await recalculateLedger(accountId);
  }
  if (oldAccountId && oldAccountId !== accountId) {
    await recalculateLedger(oldAccountId);
  }
}

// -- ACCOUNTS ACTIONS --

export async function getAccounts() {
  const rows = await sql`
    SELECT 
      a.id, 
      a.name, 
      a.type, 
      a.bank_name as "bankName", 
      a.account_number as "accountNumber", 
      a.branch, 
      a.initial_balance as "initialBalance", 
      a.current_balance as "currentBalance",
      COALESCE(SUM(le.debit), 0) as "totalInflow",
      COALESCE(SUM(le.credit), 0) as "totalOutflow"
    FROM accounts a
    LEFT JOIN ledger_entries le ON a.id = le.account_id
    GROUP BY a.id
    ORDER BY a.type DESC, a.name ASC
  `;
  return rows.map(r => ({
    ...r,
    id: parseInt(r.id),
    type: (r.type || "").toLowerCase(),
    initialBalance: parseFloat(r.initialBalance),
    currentBalance: parseFloat(r.currentBalance),
    totalInflow: parseFloat(r.totalInflow),
    totalOutflow: parseFloat(r.totalOutflow)
  }));
}

export async function createAccount(data: any) {
  const result = await sql`
    INSERT INTO accounts (name, type, bank_name, account_number, branch, initial_balance, current_balance)
    VALUES (${data.name}, ${data.type}, ${data.bankName || null}, ${data.accountNumber || null}, ${data.branch || null}, ${data.initialBalance || 0}, ${data.initialBalance || 0})
    RETURNING id
  `;
  const newId = parseInt(result[0].id);

  if (parseFloat(data.initialBalance) !== 0) {
    const amt = parseFloat(data.initialBalance);
    const debit = amt > 0 ? amt : 0;
    const credit = amt < 0 ? -amt : 0;
    const typeVal = debit > 0 ? 'Debit' : 'Credit';
    await sql`
      INSERT INTO ledger_entries (account_id, date, description, type, debit, credit, running_balance, reference_type, reference_id)
      VALUES (${newId}, '2000-01-01'::date, 'Initial Balance', ${typeVal}, ${debit}, ${credit}, ${amt}, 'initial', ${String(newId)})
    `;
    await recalculateLedger(newId);
  }
  await logActivity(`Created account: "${data.name}"`);
  return newId;
}

export async function updateAccount(id: number, data: any) {
  await sql`
    UPDATE accounts
    SET 
      name = ${data.name}, 
      type = ${data.type}, 
      bank_name = ${data.bankName || null}, 
      account_number = ${data.accountNumber || null}, 
      branch = ${data.branch || null}, 
      initial_balance = ${data.initialBalance || 0}
    WHERE id = ${id}
  `;

  // Update initial balance entry if exists, or create if not
  const existingInitial = await sql`
    SELECT id FROM ledger_entries 
    WHERE account_id = ${id} AND reference_type = 'initial'
  `;

  const amt = parseFloat(data.initialBalance || 0);
  if (existingInitial.length > 0) {
    if (amt === 0) {
      await sql`DELETE FROM ledger_entries WHERE id = ${existingInitial[0].id}`;
    } else {
      const debit = amt > 0 ? amt : 0;
      const credit = amt < 0 ? -amt : 0;
      const typeVal = debit > 0 ? 'Debit' : 'Credit';
      await sql`
        UPDATE ledger_entries 
        SET debit = ${debit}, credit = ${credit}, type = ${typeVal} 
        WHERE id = ${existingInitial[0].id}
      `;
    }
  } else if (amt !== 0) {
    const debit = amt > 0 ? amt : 0;
    const credit = amt < 0 ? -amt : 0;
    const typeVal = debit > 0 ? 'Debit' : 'Credit';
    await sql`
      INSERT INTO ledger_entries (account_id, date, description, type, debit, credit, running_balance, reference_type, reference_id)
      VALUES (${id}, '2000-01-01'::date, 'Initial Balance', ${typeVal}, ${debit}, ${credit}, ${amt}, 'initial', ${String(id)})
    `;
  }

  await recalculateLedger(id);
}

export async function deleteAccount(id: number) {
  await sql`DELETE FROM accounts WHERE id = ${id}`;
  await logActivity(`Deleted account ${id}`);
}

export async function getAccountLedger(accountId: number, range = 'lifetime') {
  const cutoff = getCutoffDate(range);
  const rows = await sql`
    SELECT id, date, description, debit, credit, running_balance as "runningBalance", reference_type as "refType", reference_id as "refId"
    FROM ledger_entries
    WHERE account_id = ${accountId} AND date >= ${cutoff}
    ORDER BY date DESC, id DESC
  `;
  return rows.map(r => ({
    ...r,
    id: parseInt(r.id),
    debit: parseFloat(r.debit),
    credit: parseFloat(r.credit),
    runningBalance: parseFloat(r.runningBalance)
  }));
}

export async function getMainLedger(range = 'lifetime') {
  const cutoff = getCutoffDate(range);
  
  // Calculate running balance on the fly chronologically starting from balance forward
  const balanceForwardQuery = await sql`
    SELECT COALESCE(SUM(debit - credit), 0) as balance_forward
    FROM ledger_entries
    WHERE date < ${cutoff}
  `;
  const balanceForward = parseFloat(balanceForwardQuery[0].balance_forward || 0);

  const rows = await sql`
    SELECT 
      le.id, 
      le.account_id as "accountId", 
      a.name as "accountName",
      a.type as "accountType",
      le.date, 
      le.description, 
      le.debit, 
      le.credit,
      le.reference_type as "refType",
      le.reference_id as "refId",
      SUM(le.debit - le.credit) OVER (ORDER BY le.date ASC, le.id ASC) + ${balanceForward} as "runningBalance"
    FROM ledger_entries le
    JOIN accounts a ON le.account_id = a.id
    WHERE le.date >= ${cutoff}
    ORDER BY le.date DESC, le.id DESC
  `;
  
  return rows.map(r => ({
    ...r,
    id: parseInt(r.id),
    accountId: parseInt(r.accountId),
    debit: parseFloat(r.debit),
    credit: parseFloat(r.credit),
    runningBalance: parseFloat(r.runningBalance)
  }));
}

// -- BANK ACCOUNTS (Dummy for fallback) --
export async function getBankAccounts() {
  return [];
}

// -- MANUAL JOURNAL & TRANSFER ACTIONS --

export async function createManualJournalEntry(
  date: any,
  description: string,
  lines: { accountId: number; debit: number; credit: number }[],
  refType: 'manual' | 'transfer' = 'manual'
) {
  // 1. Validation: sum of debits must equal sum of credits
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Total debits must equal total credits.");
  }

  const prefix = refType === 'transfer' ? 'TRF-' : 'MAN-';
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const refId = `${prefix}${ts}-${rand}`;

  // 3. Insert ledger entries
  const entryDate = combineDateWithCurrentTime(date);
  for (const line of lines) {
    const debit = line.debit || 0;
    const credit = line.credit || 0;
    if (debit === 0 && credit === 0) continue; // Skip empty entries

    const typeVal = debit > 0 ? 'Debit' : 'Credit';
    await sql`
      INSERT INTO ledger_entries (account_id, date, description, type, debit, credit, running_balance, reference_type, reference_id)
      VALUES (${line.accountId}, ${entryDate}, ${description}, ${typeVal}, ${debit}, ${credit}, 0, ${refType}, ${refId})
    `;
  }

  // 4. Recalculate affected accounts
  const affectedAccountIds = Array.from(new Set(lines.map(l => l.accountId)));
  for (const accId of affectedAccountIds) {
    await recalculateLedger(accId);
  }

  return refId;
}

export async function updateManualJournalEntry(
  refId: string,
  date: any,
  description: string,
  lines: { accountId: number; debit: number; credit: number }[],
  refType: 'manual' | 'transfer' = 'manual'
) {
  // 1. Validation: sum of debits must equal sum of credits
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Total debits must equal total credits.");
  }

  // 2. Get currently affected accounts before deletion
  const oldEntries = await sql`
    SELECT DISTINCT account_id FROM ledger_entries 
    WHERE reference_id = ${refId}
  `;
  const oldAccountIds = oldEntries.map(e => parseInt(e.account_id));

  // 3. Delete old entries
  await sql`
    DELETE FROM ledger_entries 
    WHERE reference_id = ${refId}
  `;

  // 4. Insert new entries
  const entryDate = combineDateWithCurrentTime(date);
  for (const line of lines) {
    const debit = line.debit || 0;
    const credit = line.credit || 0;
    if (debit === 0 && credit === 0) continue;

    const typeVal = debit > 0 ? 'Debit' : 'Credit';
    await sql`
      INSERT INTO ledger_entries (account_id, date, description, type, debit, credit, running_balance, reference_type, reference_id)
      VALUES (${line.accountId}, ${entryDate}, ${description}, ${typeVal}, ${debit}, ${credit}, 0, ${refType}, ${refId})
    `;
  }

  // 5. Recalculate all affected accounts (both old and new)
  const newAccountIds = lines.map(l => l.accountId);
  const allAffected = Array.from(new Set([...oldAccountIds, ...newAccountIds]));
  for (const accId of allAffected) {
    await recalculateLedger(accId);
  }
}

export async function deleteJournalEntry(refId: string) {
  // 1. Find affected accounts
  const entries = await sql`
    SELECT DISTINCT account_id FROM ledger_entries 
    WHERE reference_id = ${refId}
  `;

  // 2. Delete the entries
  await sql`
    DELETE FROM ledger_entries 
    WHERE reference_id = ${refId}
  `;

  // 3. Recalculate balances
  for (const row of entries) {
    await recalculateLedger(parseInt(row.account_id));
  }
}

export async function getJournalEntry(refId: string) {
  const rows = await sql`
    SELECT id, account_id as "accountId", date, description, debit, credit, reference_type as "refType"
    FROM ledger_entries
    WHERE reference_id = ${refId}
    ORDER BY id ASC
  `;
  return rows.map(r => ({
    id: parseInt(r.id),
    accountId: parseInt(r.accountId),
    date: r.date,
    description: r.description,
    debit: parseFloat(r.debit || 0),
    credit: parseFloat(r.credit || 0),
    refType: r.refType
  }));
}

// ─── VEHICLE STOCK ACTIONS ───────────────────────────────────
export async function getVehicleStock() {
  const rows = await sql`
    SELECT 
      id, make, model, year, vin, reg_number as "regNumber", color,
      mileage, fuel_type as "fuelType", transmission, buy_price as "buyPrice",
      asking_price as "askingPrice", status, description, image_url as "imageUrl",
      created_at as "createdAt"
    FROM vehicle_stock
    ORDER BY created_at DESC
  `;
  return rows.map((r: any) => ({
    id: parseInt(r.id),
    make: r.make,
    model: r.model,
    year: parseInt(r.year || 0),
    vin: r.vin || "",
    regNumber: r.regNumber || "",
    color: r.color || "",
    mileage: parseInt(r.mileage || 0),
    fuelType: r.fuelType || "Petrol",
    transmission: r.transmission || "Automatic",
    buyPrice: parseFloat(r.buyPrice || 0),
    askingPrice: parseFloat(r.askingPrice || 0),
    status: r.status || "Available",
    description: r.description || "",
    imageUrl: r.imageUrl || ""
  }));
}

export async function createVehicleStock(data: any) {
  await sql`
    INSERT INTO vehicle_stock (
      make, model, year, vin, reg_number, color, mileage,
      fuel_type, transmission, buy_price, asking_price, status, description, image_url
    )
    VALUES (
      ${data.make}, ${data.model}, ${data.year}, ${data.vin || null}, ${data.regNumber || null},
      ${data.color || null}, ${data.mileage || 0}, ${data.fuelType || 'Petrol'}, ${data.transmission || 'Automatic'},
      ${data.buyPrice || 0}, ${data.askingPrice || 0}, ${data.status || 'Available'}, ${data.description || null},
      ${data.imageUrl || null}
    )
  `;
  await logActivity(`Added vehicle to stock: ${data.year} ${data.make} ${data.model}`);
}

export async function updateVehicleStock(id: number, data: any) {
  await sql`
    UPDATE vehicle_stock
    SET 
      make = ${data.make},
      model = ${data.model},
      year = ${data.year},
      vin = ${data.vin || null},
      reg_number = ${data.regNumber || null},
      color = ${data.color || null},
      mileage = ${data.mileage || 0},
      fuel_type = ${data.fuelType || 'Petrol'},
      transmission = ${data.transmission || 'Automatic'},
      buy_price = ${data.buyPrice || 0},
      asking_price = ${data.askingPrice || 0},
      status = ${data.status || 'Available'},
      description = ${data.description || null},
      image_url = ${data.imageUrl || null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

export async function deleteVehicleStock(id: number) {
  await sql`DELETE FROM vehicle_stock WHERE id = ${id}`;
  await logActivity(`Deleted vehicle stock record ${id}`);
}