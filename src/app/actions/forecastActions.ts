"use server";

import sql from "@/lib/db";

export interface SystemAnalysisData {
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMarginPercent: number;
    avgMonthlyRevenue: number;
    avgMonthlyExpense: number;
    activeStockValue: number;
    stockCount: number;
    unpaidInvoiceAmount: number;
    unpaidInvoiceCount: number;
    totalClients: number;
  };
  vehiclePerformance: Array<{
    make: string;
    model: string;
    inventoryCount: number;
    totalInvestment: number;
    salesCount: number;
    totalSalesRevenue: number;
    estimatedMargin: number;
    avgHoldDays: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  expenseCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  topClients: Array<{
    name: string;
    totalPurchases: number;
    invoiceCount: number;
  }>;
}

export async function getForecastsAnalysisData(): Promise<SystemAnalysisData> {
  const [
    incomes,
    expenses,
    stock,
    invoices,
    clients
  ] = await Promise.all([
    sql`SELECT id, amount, date, category, description, client_id FROM admin_incomes ORDER BY date ASC`,
    sql`SELECT id, amount, date, category, description FROM admin_expenses ORDER BY date ASC`,
    sql`SELECT id, make, model, year, buy_price, asking_price, status, created_at FROM vehicle_stock`,
    sql`
      SELECT 
        i.id, i.invoice_id, i.total, i.total_due, i.payment_status, i.date, i.user_email,
        COALESCE(ac.full_name, i.user_email, 'Client') as client_name
      FROM invoices i
      LEFT JOIN admin_clients ac ON 
        (i.client_id IS NOT NULL AND i.client_id = ac.id) OR 
        (i.client_id IS NULL AND i.user_email IS NOT NULL AND LOWER(i.user_email) = LOWER(ac.email))
    `,
    sql`SELECT id, full_name, company, email FROM admin_clients`
  ]);

  let totalRevenue = 0;
  let totalExpenses = 0;

  incomes.forEach((r: any) => { totalRevenue += parseFloat(r.amount || 0); });
  expenses.forEach((r: any) => { totalExpenses += parseFloat(r.amount || 0); });

  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Monthly trends map
  const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};

  incomes.forEach((r: any) => {
    const d = new Date(r.date);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, expenses: 0 };
      monthlyMap[key].revenue += parseFloat(r.amount || 0);
    }
  });

  expenses.forEach((r: any) => {
    const d = new Date(r.date);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, expenses: 0 };
      monthlyMap[key].expenses += parseFloat(r.amount || 0);
    }
  });

  const monthKeys = Object.keys(monthlyMap).sort();
  const monthlyTrends = monthKeys.map(k => {
    const rev = monthlyMap[k].revenue;
    const exp = monthlyMap[k].expenses;
    return {
      month: k,
      revenue: rev,
      expenses: exp,
      profit: rev - exp
    };
  });

  const monthCount = Math.max(monthKeys.length, 1);
  const avgMonthlyRevenue = totalRevenue / monthCount;
  const avgMonthlyExpense = totalExpenses / monthCount;

  // Vehicle performance analysis
  const makeModelMap: Record<string, {
    make: string;
    model: string;
    inventoryCount: number;
    totalInvestment: number;
    salesCount: number;
    totalSalesRevenue: number;
  }> = {};

  let activeStockValue = 0;
  let stockCount = 0;

  stock.forEach((v: any) => {
    const key = `${v.make} ${v.model}`.trim();
    if (!makeModelMap[key]) {
      makeModelMap[key] = {
        make: v.make,
        model: v.model,
        inventoryCount: 0,
        totalInvestment: 0,
        salesCount: 0,
        totalSalesRevenue: 0
      };
    }

    const buyPrice = parseFloat(v.buy_price || 0);
    const isAvailable = (v.status || '').toLowerCase() === 'available';

    if (isAvailable) {
      activeStockValue += buyPrice;
      stockCount += 1;
      makeModelMap[key].inventoryCount += 1;
      makeModelMap[key].totalInvestment += buyPrice;
    }
  });

  // Cross reference vehicle sales from income descriptions
  incomes.forEach((inc: any) => {
    const desc = inc.description || '';
    const amt = parseFloat(inc.amount || 0);

    stock.forEach((v: any) => {
      if (desc.toLowerCase().includes(v.make.toLowerCase()) && desc.toLowerCase().includes(v.model.toLowerCase())) {
        const key = `${v.make} ${v.model}`.trim();
        if (makeModelMap[key]) {
          makeModelMap[key].salesCount += 1;
          makeModelMap[key].totalSalesRevenue += amt;
        }
      }
    });
  });

  const vehiclePerformance = Object.values(makeModelMap).map(vm => {
    const estMargin = vm.salesCount > 0
      ? ((vm.totalSalesRevenue - (vm.inventoryCount > 0 ? (vm.totalInvestment / vm.inventoryCount) * vm.salesCount : 0)) / vm.totalSalesRevenue) * 100
      : 15.0;

    return {
      make: vm.make,
      model: vm.model,
      inventoryCount: vm.inventoryCount,
      totalInvestment: vm.totalInvestment,
      salesCount: vm.salesCount,
      totalSalesRevenue: vm.totalSalesRevenue,
      estimatedMargin: Math.round(estMargin * 10) / 10,
      avgHoldDays: 35
    };
  }).sort((a, b) => b.totalSalesRevenue - a.totalSalesRevenue);

  // Unpaid invoices calculation
  let unpaidInvoiceAmount = 0;
  let unpaidInvoiceCount = 0;

  invoices.forEach((inv: any) => {
    const status = (inv.payment_status || '').toLowerCase();
    const due = parseFloat(inv.total_due || 0);
    if (status !== 'paid' && due > 0) {
      unpaidInvoiceAmount += due;
      unpaidInvoiceCount += 1;
    }
  });

  // Expense breakdown
  const expenseCatMap: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const cat = e.category || 'Other';
    expenseCatMap[cat] = (expenseCatMap[cat] || 0) + parseFloat(e.amount || 0);
  });

  const expenseCategories = Object.entries(expenseCatMap).map(([category, amount]) => ({
    category,
    amount,
    percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0
  })).sort((a, b) => b.amount - a.amount);

  // Top Clients
  const clientRevenueMap: Record<string, { name: string; totalPurchases: number; invoiceCount: number }> = {};
  invoices.forEach((inv: any) => {
    const name = inv.client_name || inv.user_email || 'Client';
    if (!clientRevenueMap[name]) {
      clientRevenueMap[name] = { name, totalPurchases: 0, invoiceCount: 0 };
    }
    clientRevenueMap[name].totalPurchases += parseFloat(inv.total || 0);
    clientRevenueMap[name].invoiceCount += 1;
  });

  const topClients = Object.values(clientRevenueMap)
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 5);

  return {
    metrics: {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
      avgMonthlyRevenue: Math.round(avgMonthlyRevenue),
      avgMonthlyExpense: Math.round(avgMonthlyExpense),
      activeStockValue,
      stockCount,
      unpaidInvoiceAmount,
      unpaidInvoiceCount,
      totalClients: clients.length
    },
    vehiclePerformance,
    monthlyTrends,
    expenseCategories,
    topClients
  };
}

export async function generateAIForecast(data: SystemAnalysisData, forecastMonths: number = 3) {
  const forecastLabel = forecastMonths === 1 ? 'Next Month' : forecastMonths === 3 ? 'Next Quarter (3 Months)' : forecastMonths === 6 ? 'Next 6 Months' : 'Next Year (12 Months)';
  const prompt = `
You are an expert Automotive Dealership Financial Analyst and AI Business Planner for "Carz One".
Analyze the real live dealership dataset provided below and generate comprehensive, data-backed business forecasts for the period: ${forecastLabel} (${forecastMonths} months ahead). Provide inventory acquisition recommendations, marketing strategies, and financial risk predictions scaled to this ${forecastMonths}-month forecast window.

LIVE DEALERSHIP DATASET:
- Total Revenue: LKR ${data.metrics.totalRevenue.toLocaleString()}
- Total Expenses: LKR ${data.metrics.totalExpenses.toLocaleString()}
- Net Profit: LKR ${data.metrics.netProfit.toLocaleString()} (Margin: ${data.metrics.profitMarginPercent}%)
- Average Monthly Revenue: LKR ${data.metrics.avgMonthlyRevenue.toLocaleString()}
- Average Monthly Expenses: LKR ${data.metrics.avgMonthlyExpense.toLocaleString()}
- Active Inventory: ${data.metrics.stockCount} vehicles valued at LKR ${data.metrics.activeStockValue.toLocaleString()}
- Receivables (Unpaid Invoices): LKR ${data.metrics.unpaidInvoiceAmount.toLocaleString()} across ${data.metrics.unpaidInvoiceCount} invoices
- Total Client Base: ${data.metrics.totalClients} clients

TOP VEHICLE PERFORMANCE & SALES IN SIGHTS:
${JSON.stringify(data.vehiclePerformance.slice(0, 6))}

EXPENSE CATEGORY BREAKDOWN:
${JSON.stringify(data.expenseCategories)}

MONTHLY REVENUE & PROFIT TRENDS:
${JSON.stringify(data.monthlyTrends)}

REQUIREMENTS FOR JSON OUTPUT:
Return ONLY valid JSON without markdown formatting, code blocks, or extra text. Format as following schema:
{
  "executiveSummary": "Concise 3-sentence summary of the business financial standing, growth momentum, and core outlook based on the data.",
  "revenueForecastNextQuarter": {
    "projectedRevenue": 150000000,
    "projectedExpenses": 110000000,
    "projectedNetProfit": 40000000,
    "growthRatePercent": 12.5,
    "explanation": "Detailed explanation referencing historical monthly trends and sales velocity.",
    "dataSource": "Historical monthly trends & invoice settlement velocity"
  },
  "vehicleAcquisitionPlan": [
    {
      "modelName": "BMW X5 xDrive45e / Toyota Land Cruiser Prado",
      "action": "HEAVY BUY",
      "recommendedUnits": 3,
      "estimatedUnitCost": 45000000,
      "expectedROI": "18.5%",
      "rationale": "High sales revenue and fast turnover in current inventory records.",
      "dataSource": "Vehicle Performance & Sales Revenue Breakdown"
    }
  ],
  "marketingStrategies": [
    {
      "strategy": "Targeted Hybrid & Luxury Leasing Campaigns",
      "focusArea": "Digital & High-Net-Worth Retargeting",
      "recommendedBudgetLKR": 1500000,
      "expectedRevenueImpact": "LKR 45,000,000 in Q3 vehicle sales",
      "rationale": "High margin on luxury hybrids (BMW X5 / Range Rover) with active client interest.",
      "dataSource": "Expense Breakdown & Top Client Purchase History"
    }
  ],
  "cashFlowRiskMitigation": [
    {
      "risk": "Outstanding Receivables Bottleneck",
      "impactSeverity": "MEDIUM",
      "recommendedAction": "Enforce 14-day settlement notice with automatic invoice reminders.",
      "dataSource": "Unpaid Invoices Ledger (LKR " + data.metrics.unpaidInvoiceAmount + " total due)"
    }
  ],
  "actionableMilestones": [
    "Reallocate 20% of unspent marketing funds into digital luxury car showcases.",
    "Acquire 2 additional Japanese plug-in hybrid SUVs ahead of peak quarter demand."
  ]
}
`;

  // Groq AI API call — all forecast data generated dynamically
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("GROQ_API_KEY is not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const validModels = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it"
  ];
  const selectedModel = validModels[Math.floor(Math.random() * validModels.length)];

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a specialized business forecasting AI for vehicle dealerships. Always return strict, valid JSON without code blocks or markdown wrapping." },
          { role: "user", content: prompt }
        ],
        model: selectedModel,
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const resData = await res.json();
    const content = resData.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
