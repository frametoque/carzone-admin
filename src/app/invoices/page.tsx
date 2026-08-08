"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle, Clock, AlertCircle, Search, Eye, Edit2, Send, Download, Trash2, DollarSign } from "lucide-react";
import Link from "next/link";
import { getInvoices, deleteInvoice, getAccounts, recordInvoicePayment } from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";

const filters = ["All", "Paid", "Partially-Paid", "Overdue", "Advance-Paid", "Unpaid"];

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

export default function InvoicesPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("lifetime");
  const [startDate, setStartDate] = useState("1970-01-01");
  const [endDate, setEndDate] = useState("2099-12-31");

  // Payment recording states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const loadData = async (isCurrent?: () => boolean) => {
    try {
      const res = await getInvoices(dateRange, startDate, endDate);
      if (isCurrent && !isCurrent()) return;
      setData(res);
      // Fetch accounts to populate recording modal
      const accs = await getAccounts();
      if (isCurrent && !isCurrent()) return;
      setAccounts(accs);
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load invoices", e);
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
    let current = true;
    loadData(() => current); 
    return () => { current = false; };
  }, [startDate, endDate]);

  const openPaymentModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaidAmount(invoice.totalDue.toString());
    setPaymentDate(new Date().toISOString().split('T')[0]);
    if (accounts.length > 0) {
      setSelectedAccount(accounts[0].id.toString());
    } else {
      setSelectedAccount("");
    }
    setIsModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    const amt = parseFloat(paidAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid positive payment amount.");
      return;
    }
    if (!selectedAccount) {
      alert("Please select a bank account.");
      return;
    }

    setIsSavingPayment(true);
    try {
      await recordInvoicePayment(
        selectedInvoice.id,
        amt,
        parseInt(selectedAccount, 10),
        paymentDate
      );
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to record payment.");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this invoice?")) {
      try {
        await deleteInvoice(id);
        await loadData();
      } catch (e) {
        console.error("Failed to delete", e);
      }
    }
  };

  const handleSend = (id: string) => {
    const url = `${window.location.origin}/dashboard/invoice/${id}`;
    navigator.clipboard.writeText(url);
    alert("Invoice link copied to clipboard: " + url);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={4} />
        <SkeletonTable rows={5} />
      </div>
    );
  }

  const stats = [
    { label: "Total Issued", value: data.totalIssued.toString(), icon: FileText, color: "text-brand-400", bg: "bg-brand-400/10" },
    { label: "Paid", value: data.paid.toString(), icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Unpaid", value: data.pending.toString(), icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Overdue", value: data.overdue.toString(), icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10" },
  ];

  const filteredInvoices = data.items.filter((row: any) => {
    const statusMatch = activeFilter === "All" || row.status?.toLowerCase() === activeFilter.toLowerCase();
    const searchMatch =
      row.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.id.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-white"
          />
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
      </div>

      {/* Table */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] overflow-hidden shadow-xs" style={{ borderRadius: 16 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[#64748b] text-sm">
                <th className="p-4 font-medium">Invoice ID</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Payment Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
              {filteredInvoices.map((row: any) => {
                const paymentStatus = row.status?.toLowerCase() || '';

                let paymentColor = "text-[#64748b] bg-[#f1f5f9] border-[#cbd5e1]";
                if (paymentStatus === 'paid') paymentColor = "text-[#15803d] bg-emerald-50 border-emerald-200";
                else if (paymentStatus === 'advance-paid' || paymentStatus === 'advance paid') paymentColor = "text-[#0284c7] bg-sky-50 border-sky-200";
                else if (paymentStatus === 'partially-paid' || paymentStatus === 'partially paid') paymentColor = "text-[#7e22ce] bg-purple-50 border-purple-200";
                else if (paymentStatus === 'unpaid' || paymentStatus === 'pending') paymentColor = "text-[#b45309] bg-amber-50 border-amber-200";
                else if (paymentStatus === 'overdue') paymentColor = "text-[#b91c1c] bg-red-50 border-red-200";

                return (
                  <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="p-4 whitespace-nowrap">
                      <Link href={`/invoice/${row.id}`} className="font-bold text-[#b91c1c] hover:text-[#991b1b] transition-colors flex items-center gap-1.5 text-sm">
                        <FileText className="w-4 h-4 text-[#b91c1c]" />
                        {row.id}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-[#0f172a] font-medium">{row.client}</td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#0f172a]">{formatLKR(row.amount)}</span>
                        {paymentStatus !== 'paid' && row.totalDue > 0 && row.totalDue < row.amount && (
                          <span className="text-xs text-[#7e22ce] font-semibold mt-0.5" title="Remaining Balance">
                            Due: {formatLKR(row.totalDue)}
                          </span>
                        )}
                        {paymentStatus !== 'paid' && row.totalDue === row.amount && (
                          <span className="text-xs text-[#64748b] font-medium mt-0.5" title="Remaining Balance">
                            Due: {formatLKR(row.totalDue)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`p-4 text-sm whitespace-nowrap ${row.overdue ? 'text-[#b91c1c] font-semibold' : 'text-[#64748b]'}`}>
                      {row.due}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${paymentColor}`}>
                        {row.status?.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        {paymentStatus !== 'paid' && (
                          <button
                            onClick={() => openPaymentModal(row)}
                            title="Record Payment"
                            className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#15803d]"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/invoice/${row.id}?download=true`}
                          title="Download PDF"
                          className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#002f4c]"
                        >
                          <Download className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/invoices/${row.id}/edit`}
                          title="Edit Invoice"
                          className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#0f172a]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(row.id)}
                          title="Delete Invoice"
                          className="p-2 hover:bg-red-50 rounded-xl transition-colors text-[#64748b] hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#64748b]">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Payment Recording Modal */}
      {isModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020b12]/60 backdrop-blur-sm">
          <div className="bg-white border border-[#e2e8f0] p-6 w-full max-w-md shadow-2xl relative space-y-4" style={{ borderRadius: 16 }}>
            <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
            
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Invoice ID</p>
              <p className="text-brand-600 font-semibold">{selectedInvoice.id}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400">Client</p>
              <p className="text-white font-medium">{selectedInvoice.client}</p>
              {selectedInvoice.clientEmail && selectedInvoice.clientEmail !== selectedInvoice.client && (
                <p className="text-xs text-gray-400 font-medium">{selectedInvoice.clientEmail}</p>
              )}
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Amount:</span>
                <span className="text-white font-semibold">{formatLKR(selectedInvoice.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Remaining Due:</span>
                <span className="text-brand-400 font-semibold">{formatLKR(selectedInvoice.totalDue)}</span>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Amount Paid (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedInvoice.totalDue}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors"
                  placeholder="Enter amount"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Deposit to Account</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bankName || acc.type})
                    </option>
                  ))}
                  {accounts.length === 0 && (
                    <option value="">No accounts found</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSavingPayment}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={isSavingPayment}
                className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-full text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingPayment ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}