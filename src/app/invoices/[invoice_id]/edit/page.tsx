"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowLeft, Send, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { updateInvoice, getInvoiceByIdAdmin, getClients, createClient } from "../../../actions/actions";
import CategoryPicker from "../../../components/CategoryPicker";

const ALL_CATEGORIES = ["Vehicle Sales", "Broker Commission", "Registration & Transfer Fees", "Inspection & Certification", "Financing & Lease Commission", "Other Services"];

const parseCategories = (raw: string | undefined): string[] => {
  if (!raw) return ["Spare Parts"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

export default function EditInvoicePage() {
  const router = useRouter();
  const { invoice_id } = useParams();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Spare Parts"]);

  const [newClientData, setNewClientData] = useState({
    name: "", email: "", company: "", phone: "", address: ""
  });

  const [formData, setFormData] = useState({
    clientId: "",
    clientName: "",
    company: "",
    userEmail: "",
    phone: "",
    billingAddress: "",
    date: new Date().toISOString().split("T")[0],
    currency: "LKR",
    notes: "",
    taxRate: 0,
    discount: 0,
    advance: 0,
    paymentStatus: "unpaid",
  });

  const [lineItems, setLineItems] = useState([
    { id: 1, description: "", quantity: 1, rate: 0 },
  ]);

  useEffect(() => {
    if (!invoice_id) return;
    const fetchInvoice = async () => {
      try {
        const [data, allClients] = await Promise.all([
          getInvoiceByIdAdmin(invoice_id as string),
          getClients(),
        ]);

        if (!data) throw new Error("Invoice not found");

        setClients(allClients);
        setClientsLoading(false);

        let formattedDate = "";
        try { formattedDate = new Date(data.date).toISOString().split("T")[0]; } catch (e) {}

        const matched = allClients.find(
          (c: any) => (data.client_id && c.id === data.client_id) || 
                      (!data.client_id && c.email?.toLowerCase() === (data.user_email || "").toLowerCase())
        );

        setFormData({
          clientId: matched?.id || "",
          clientName: matched?.name || "",
          company: matched?.company || "",
          userEmail: data.user_email || "",
          phone: matched?.phone || "",
          billingAddress: data.billing_address || matched?.address || "",
          date: formattedDate || new Date().toISOString().split("T")[0],
          currency: data.currency || "LKR",
          notes: "",
          taxRate: 0,
          discount: parseFloat(data.discount) || 0,
          advance: parseFloat(data.advance) || 0,
          paymentStatus: data.payment_status || "unpaid",
        });

        // Seed categories from stored value
        setSelectedCategories(parseCategories(data.category));

        if (data.items && data.items.length > 0) {
          setLineItems(data.items.map((item: any, index: number) => ({
            id: index + 1,
            description: item.description || "",
            quantity: item.quantity || 1,
            rate: parseFloat(item.price) || 0
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
    fetchInvoice();
  }, [invoice_id]);

  const handleFormChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === "clientId" && value && value !== "new") {
      const selected = clients.find(c => c.id === value);
      if (selected) {
        setFormData(prev => ({
          ...prev,
          clientId: value,
          clientName: selected.name || "",
          company: selected.company || "",
          userEmail: selected.email,
          phone: selected.phone || "",
          billingAddress: selected.address || "",
        }));
      }
    } else if (name === "clientId" && value === "new") {
      setShowNewClientForm(true);
    }
  };

  const handleNewClientChange = (e: any) => {
    const { name, value } = e.target;
    setNewClientData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateNewClient = async () => {
    if (!newClientData.name) {
      alert("Please enter client name");
      return;
    }
    try {
      const clientId = await createClient({
        name: newClientData.name,
        email: newClientData.email || null,
        company: newClientData.company || null,
        phone: newClientData.phone || null,
        address: newClientData.address || null,
      });
      const newClient = { id: clientId, ...newClientData };
      setClients(prev => [...prev, newClient]);
      setFormData(prev => ({
        ...prev,
        clientId,
        clientName: newClientData.name,
        company: newClientData.company,
        userEmail: newClientData.email,
        phone: newClientData.phone,
        billingAddress: newClientData.address,
      }));
      setShowNewClientForm(false);
      setNewClientData({ name: "", email: "", company: "", phone: "", address: "" });
    } catch (e) {
      alert("Failed to create client");
    }
  };

  const handleLineItemChange = (id: number, field: string, value: any) => {
    setLineItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: Date.now(), description: "", quantity: 1, rate: 0 }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length > 1) setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxAmount = subtotal * (formData.taxRate / 100);
  const total = subtotal + taxAmount - formData.discount;
  const totalDue = total - formData.advance;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(formData.currency === "LKR" ? "en-LK" : "en-US", {
      style: "currency", currency: formData.currency,
    }).format(amount || 0);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateInvoice(invoice_id as string, {
        ...formData,
        category: selectedCategories.join(", "),
        subtotal, total, totalDue,
      }, lineItems);
      router.push("/invoices");
    } catch (e) {
      console.error(e);
      alert("Failed to update invoice");
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-brand-400 animate-spin" /></div>;
  if (error) return <div className="text-center text-red-400 py-10">{error}</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/invoices" className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold">Edit Invoice</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">

          {/* Client Details */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Client Details</h2>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">Select Client</label>
              <select name="clientId" value={formData.clientId} onChange={handleFormChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                <option value="" className="bg-black">{clientsLoading ? "Loading clients..." : "Choose a client..."}</option>
                <option value="new" className="bg-brand-900">+ Create New Client</option>
                {clients.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name} ({c.email})</option>)}
              </select>
            </div>

            {showNewClientForm && (
              <div className="p-4 bg-black-500/10 border border-white/10 rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-brand-400">New Client Details</h3>
                <input type="text" name="name" placeholder="Client Name" value={newClientData.name} onChange={handleNewClientChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                <input type="email" name="email" placeholder="Email (Optional)" value={newClientData.email} onChange={handleNewClientChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                <input type="text" name="company" placeholder="Company (Optional)" value={newClientData.company} onChange={handleNewClientChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                <input type="text" name="phone" placeholder="Phone (Optional)" value={newClientData.phone} onChange={handleNewClientChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                <textarea name="address" placeholder="Billing Address (Optional)" value={newClientData.address} onChange={handleNewClientChange}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm resize-none" rows={2} />
                <div className="flex gap-2 pt-2">
                  <button onClick={handleCreateNewClient}
                    className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Create Client
                  </button>
                  <button onClick={() => { setShowNewClientForm(false); setFormData(prev => ({ ...prev, clientId: "" })); }}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {formData.clientId && !showNewClientForm && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-400">Client Name</label>
                    <input type="text" name="clientName" value={formData.clientName} onChange={handleFormChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-gray-400">Company</label>
                    <input type="text" name="company" value={formData.company} onChange={handleFormChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-400">Email</label>
                    <input type="email" name="userEmail" value={formData.userEmail} onChange={handleFormChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" placeholder="client@email.com (optional)" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-gray-400">Phone</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleFormChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">
                    Billing Address
                    <span className="ml-2 text-xs text-brand-400/70">(saved to client profile)</span>
                  </label>
                  <textarea name="billingAddress" value={formData.billingAddress} onChange={handleFormChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors resize-none"
                    rows={2} placeholder="Street, City, Country..." />
                </div>
              </>
            )}
          </div>

          {/* Invoice Details */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Date</label>
                <input type="date" name="date" value={formData.date} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors" />
              </div>
            </div>

            {/* Categories — full width */}
            <div className="space-y-1">
              <label className="text-sm text-gray-400">Categories</label>
              <CategoryPicker categories={ALL_CATEGORIES} value={selectedCategories} onChange={setSelectedCategories} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Currency</label>
                <select name="currency" value={formData.currency} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                  <option value="LKR" className="bg-black">LKR (₨)</option>
                  <option value="USD" className="bg-black">USD ($)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-400">Payment Status</label>
                <select name="paymentStatus" value={formData.paymentStatus} onChange={handleFormChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none">
                  <option value="unpaid" className="bg-black">Unpaid</option>
                  <option value="advance-paid" className="bg-black">Advance Paid</option>
                  <option value="partially-paid" className="bg-black">Partially Paid</option>
                  <option value="overdue" className="bg-black">Overdue</option>
                  <option value="paid" className="bg-black">Fully Paid</option>
                </select>
              </div>
            </div>


          </div>
        </div>

        {/* Right Column: Line Items & Actions */}
        <div className="space-y-8">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Line Items</h2>

            <div className="space-y-3">
              {lineItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex-1">
                    <input type="text" placeholder="Description" value={item.description}
                      onChange={(e) => handleLineItemChange(item.id, "description", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                  </div>
                  <div className="w-20">
                    <input type="number" placeholder="Qty" min="1" value={item.quantity}
                      onChange={(e) => handleLineItemChange(item.id, "quantity", Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                  </div>
                  <div className="w-28">
                    <input type="number" placeholder="Rate" min="0" step="0.01" value={item.rate || ""}
                      onChange={(e) => handleLineItemChange(item.id, "rate", Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm" />
                  </div>
                  <div className="w-24 py-2 text-right text-sm font-semibold">
                    {formatCurrency(item.quantity * item.rate)}
                  </div>
                  <button onClick={() => removeLineItem(item.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors mt-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addLineItem}
              className="flex items-center gap-2 text-sm text-brand-400 font-medium hover:text-brand-300 transition-colors mt-4">
              <Plus className="w-4 h-4" /> Add line item
            </button>

            <div className="border-t border-white/10 mt-6 pt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Discount</span>
                <input type="number" name="discount" value={formData.discount || ""} onChange={handleFormChange} min="0"
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 outline-none focus:border-brand-500 transition-colors text-right text-sm" placeholder="0.00" />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Tax Rate (%)</span>
                <input type="number" name="taxRate" value={formData.taxRate || ""} onChange={handleFormChange} min="0" max="100"
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 outline-none focus:border-brand-500 transition-colors text-right text-sm" placeholder="0" />
              </div>
              {formData.taxRate > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Tax Amount</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-semibold border-t border-white/10 pt-3">
                <span>Total</span>
                <span className="text-brand-400">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-3">
                <span className="text-gray-400">Advance Paid</span>
                <input type="number" name="advance" value={formData.advance || ""} onChange={handleFormChange} min="0"
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 outline-none focus:border-brand-500 transition-colors text-right text-sm" placeholder="0.00" />
              </div>
              <div className="flex justify-between items-center text-xl font-bold border-t border-white/10 pt-3 text-white">
                <span>Total Due</span>
                <span className="text-red-400">{formatCurrency(totalDue)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-3xl font-semibold transition-colors">
              <Save className="w-5 h-5" /> Save Draft
            </button>
            <button onClick={handleSave} disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed">
              <Send className="w-5 h-5" /> {isSubmitting ? "Updating..." : "Update Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}