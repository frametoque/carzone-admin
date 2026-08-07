"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Download, ArrowLeft, Loader2, FileText, Calendar, Tag, Wallet, Landmark } from "lucide-react";
import Link from "next/link";
import { generateInvoicePDF } from "../InvoiceDocument";
import { getInvoiceByIdAdmin } from "../../actions/actions";

const paymentStatusStyles = {
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  "partially-paid": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "partially paid": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "advance-paid": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "advance paid": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  unpaid: "bg-red-500/20 text-red-400 border-red-500/30",
  overdue: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
};

const formatMoney = (value: any, currency = "LKR") => {
  const num = parseFloat(value);
  if (value === undefined || value === null || isNaN(num)) return "N/A";
  const currencySymbol = currency === "LKR" ? "Rs." : currency;
  return `${currencySymbol} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function AdminInvoicePage() {
  const { invoice_id } = useParams();
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [autoDownloaded, setAutoDownloaded] = useState(false);

  useEffect(() => {
    if (!invoice_id) return;
    const fetchInvoice = async () => {
      try {
        const data = await getInvoiceByIdAdmin(invoice_id as string);
        if (!data) throw new Error("Invoice not found");
        setInvoice(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoice_id]);

  // Auto-download if ?download=true
  useEffect(() => {
    if (invoice && searchParams.get("download") === "true" && !autoDownloaded) {
      setAutoDownloaded(true);
      handleDownload();
    }
  }, [invoice, searchParams, autoDownloaded]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdfBytes = await generateInvoicePDF(invoice);
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-center">
        <p className="text-red-400">{error || "Invoice not found"}</p>
        <Link href="/invoices" className="text-brand-400 text-sm mt-3 inline-block">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const lineItems = invoice.items || [];
  const currencyLabel = invoice.currency === "LKR" ? "Rs." : invoice.currency;
  const subtotal = parseFloat(invoice.subtotal || 0);
  const discount = parseFloat(invoice.discount || 0);
  const advance = parseFloat(invoice.advance || 0);
  const total = parseFloat(invoice.total ?? (subtotal - discount));
  const totalDue = parseFloat(invoice.total_due ?? (total - advance));

  return (
    <div className="space-y-6 pb-20">

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-3xl bg-brand-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloading ? "Generating PDF..." : "Download PDF"}
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 space-y-4 w-full">

          {/* Invoice Header */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Invoice #{invoice.invoice_id}</h1>
                <p className="text-gray-400 text-sm">{invoice.billing_address}</p>
              </div>
              {invoice.category && (
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  Category: {invoice.category}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
              Client Email: <span className="text-white">{invoice.user_email}</span>
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-start gap-4">
              <div className="p-2 rounded-3xl bg-brand-500/10">
                <FileText className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Invoice ID</p>
                <p className="text-white font-semibold">{invoice.invoice_id}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-start gap-4">
              <div className="p-2 rounded-3xl bg-brand-500/10">
                <Calendar className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Date</p>
                <p className="text-white font-semibold">{formatDate(invoice.date)}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-start gap-4">
              <div className="p-2 rounded-3xl bg-brand-500/10">
                <Wallet className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Remaining Balance</p>
                <p className="text-white font-semibold">{formatMoney(totalDue, invoice.currency)}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex items-start gap-4">
              <div className="p-2 rounded-3xl bg-brand-500/10">
                <Tag className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-2">Payment Status</p>
                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${paymentStatusStyles[invoice.payment_status as keyof typeof paymentStatusStyles] || paymentStatusStyles.unpaid}`}>
                  {invoice.payment_status || "unpaid"}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden mt-4">
              <div className="grid grid-cols-3 px-5 py-3 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>Description</span>
                <span className="text-center">Price</span>
                <span className="text-right">Total</span>
              </div>
              {lineItems.map((item: any, i: number) => (
                <div key={i} className="grid grid-cols-3 px-5 py-4 border-b border-white/5 last:border-0">
                  <span className="text-white text-sm">{item.description}</span>
                  <span className="text-gray-300 text-sm text-center">
                    {item.price ? `${currencyLabel} ${item.price}` : "-"}
                  </span>
                  <span className="text-white text-sm text-right font-medium">
                    {!isNaN(parseFloat(item.total))
                      ? `${currencyLabel} ${parseFloat(item.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "-"}
                  </span>
                </div>
              ))}

              {/* Billing Summary */}
              <div className="px-5 py-4 space-y-3 border-t border-white/10 bg-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-semibold">{formatMoney(subtotal, invoice.currency)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Discount</span>
                    <span className="text-red-400">− {formatMoney(discount, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-gray-300">Total</span>
                  <span className="text-white font-semibold">{formatMoney(total, invoice.currency)}</span>
                </div>
                {advance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Advance Paid</span>
                    <span className="text-green-400">− {formatMoney(advance, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-white font-semibold">Total Due</span>
                  <span className="text-white font-bold text-lg">{formatMoney(totalDue, invoice.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mt-4 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-brand-400" />
              Payment History
            </h2>

            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-xs uppercase font-semibold">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Account</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoice.payments.map((payment: any) => (
                      <tr key={payment.id} className="text-sm hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-gray-300">
                          {formatDate(payment.date)}
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          {payment.description || "Invoice payment"}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {payment.paymentMethod || "Bank Transfer"}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {payment.accountName}
                        </td>
                        <td className="py-3 px-4 text-right text-brand-400 font-semibold">
                          {formatMoney(payment.amount, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-2">No payments have been recorded for this invoice yet.</p>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}