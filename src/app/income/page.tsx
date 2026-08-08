"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Calendar, Plus, Edit2, Trash2, FileText, X, Loader2, Eye, FilePlus, Trash } from "lucide-react";
import Link from "next/link";
import { getIncomes, createIncome, deleteIncome, updateIncome, uploadReceipt, getClients, createClient, createInvoice, getAccounts } from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";
import CategoryPicker from "../components/CategoryPicker";
import DateRangeSelector from "../components/DateRangeSelector";

const ALL_CATEGORIES = ["Vehicle Sales", "Registration & Transfer Fees", "Inspection & Certification", "Financing & Lease Commission", "Other Services"];

const formatLKR = (amount: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount || 0);

// Helper: parse stored comma-separated category string → array
const parseCategories = (raw: string | string[] | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

// Helper: array → comma-separated string for storage
const joinCategories = (cats: string[]): string => cats.join(", ");

interface LineItem {
  name: string;
  qty: number;
  rate: number;
}

export default function IncomePage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("lifetime");
  const [startDate, setStartDate] = useState("1970-01-01");
  const [endDate, setEndDate] = useState("2099-12-31");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(ALL_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([ALL_CATEGORIES[0]]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const filters = ["All", ...availableCategories];


  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    clientId: '',
    description: '',
    paymentMethod: 'Bank Transfer',
    invoiceId: '',
    receiptUrl: '',
    accountId: '',
  });

  // --- Create Invoice from Income ---
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceSourceRow, setInvoiceSourceRow] = useState<any>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ name: '', qty: 1, rate: 0 }]);
  const [invoiceFormData, setInvoiceFormData] = useState({
    clientName: '',
    userEmail: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'LKR',
    discount: 0,
    advance: 0,
  });

  const loadData = async (isCurrent?: () => boolean) => {
    setLoading(true);
    try {
      const [res, cls, accs] = await Promise.all([getIncomes(dateRange, startDate, endDate), getClients(), getAccounts()]);
      if (isCurrent && !isCurrent()) return;
      setData(res);
      setClients(cls);
      setAccounts(accs);

      // Aggregate dynamic categories from database records
      const uniqueCats = new Set<string>();
      ALL_CATEGORIES.forEach(c => uniqueCats.add(c));
      res.items.forEach((item: any) => {
        parseCategories(item.category).forEach((cat) => {
          const normalized = cat.trim();
          const matched = ALL_CATEGORIES.find(c => c.toLowerCase() === normalized.toLowerCase());
          uniqueCats.add(matched || (normalized.charAt(0).toUpperCase() + normalized.slice(1)));
        });
      });
      setAvailableCategories(Array.from(uniqueCats));
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load income data", e);
      }
    } finally {
      if (!isCurrent || isCurrent()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const handleDateRangeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ range: string; startDate: string; endDate: string }>;
      if (customEvent.detail) {
        setDateRange(customEvent.detail.range);
        setStartDate(customEvent.detail.startDate);
        setEndDate(customEvent.detail.endDate);
      }
    };
    window.addEventListener("admin:date-range-change", handleDateRangeChange);
    return () => {
      window.removeEventListener("admin:date-range-change", handleDateRangeChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadData(() => active);
    return () => {
      active = false;
    };
  }, [startDate, endDate]);

  const openNew = () => {
    setEditingId(null);
    setFormData({ date: new Date().toISOString().split('T')[0], amount: '', clientId: '', description: '', paymentMethod: 'Bank Transfer', invoiceId: '', receiptUrl: '', accountId: '' });
    setSelectedCategories([ALL_CATEGORIES[0]]);
    setNewClientName(''); setNewClientEmail(''); setNewClientCompany(''); setNewClientPhone('');
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleEdit = (row: any) => {
    let formattedDate = new Date().toISOString().split('T')[0];
    try { if (row.date) formattedDate = new Date(row.date).toISOString().split('T')[0]; } catch (e) {}
    setEditingId(row.id);
    setFormData({ 
      date: formattedDate, 
      amount: row.amount.toString(), 
      clientId: row.clientId || '', 
      description: row.desc || '', 
      paymentMethod: row.paymentMethod || 'Bank Transfer', 
      invoiceId: row.invoice || '', 
      receiptUrl: row.receiptUrl || '', 
      accountId: row.accountId ? row.accountId.toString() : '' 
    });
    setSelectedCategories(parseCategories(row.category));
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) { alert("Please select at least one category."); return; }
    setSaving(true);
    try {
      let uploadedUrl = formData.receiptUrl;
      if (receiptFile) {
        const fileData = new FormData();
        fileData.append('file', receiptFile);
        uploadedUrl = await uploadReceipt(fileData, 'income');
      }

      let clientId = formData.clientId;
      if (clientId === 'new') {
        clientId = await createClient({ name: newClientName, email: newClientEmail, company: newClientCompany || null, phone: newClientPhone || null });
      }

      const payload = {
        ...formData,
        clientId,
        amount: parseFloat(formData.amount) || 0,
        category: joinCategories(selectedCategories),
        receiptUrl: uploadedUrl,
        accountId: formData.accountId ? parseInt(formData.accountId) : null
      };

      if (editingId) { await updateIncome(editingId, payload); } 
      else { await createIncome(payload); }

      setIsModalOpen(false);
      setEditingId(null);
      setReceiptFile(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to save income');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this record?")) {
      try { await deleteIncome(id); await loadData(); } catch (e) { console.error("Failed to delete", e); }
    }
  };

  // --- Invoice Modal Helpers ---
  const openInvoiceModal = (row: any) => {
    setInvoiceSourceRow(row);

    // Find matching client email
    const matchedClient = clients.find(c => c.id === row.clientId);

    setInvoiceFormData({
      clientName: row.client || matchedClient?.name || '',
      userEmail: matchedClient?.email || '',
      date: new Date().toISOString().split('T')[0],
      currency: 'LKR',
      discount: 0,
      advance: 0,
    });

    // Pre-populate a single line item from the income row
    setLineItems([{
      name: row.desc || 'Service',
      qty: 1,
      rate: parseFloat(row.amount) || 0,
    }]);

    setInvoiceModalOpen(true);
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { name: '', qty: 1, rate: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const lineItemsSubtotal = lineItems.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  const invoiceTotal = lineItemsSubtotal - (invoiceFormData.discount || 0);
  const invoiceDue = invoiceTotal - (invoiceFormData.advance || 0);

  const handleCreateInvoice = async () => {
    if (lineItems.every(item => !item.name)) {
      alert('Please add at least one line item.');
      return;
    }

    setCreatingInvoice(true);
    try {
      const invoiceData = {
        userEmail: invoiceFormData.userEmail,
        clientName: invoiceFormData.clientName,
        date: invoiceFormData.date,
        subtotal: lineItemsSubtotal,
        discount: invoiceFormData.discount || 0,
        total: invoiceTotal,
        advance: invoiceFormData.advance || 0,
        totalDue: invoiceDue,
        paymentStatus: 'paid',
        currency: invoiceFormData.currency,
        category: invoiceSourceRow?.category || null,
      };

      const mappedLineItems = lineItems
        .filter(item => item.name)
        .map(item => ({
          description: item.name,
          quantity: item.qty,
          rate: item.rate,
        }));

      const result = await createInvoice(invoiceData, mappedLineItems);

      // Link the created invoice back to the income record
      if (result?.invoiceId && invoiceSourceRow?.id) {
        const incomePayload = {
          date: invoiceSourceRow.date,
          amount: invoiceSourceRow.amount,
          clientId: invoiceSourceRow.clientId || '',
          description: invoiceSourceRow.desc || '',
          paymentMethod: invoiceSourceRow.paymentMethod || 'Bank Transfer',
          invoiceId: result.invoiceId,
          receiptUrl: invoiceSourceRow.receiptUrl || '',
          category: invoiceSourceRow.category || '',
        };
        await updateIncome(invoiceSourceRow.id, incomePayload);
      }

      setInvoiceModalOpen(false);
      setInvoiceSourceRow(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  };

  useEffect(() => {
    const handleOpenNew = () => openNew();
    window.addEventListener("income:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("income:open-new", handleOpenNew);
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={3} />
        <SkeletonTable rows={5} />
      </div>
    );
  }

  const stats = [
    { label: "This Month", value: formatLKR(data.thisMonth), icon: Wallet, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Last Month", value: formatLKR(data.lastMonth), icon: Calendar, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Year to Date", value: formatLKR(data.ytd), icon: TrendingUp, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];

  const filteredIncome = (data?.items || []).filter((row: any) => {
    const matchesCategory = activeFilter === "All" || parseCategories(row.category).some(cat => cat.toLowerCase() === activeFilter.toLowerCase());
    if (!matchesCategory) return false;

    const rowDate = new Date(row.date);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return rowDate >= start && rowDate <= end;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div><p className="text-gray-400 text-sm">{stat.label}</p><p className="text-2xl font-semibold">{stat.value}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === f ? "bg-brand-500 text-white shadow-sm" : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[#64748b] text-sm">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Account</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium">Categories</th>
                <th className="p-4 font-medium">Invoice</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
              {filteredIncome.map((row: any) => (
                <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="p-4 text-sm text-[#64748b] whitespace-nowrap">{row.date}</td>
                  <td className="p-4 font-semibold text-[#15803d] whitespace-nowrap">{formatLKR(row.amount)}</td>
                  <td className="p-4 text-sm text-[#334155] font-medium">{row.accountName || '-'}</td>
                  <td className="p-4 text-sm text-[#0f172a] font-medium">{row.client || '-'}</td>
                  <td className="p-4 text-sm text-[#334155]">{row.desc}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {parseCategories(row.category).map((cat) => (
                        <span key={cat} className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[#475569] whitespace-nowrap">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {row.invoice ? (
                      <Link href={`/invoice/${row.invoice}`} className="flex items-center gap-1.5 text-sm font-semibold text-[#b91c1c] hover:text-[#991b1b] transition-colors">
                        <FileText className="w-4 h-4 text-[#b91c1c]" />{row.invoice}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Create Invoice button */}
                      <button
                        onClick={() => openInvoiceModal(row)}
                        title="Create Invoice"
                        className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#002f4c]"
                      >
                        <FilePlus className="w-4 h-4" />
                      </button>
                      {row.receiptUrl && (
                        <button onClick={() => setViewingReceipt(row)} className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#0284c7] hover:text-[#0369a1]">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(row)} className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#0f172a]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-red-50 rounded-xl transition-colors text-[#64748b] hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIncome.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-[#64748b]">No income records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Income Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Income' : 'Record Income'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Amount (LKR)</label>
                  <input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Client</label>
                <select value={formData.clientId} onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                  <option value="" className="bg-black">None</option>
                  <option value="new" className="bg-brand-900">+ Add New Client</option>
                  {clients.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                </select>
              </div>

              {formData.clientId === 'new' && (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                  <input type="text" placeholder="Client Name" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  <input type="email" placeholder="Client Email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Company (Optional)" value={newClientCompany} onChange={e => setNewClientCompany(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" />
                    <input type="text" placeholder="Phone (Optional)" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Description</label>
                <input type="text" placeholder="What was this for?" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 col-span-1">
                  <label className="text-sm text-gray-400">Categories</label>
                  <CategoryPicker 
                    categories={availableCategories} 
                    value={selectedCategories} 
                    onChange={setSelectedCategories} 
                    onAddCategory={(newCat) => setAvailableCategories(prev => [...prev, newCat])}
                    placeholder="Select categories..." 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer">
                    <option className="bg-black">Bank Transfer</option>
                    <option className="bg-black">Stripe</option>
                    <option className="bg-black">PayPal</option>
                    <option className="bg-black">Cash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Target Account</label>
                  <select value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer">
                    <option value="" className="bg-black">No Account (Unlinked)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} className="bg-black">
                        {acc.name} ({formatLKR(acc.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Linked Invoice (Optional)</label>
                <input type="text" placeholder="e.g. INV-001" value={formData.invoiceId} onChange={e => setFormData({ ...formData, invoiceId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-400">Receipt Image</label>
                <input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                {formData.receiptUrl && !receiptFile && (
                  <a href={formData.receiptUrl} target="_blank" className="text-xs text-blue-400 underline mt-1 block px-2">View current receipt</a>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-full font-medium hover:bg-white/10 transition-colors" disabled={saving}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-full font-medium transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving..." : (editingId ? "Update Income" : "Save Income")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-600/10">
                  <FilePlus className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Create Invoice</h2>
                </div>
              </div>
              <button onClick={() => setInvoiceModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-black">
              {/* Client Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">Client Name</label>
                  <input
                    type="text"
                    placeholder="Client name"
                    value={invoiceFormData.clientName}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, clientName: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">Client Email</label>
                  <input
                    type="email"
                    placeholder="client@email.com (optional)"
                    value={invoiceFormData.userEmail}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, userEmail: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">Date</label>
                  <input
                    type="date"
                    value={invoiceFormData.date}
                    onChange={e => setInvoiceFormData({ ...invoiceFormData, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">Line Items</label>
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-brand-600/10 hover:bg-brand-600/20 text-brand-600 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-[1fr_80px_110px_80px] gap-2 px-1">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Name / Description</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold text-center">Qty</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold text-right">Rate (LKR)</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold text-right">Total</span>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_80px_110px_80px] gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.name}
                        onChange={e => updateLineItem(index, 'name', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={e => updateLineItem(index, 'qty', parseInt(e.target.value) || 1)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white text-center"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={item.rate}
                        onChange={e => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white text-right"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-sm font-bold text-green-600 text-right flex-1">
                          {formatLKR(item.qty * item.rate)}
                        </span>
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(index)}
                            className="p-1 hover:bg-red-400/10 rounded-lg transition-colors text-white/40 hover:text-red-400"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Adjustments */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">Discount (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={invoiceFormData.discount}
                      onChange={e => setInvoiceFormData({ ...invoiceFormData, discount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/60 uppercase tracking-wider font-semibold">Advance Paid (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={invoiceFormData.advance}
                      onChange={e => setInvoiceFormData({ ...invoiceFormData, advance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-brand-500 focus:bg-black transition-colors text-sm text-white"
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>Subtotal</span>
                    <span>{formatLKR(lineItemsSubtotal)}</span>
                  </div>
                  {invoiceFormData.discount > 0 && (
                    <div className="flex justify-between text-white/60">
                      <span>Discount</span>
                      <span className="text-red-400">- {formatLKR(invoiceFormData.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white/60">
                    <span>Total</span>
                    <span className="text-white font-semibold">{formatLKR(invoiceTotal)}</span>
                  </div>
                  {invoiceFormData.advance > 0 && (
                    <div className="flex justify-between text-white/60">
                      <span>Advance Paid</span>
                      <span className="text-brand-400">- {formatLKR(invoiceFormData.advance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-white/10">
                    <span>Total Due</span>
                    <span className="text-green-400">{formatLKR(invoiceDue)}</span>
                  </div>
                </div>
              </div>


            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button
                onClick={() => setInvoiceModalOpen(false)}
                className="px-6 py-2.5 rounded-full font-medium border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
                disabled={creatingInvoice}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={creatingInvoice}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-black rounded-full font-medium transition-colors disabled:opacity-50"
              >
                {creatingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />}
                {creatingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
          <div className="relative flex flex-col md:flex-row bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
              <X className="w-5 h-5" />
            </button>
            <div className="w-full md:w-1/3 bg-white/5 p-6 sm:p-8 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Receipt Details</h3>
                <p className="text-sm text-gray-400">Transaction Information</p>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Amount</p>
                  <p className="text-3xl font-bold text-green-400">{formatLKR(viewingReceipt.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                  <p className="text-sm font-medium text-white">{viewingReceipt.date}</p>
                </div>
                {viewingReceipt.client && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Client</p>
                    <p className="text-sm font-medium text-white">{viewingReceipt.client}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseCategories(viewingReceipt.category).map((cat) => (
                      <span key={cat} className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 border border-white/10">{cat}</span>
                    ))}
                  </div>
                </div>
                {viewingReceipt.desc && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Description</p>
                    <p className="text-sm font-medium text-gray-300">{viewingReceipt.desc}</p>
                  </div>
                )}
                {viewingReceipt.invoice && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Linked Invoice</p>
                    <Link href={`/invoices/${viewingReceipt.invoice}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 text-sm font-medium text-brand-400 hover:bg-brand-500/20 transition-colors">
                      <FileText className="w-4 h-4" />{viewingReceipt.invoice}
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full md:w-2/3 bg-black/50 flex items-center justify-center p-6 min-h-[300px] overflow-hidden">
              <img src={viewingReceipt.receiptUrl} alt="Receipt" className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-white/5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}