"use client";

import { useEffect, useState } from "react";
import { Receipt, Calendar, CreditCard, Plus, Edit2, Trash2, X, UploadCloud, Loader2, Eye } from "lucide-react";
import { getExpenses, createExpense, deleteExpense, updateExpense, uploadReceipt, getAccounts } from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";
import CategoryPicker from "../components/CategoryPicker";
import DateRangeSelector from "../components/DateRangeSelector";

const DEFAULT_CATEGORIES = ["Vehicle Acquisition", "Repairs & Detailing", "Showroom Rent", "Staff Salary & Commission", "Marketing & Ads", "Utilities", "Other"];

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

export default function ExpensesPage() {
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
  const [accounts, setAccounts] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const filters = ["All", ...availableCategories];

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    category: DEFAULT_CATEGORIES[0],
    paymentMethod: 'Card',
    receiptUrl: '',
    accountId: ''
  });

  const loadData = async (isCurrent?: () => boolean) => {
    setLoading(true);
    try {
      const [res, accs] = await Promise.all([getExpenses("lifetime"), getAccounts()]);
      if (isCurrent && !isCurrent()) return;
      setData(res);
      setAccounts(accs);

      // Aggregate categories from DB records (matching against DEFAULT_CATEGORIES)
      const uniqueCats = new Set<string>(DEFAULT_CATEGORIES);
      res.items.forEach((item: any) => {
        if (item.category) {
          const normalized = item.category.trim();
          const matched = DEFAULT_CATEGORIES.find(c => c.toLowerCase() === normalized.toLowerCase());
          if (matched) {
            uniqueCats.add(matched);
          } else {
            uniqueCats.add(normalized.charAt(0).toUpperCase() + normalized.slice(1));
          }
        }
      });
      setAvailableCategories(Array.from(uniqueCats));
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load expenses data", e);
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
  const handleSave = async () => {
    setSaving(true);
    try {
      let uploadedUrl = formData.receiptUrl;
      if (receiptFile) {
        const fileData = new FormData();
        fileData.append('file', receiptFile);
        uploadedUrl = await uploadReceipt(fileData, 'expenses');
      }

      const payload = { 
        ...formData, 
        amount: parseFloat(formData.amount) || 0, 
        receiptUrl: uploadedUrl,
        accountId: formData.accountId ? parseInt(formData.accountId) : null
      };
      if (editingId) {
        await updateExpense(editingId, payload);
      } else {
        await createExpense(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setReceiptFile(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        category: DEFAULT_CATEGORIES[0],
        paymentMethod: 'Card',
        receiptUrl: '',
        accountId: ''
      });
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: any) => {
    let formattedDate = new Date().toISOString().split('T')[0];
    try { if (row.date) formattedDate = new Date(row.date).toISOString().split('T')[0]; } catch(e) {}
    
    setEditingId(row.id);
    setFormData({
      date: formattedDate,
      amount: row.amount.toString(),
      description: row.desc || '',
      category: row.category || DEFAULT_CATEGORIES[0],
      paymentMethod: row.paidVia || 'Card',
      receiptUrl: row.receiptUrl || '',
      accountId: row.accountId ? row.accountId.toString() : ''
    });
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this record?")) {
      try {
        await deleteExpense(id);
        await loadData();
      } catch (e) {
        console.error("Failed to delete", e);
      }
    }
  };

  useEffect(() => {
    const handleOpenNew = () => {
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        category: DEFAULT_CATEGORIES[0],
        paymentMethod: 'Card',
        receiptUrl: '',
        accountId: ''
      });
      setReceiptFile(null);
      setIsModalOpen(true);
    };
    window.addEventListener("expenses:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("expenses:open-new", handleOpenNew);
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
    { label: "This Month", value: formatLKR(data.thisMonth), icon: Receipt, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Last Month", value: formatLKR(data.lastMonth), icon: Calendar, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Year to Date", value: formatLKR(data.ytd), icon: CreditCard, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];

  const filteredExpenses = (data?.items || []).filter((row: any) => {
    const matchesCategory = activeFilter === "All" || (row.category && row.category.toLowerCase() === activeFilter.toLowerCase());
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f 
                ? "bg-brand-500 text-white shadow-sm" 
                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
            }`}
          >
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
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Paid via</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
              {filteredExpenses.map((row: any) => (
                <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="p-4 text-sm text-[#64748b] whitespace-nowrap">{row.date}</td>
                  <td className="p-4 font-semibold text-[#b91c1c] whitespace-nowrap">{formatLKR(row.amount)}</td>
                  <td className="p-4 text-sm text-[#334155] font-medium">{row.accountName || '-'}</td>
                  <td className="p-4 text-sm text-[#334155]">{row.desc}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[#475569]">
                      {row.category}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-[#0f172a] whitespace-nowrap">{row.paidVia}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
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
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748b]">No expense records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Expense' : 'Record Expense'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Amount (LKR)</label>
                  <input type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Description</label>
                <input type="text" placeholder="What was this expense for?" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Category</label>
                  <CategoryPicker 
                    categories={availableCategories} 
                    value={formData.category ? [formData.category] : []} 
                    onChange={(selected) => setFormData({ ...formData, category: selected[selected.length - 1] || 'Other' })} 
                    onAddCategory={(newCat) => setAvailableCategories(prev => [...prev, newCat])}
                    placeholder="Select category..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer">
                    <option className="bg-black">Card</option>
                    <option className="bg-black">Bank Transfer</option>
                    <option className="bg-black">Cash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Source Account</label>
                  <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer font-medium">
                    <option value="" className="bg-black text-gray-400">No Account (Unlinked)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} className="bg-black text-white">
                        {acc.name} ({formatLKR(acc.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Receipt Image</label>
                <input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                {formData.receiptUrl && !receiptFile && <a href={formData.receiptUrl} target="_blank" className="text-xs text-blue-400 underline mt-1 block px-2">View current receipt</a>}
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-full font-medium hover:bg-white/10 transition-colors" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-full font-medium transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving..." : (editingId ? "Update Expense" : "Save Expense")}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-3xl font-bold text-red-400">{formatLKR(viewingReceipt.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                  <p className="text-sm font-medium text-white">{viewingReceipt.date}</p>
                </div>
                {viewingReceipt.paidVia && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Paid Via</p>
                    <p className="text-sm font-medium text-white">{viewingReceipt.paidVia}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Category</p>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/10 border border-white/10 inline-block">
                    {viewingReceipt.category}
                  </span>
                </div>
                {viewingReceipt.desc && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Description</p>
                    <p className="text-sm font-medium text-gray-300">{viewingReceipt.desc}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full md:w-2/3 bg-black/50 flex items-center justify-center p-6 min-h-[300px] overflow-hidden">
              <img 
                src={viewingReceipt.receiptUrl} 
                alt="Receipt" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-white/5"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
