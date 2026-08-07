"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Plus, Edit2, Trash2, Eye, Loader2, CheckCircle2, X, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  getQuotations, 
  deleteQuotation, 
  confirmQuotation,
  getQuotationById
} from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";
import { generateInvoicePDF } from "../invoice/InvoiceDocument";
import DateRangeSelector from "../components/DateRangeSelector";

const filters = ["All", "Brake", "Coolant", "Electronic Accessories", "Filters", "Modifications", "Oil", "Suspension", "Spare Parts"];

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

export default function QuotationsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("All");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmingLoading, setConfirmingLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("lifetime");
  const [startDate, setStartDate] = useState("1970-01-01");
  const [endDate, setEndDate] = useState("2099-12-31");

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

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getQuotations();
      setData(res);
    } catch (e) {
      console.error("Failed to load quotations", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (row: any) => {
    setDownloadingId(row.id);
    try {
      const fullQuotation = await getQuotationById(String(row.id));
      if (!fullQuotation) throw new Error("Quotation not found");
      const pdfBytes = await generateInvoicePDF(fullQuotation, true);
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QT-${row.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleConfirmDirect = async (quotationId: number, quotationData: any) => {
    if (!confirm("Are you sure you want to confirm this quotation and create an invoice?")) return;
    setConfirmingId(quotationId);
    setConfirmingLoading(true);
    try {
      await confirmQuotation(quotationId, quotationData);
      await loadData();
      alert("Quotation confirmed! Invoice has been created.");
    } catch (e) {
      console.error("Failed to confirm quotation", e);
      alert("Failed to confirm quotation");
    } finally {
      setConfirmingLoading(false);
      setConfirmingId(null);
    }
  };

const handleDelete = async (id: number) => {
  const quotation = data.items.find((q: any) => q.id === id);
  const isConfirmed = quotation?.status === 'confirmed';
  const message = isConfirmed
    ? "This quotation has a linked invoice. Deleting it will also delete the invoice. Are you sure?"
    : "Are you sure you want to delete this quotation?";

  if (confirm(message)) {
    try {
      await deleteQuotation(id);
      await loadData();
    } catch (e) {
      console.error("Failed to delete", e);
      alert("Failed to delete quotation");
    }
  }
};

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={3} />
        <SkeletonTable rows={5} />
      </div>
    );
  }

  const stats = [
    { label: "Total Quotations", value: data.items.length.toString(), icon: Wallet, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Confirmed", value: data.confirmedCount.toString(), icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Value", value: formatLKR(data.totalValue), icon: TrendingUp, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];

  const filteredQuotations = (data?.items || []).filter((row: any) => {
    const matchesCategory = activeFilter === "All" || (row.category && row.category.toLowerCase() === activeFilter.toLowerCase());
    if (!matchesCategory) return false;

    const rowDate = new Date(row.date);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return rowDate >= start && rowDate <= end;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'sent': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'draft': return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
      default: return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

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
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
              {filteredQuotations.map((row: any) => (
                <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="p-4 text-sm text-[#64748b] whitespace-nowrap">{row.date}</td>
                  <td className="p-4 font-semibold text-[#0284c7] whitespace-nowrap">{formatLKR(row.amount)}</td>
                  <td className="p-4 text-sm text-[#0f172a] font-medium">{row.client || '-'}</td>
                  <td className="p-4 text-sm text-[#334155]">{row.desc}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[#475569]">
                      {row.category}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border capitalize ${getStatusColor(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      {row.status !== 'confirmed' && (
                        <button 
                          onClick={() => handleConfirmDirect(row.id, row)}
                          className="p-2 hover:bg-emerald-50 rounded-xl transition-colors text-[#64748b] hover:text-[#15803d] disabled:opacity-50"
                          title="Confirm & create invoice"
                        >
                          {confirmingLoading && confirmingId === row.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#15803d]" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {row.status === 'confirmed' && (
                        <span className="p-2 text-[#15803d]" title="Quotation Confirmed">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                      {row.receiptUrl && (
                        <button onClick={() => setViewingReceipt(row)} className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#0284c7] hover:text-[#0369a1]">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDownloadPDF(row)}
                        disabled={downloadingId === row.id}
                        className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#002f4c] disabled:opacity-50"
                        title="Download Quotation PDF"
                      >
                        {downloadingId === row.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      <button onClick={() => router.push(`/quotations/${row.id}/edit`)} className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#0f172a]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-red-50 rounded-xl transition-colors text-[#64748b] hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748b]">No quotation records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Viewer Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
          <div className="relative flex flex-col md:flex-row bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" onClick={() => setViewingReceipt(null)}>
              ✕
            </button>
            
            <div className="w-full md:w-1/3 bg-white/5 p-6 sm:p-8 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Quotation Details</h3>
                <p className="text-sm text-gray-400">Quote Information</p>
              </div>
              
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Amount</p>
                  <p className="text-3xl font-bold text-blue-400">{formatLKR(viewingReceipt.amount)}</p>
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
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Category</p>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/10 border border-white/10 inline-block">
                    {viewingReceipt.category}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Status</p>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border capitalize inline-block ${getStatusColor(viewingReceipt.status)}`}>
                    {viewingReceipt.status}
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
                alt="Quotation Attachment" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-white/5"
              />
            </div>
          </div>
        </div>
      )}


    </div>
  );
}