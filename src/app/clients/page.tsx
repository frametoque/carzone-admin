"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Edit2, Trash2, X, Loader2, ChevronRight, Users, Crown, Sparkles, Clock, Cake, MessageSquare } from "lucide-react";
import Link from "next/link";
import { getClients, createClient, updateClient, deleteClient } from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";

const formatLKR = (amount: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount || 0);

const getBirthdayMessage = (clientName: string) => {
  return "\u{1F389} Happy Birthday, " + clientName + "! \u{1F382}\u{1F697}\n\nThe entire *Carz One Motor Trading* team wishes you a fantastic birthday filled with happiness, success, and unforgettable moments! \u{1F973}\u{2728}\n\nMay your journey ahead be filled with new opportunities, exciting adventures, and many miles of success. \u{1F6E3}\u{FE0F}\u{1F3C6}\n\n*Keep moving forward. Keep chasing your dreams!* \u{1F698}\u{1F4A8}\n\n*Carz One Motor Trading*";
};

const sendWhatsAppWish = (phone: string | undefined, clientName: string) => {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const rawText = getBirthdayMessage(clientName);
  const msg = encodeURIComponent(rawText);
  const url = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`;
  window.open(url, '_blank');
};

const emptyForm = { name: '', email: '', company: '', phone: '', address: '', birthday: '' };

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadData = async (isCurrent?: () => boolean) => {
    setLoading(true);
    try {
      const res = await getClients();
      if (isCurrent && !isCurrent()) return;
      setData(res);
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load clients", e);
      }
    } finally {
      if (!isCurrent || isCurrent()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => { 
    let current = true;
    loadData(() => current); 
    return () => { current = false; };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (client: any) => {
    setEditingId(client.id);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      company: client.company || '',
      phone: client.phone || '',
      address: client.address || '',
      birthday: client.birthday || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { alert("Client name is required."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateClient(editingId, {
          name: formData.name,
          email: formData.email.trim() || null,
          company: formData.company || null,
          phone: formData.phone || null,
          address: formData.address || null,
          birthday: formData.birthday || null,
        });
      } else {
        await createClient({
          name: formData.name,
          email: formData.email.trim() || null,
          company: formData.company || null,
          phone: formData.phone || null,
          address: formData.address || null,
          birthday: formData.birthday || null,
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to save client.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: any) => {
    if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to delete client.");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const handleSearch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (typeof customEvent.detail === "string") {
        setSearchTerm(customEvent.detail);
      }
    };
    const handleOpenNew = () => openNew();

    window.addEventListener("clients:search", handleSearch);
    window.addEventListener("clients:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("clients:search", handleSearch);
      window.removeEventListener("clients:open-new", handleOpenNew);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={4} />
        <SkeletonTable rows={5} />
      </div>
    );
  }

  // ----- Derived stats -----
  const byRevenue = [...data].sort((a, b) => b.revenue - a.revenue);
  const topClient = byRevenue[0] ?? null;
  const recentClient = data[0] ?? null;

  const stats = [
    {
      label: "Total Clients",
      value: data.length.toString(),
      sub: null,
      icon: Users,
      color: "text-brand-400",
      bg: "bg-brand-400/10",
    },
    {
      label: "Top by Revenue",
      value: topClient ? topClient.name : "—",
      sub: topClient ? formatLKR(topClient.revenue) : null,
      icon: Crown,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Highest Value",
      value: topClient ? formatLKR(topClient.revenue) : "—",
      sub: topClient ? topClient.name : null,
      icon: Sparkles,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Recent Client",
      value: recentClient ? recentClient.name : "—",
      sub: recentClient ? recentClient.email : null,
      icon: Clock,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
  ];

  const filteredClients = data.filter((client: any) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.company || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLinked = (c: any) =>
    c.invoices > 0 || c.incomeCount > 0 || c.projectCount > 0;

  return (
    <div className="space-y-6">

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-colors min-w-0">
            <div className={`p-4 rounded-2xl flex-shrink-0 ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-xl font-semibold truncate" title={stat.value}>{stat.value}</p>
              {stat.sub && (
                <p className="text-xs text-gray-500 truncate mt-0.5" title={stat.sub}>{stat.sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[#64748b] text-sm">
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium hidden md:table-cell">Company</th>
                <th className="p-4 font-medium hidden sm:table-cell">Phone</th>
                <th className="p-4 font-medium hidden lg:table-cell">Status</th>
                <th className="p-4 font-medium hidden sm:table-cell">Invoices</th>
                <th className="p-4 font-medium">Revenue</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
              {filteredClients.map((client: any) => {
                const linked = isLinked(client);
                const isDeleting = deletingId === client.id;
                const deleteTitle = linked
                  ? `Cannot delete — this client has linked invoices, income, or projects`
                  : `Delete ${client.name}`;

                // Check if client has a birthday today
                let isBirthdayToday = false;
                if (client.birthday) {
                  const parts = client.birthday.split('-');
                  if (parts.length >= 3) {
                    const month = parseInt(parts[1], 10);
                    const day = parseInt(parts[2], 10);
                    const now = new Date();
                    isBirthdayToday = (month === (now.getMonth() + 1)) && (day === now.getDate());
                  }
                }

                return (
                  <tr key={client.id} className="hover:bg-[#f8fafc] transition-colors group">
                    <td className="p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#0f172a] text-sm">{client.name}</p>
                          {isBirthdayToday && (
                            <button
                              onClick={() => sendWhatsAppWish(client.phone, client.name)}
                              title={`Send WhatsApp Birthday Wish to ${client.name}`}
                              className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-full text-amber-900 transition-colors flex items-center gap-1 text-[11px] font-bold animate-pulse"
                            >
                              <Cake className="w-3 h-3 text-amber-600" />
                              <span>Birthday Wish</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#64748b]">{client.email || 'No email'}</p>
                      </div>
                    </td>
                    <td className="p-4 text-sm hidden md:table-cell">
                      {client.company
                        ? <span className="text-[#002f4c] font-semibold">{client.company}</span>
                        : <span className="text-[#94a3b8]">—</span>}
                    </td>
                    <td className="p-4 text-sm text-[#334155] hidden sm:table-cell whitespace-nowrap">
                      {client.phone || <span className="text-[#94a3b8]">—</span>}
                    </td>
                    <td className="p-4 hidden lg:table-cell whitespace-nowrap">
                      {client.active
                        ? <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-[#15803d] border border-emerald-200">Active</span>
                        : <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-[#64748b] border border-slate-200">Inactive</span>}
                    </td>
                    <td className="p-4 text-sm text-[#334155] hidden sm:table-cell whitespace-nowrap">
                      {client.invoices}
                    </td>
                    <td className="p-4 font-semibold text-[#15803d] text-sm whitespace-nowrap">
                      {formatLKR(client.revenue)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Send WhatsApp Birthday Wish (only if today is birthday) */}
                        {isBirthdayToday && (
                          <button
                            onClick={() => sendWhatsAppWish(client.phone, client.name)}
                            title={`Send WhatsApp Birthday Wish to ${client.name}`}
                            className="p-2 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors text-amber-700 font-medium"
                          >
                            <Cake className="w-4 h-4 text-amber-600" />
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(client)}
                          title="Edit client"
                          className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#0f172a]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete — disabled if linked */}
                        <button
                          onClick={() => !linked && !isDeleting && handleDelete(client)}
                          title={deleteTitle}
                          disabled={linked || isDeleting}
                          className={`p-2 rounded-xl transition-colors ${
                            linked
                              ? "text-[#cbd5e1] cursor-not-allowed"
                              : isDeleting
                              ? "text-red-500 opacity-50 cursor-wait"
                              : "text-[#64748b] hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {isDeleting
                            ? <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>

                        {/* View profile */}
                        <Link
                          href={`/clients/${client.id}`}
                          title="View client profile & history"
                          className="p-2 hover:bg-[#f1f5f9] rounded-xl transition-colors text-[#64748b] hover:text-[#002f4c]"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748b]">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-400/10 rounded-xl">
                  <Users className="w-5 h-5 text-brand-400" />
                </div>
                <h2 className="text-xl font-semibold">
                  {editingId ? 'Edit Client' : 'Add New Client'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Email change cascade warning — only shown in edit mode */}
              {editingId && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl">
                  <span className="text-amber-400 text-lg leading-none mt-0.5">⚠</span>
                  <p className="text-xs text-brand-300 leading-relaxed">
                    Changing the email will automatically update all linked <strong>invoices</strong> and <strong>projects</strong> to use the new address.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-sm text-gray-400">Full Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-sm text-gray-400">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="(optional)"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Company</label>
                  <input
                    type="text"
                    placeholder="(optional)"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Phone</label>
                  <input
                    type="tel"
                    placeholder="(optional)"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Birthday</label>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-400">Address</label>
                  <input
                    type="text"
                    placeholder="(optional)"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-full font-medium hover:bg-white/10 transition-colors text-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-full font-medium transition-colors disabled:opacity-50 text-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : (editingId ? 'Update Client' : 'Add Client')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}