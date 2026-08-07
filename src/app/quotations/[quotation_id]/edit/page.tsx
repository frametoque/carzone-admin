"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowLeft, Send, Save, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { updateQuotation, getQuotationById } from "../../../actions/actions";
import CategoryPicker from "../../../components/CategoryPicker";

/** Returns today's date as YYYY-MM-DD in local time (avoids UTC off-by-one). */
function localToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Formats a stored date (string or Date) as YYYY-MM-DD without UTC shifting. */
function toLocalDateInput(value: any) {
  if (!value) return localToday();
  const d = new Date(value);
  if (isNaN(d.getTime())) return localToday();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function EditQuotationPage() {
  const router = useRouter();
  const { quotation_id } = useParams();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotationStatus, setQuotationStatus] = useState<string>("draft");

  const [formData, setFormData] = useState({
    clientId: "",
    clientName: "",
    company: "",
    userEmail: "",
    phone: "",
    // billing address is sourced from admin_clients / users — written back on save
    billingAddress: "",
    description: "",
    date: localToday(),
    category: "Spare Parts",
    paymentMethod: "Bank Transfer",
    referenceDoc: "",
    notes: "",
    taxRate: 0,
    discount: 0,
    advance: 0,
  });

  const [lineItems, setLineItems] = useState([
    { id: 1, description: "", quantity: 1, rate: 0 },
  ]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Spare Parts"]);

  const ALL_CATEGORIES = ["Vehicle Sales", "Broker Commission", "Registration & Transfer Fees", "Inspection & Certification", "Financing & Lease Commission", "Other Services"];
  const categories = ALL_CATEGORIES;

  useEffect(() => {
    if (!quotation_id) return;
    const fetchQuotation = async () => {
      try {
        const data = await getQuotationById(quotation_id as string);
        if (!data) throw new Error("Quotation not found");

        setQuotationStatus(data.status || "draft");

        setFormData({
          clientId: "",
          clientName: data.client_name || "",
          company: data.company || "",
          userEmail: data.email || "",
          phone: data.phone || "",
          billingAddress: data.billing_address || "",
          description: data.description || "",
          date: toLocalDateInput(data.date),
          category: data.category || "Spare Parts",
          paymentMethod: data.payment_method || "Bank Transfer",
          referenceDoc: data.invoice_id || "",
          notes: "",
          taxRate: 0,
          discount: Number(data.discount) || 0,   // ← pulled from DB
          advance: Number(data.advance) || 0,
        });

        // Seed multi-select from stored comma-separated value
        setSelectedCategories(
          (data.category || "Spare Parts").split(",").map((s: string) => s.trim()).filter(Boolean)
        );

        if (data.items && data.items.length > 0) {
          setLineItems(data.items.map((item: any, index: number) => ({
            id: index + 1,
            description: item.description || "",
            quantity: item.quantity || 1,
            rate: parseFloat(item.price ?? item.rate) || 0
          })));
        } else {
          setLineItems([{ id: 1, description: "", quantity: 1, rate: 0 }]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotation();
  }, [quotation_id]);

  const handleFormChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineItemChange = (id: number, field: string, value: any) => {
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: Date.now(), description: "", quantity: 1, rate: 0 }
    ]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const taxAmount = subtotal * (formData.taxRate / 100);
  const discount = Number(formData.discount) || 0;
  const total = subtotal + taxAmount - discount;
  const advance = Number(formData.advance) || 0;
  const totalDue = total - advance;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
    }).format(amount || 0);
  };

  const isConfirmed = quotationStatus === 'confirmed';

  const handleSave = async () => {
    if (lineItems.every(item => !item.description)) {
      alert("Please add at least one line item with description.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await updateQuotation(parseInt(quotation_id as string), {
        date: formData.date,
        amount: total,
        advance,
        discount,                                // ← now sent to DB
        totalDue,
        billingAddress: formData.billingAddress,
        clientId: formData.clientId,
        description: formData.description,
        category: selectedCategories.join(", "),
        paymentMethod: formData.paymentMethod,
        invoiceId: formData.referenceDoc || null,
        receiptUrl: null
      }, lineItems);
      
      router.push("/quotations");
    } catch (e) {
      console.error(e);
      alert("Failed to update quotation");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-brand-400 animate-spin" /></div>;
  }

  if (error) {
    return <div className="text-center text-red-400 py-10">{error}</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/quotations" className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold">Edit Quotation</h1>
      </div>

      {isConfirmed && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-400">Quotation Confirmed</p>
            <p className="text-sm text-yellow-300 mt-1">This quotation has been confirmed and an invoice has been created. You cannot edit it.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-8">
          
          {/* Client Details */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Client Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Client Name</label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                  disabled={isConfirmed} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Company</label>
                <input type="text" name="company" value={formData.company} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                  disabled={isConfirmed} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Email</label>
                <input type="email" name="userEmail" value={formData.userEmail} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                  disabled={isConfirmed} placeholder="client@email.com (optional)" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Phone</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                  disabled={isConfirmed} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-400">
                Billing Address
                <span className="ml-2 text-xs text-brand-400/70">(saved to client profile)</span>
              </label>
              <textarea name="billingAddress" value={formData.billingAddress} onChange={handleFormChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors resize-none disabled:opacity-50"
                rows={2} placeholder="Street, City, Country..."
                disabled={isConfirmed} />
            </div>
          </div>

          {/* Quotation Details */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Quotation Details</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Date</label>
                <input type="date" name="date" value={formData.date} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                  disabled={isConfirmed} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-400">Description</label>
              <textarea name="description" value={formData.description} onChange={handleFormChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors resize-none disabled:opacity-50"
                rows={3} placeholder="Project scope and details..." disabled={isConfirmed} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Categories</label>
                <CategoryPicker categories={ALL_CATEGORIES} value={selectedCategories} onChange={setSelectedCategories} disabled={isConfirmed} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Payment Method</label>
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none disabled:opacity-50"
                  disabled={isConfirmed}>
                  <option className="bg-black">Bank Transfer</option>
                  <option className="bg-black">Stripe</option>
                  <option className="bg-black">PayPal</option>
                  <option className="bg-black">Cash</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-400">Reference Document (Optional)</label>
              <input type="text" name="referenceDoc" value={formData.referenceDoc} onChange={handleFormChange}
                placeholder="e.g. QT-2024-001"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                disabled={isConfirmed} />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Notes</h2>
            <textarea name="notes" value={formData.notes} onChange={handleFormChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors resize-none disabled:opacity-50"
              rows={3} placeholder="Terms, conditions, or special notes..." disabled={isConfirmed} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Services/Line Items</h2>
            
            <div className="space-y-3">
              {lineItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <input type="text" placeholder="Description" value={item.description}
                      onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm disabled:opacity-50"
                      disabled={isConfirmed} />
                  </div>
                  <div className="w-20 space-y-1">
                    <input type="number" placeholder="Qty" min="1" value={item.quantity}
                      onChange={(e) => handleLineItemChange(item.id, 'quantity', Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm disabled:opacity-50"
                      disabled={isConfirmed} />
                  </div>
                  <div className="w-28 space-y-1">
                    <input type="number" placeholder="Rate" min="0" step="0.01" value={item.rate || ""}
                      onChange={(e) => handleLineItemChange(item.id, 'rate', Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm disabled:opacity-50"
                      disabled={isConfirmed} />
                  </div>
                  <div className="w-24 py-2 text-right text-sm font-semibold">
                    {formatCurrency(item.quantity * item.rate)}
                  </div>
                  <button onClick={() => removeLineItem(item.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors mt-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isConfirmed}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {!isConfirmed && (
              <button onClick={addLineItem}
                className="flex items-center gap-2 text-sm text-brand-400 font-medium hover:text-brand-300 transition-colors mt-4">
                <Plus className="w-4 h-4" /> Add line item
              </button>
            )}

            <div className="border-t border-white/10 mt-6 pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Discount</span>
                <input type="number" name="discount" value={formData.discount || ""} onChange={handleFormChange} min="0"
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 outline-none focus:border-brand-500 transition-colors text-right text-sm disabled:opacity-50"
                  placeholder="0.00" disabled={isConfirmed} />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Tax Rate (%)</span>
                <input type="number" name="taxRate" value={formData.taxRate || ""} onChange={handleFormChange} min="0" max="100"
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 outline-none focus:border-brand-500 transition-colors text-right text-sm disabled:opacity-50"
                  placeholder="0" disabled={isConfirmed} />
              </div>
              {formData.taxRate > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Tax Amount</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-semibold border-t border-white/10 pt-3 text-brand-400">
                <span>Total Quotation</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Advance Payment */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-1">Advance Payment</h2>
            <p className="text-sm text-gray-400 mb-4">Specify any upfront payment required before work begins.</p>
            <div className="flex justify-between items-center text-sm">
              <label className="text-gray-400">Advance Amount</label>
              <input type="number" name="advance" value={formData.advance || ""} onChange={handleFormChange} min="0"
                className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-brand-500 transition-colors text-right text-sm disabled:opacity-50"
                placeholder="0.00" disabled={isConfirmed} />
            </div>
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Total Quotation</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Advance</span>
                <span className="text-green-400">− {formatCurrency(advance)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-semibold border-t border-white/10 pt-3 text-brand-400">
                <span>Balance Due</span>
                <span>{formatCurrency(totalDue)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-3xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isConfirmed}>
              <Save className="w-5 h-5" /> Save as Draft
            </button>
            <button onClick={handleSave} disabled={isSubmitting || isConfirmed}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Updating...</>
              ) : (
                <><Send className="w-5 h-5" /> Update Quotation</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}