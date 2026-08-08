"use client";

import { useEffect, useState } from "react";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Landmark, 
  Wallet, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign,
  ArrowLeftRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  getAccounts, 
  createAccount, 
  updateAccount, 
  deleteAccount,
  createManualJournalEntry
} from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "bank", // 'bank' or 'cash'
    bankName: "",
    accountNumber: "",
    branch: "",
    initialBalance: ""
  });

  const [saving, setSaving] = useState(false);

  // Transfer Cash Modal States
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    date: new Date().toISOString().split("T")[0],
    fromAccountId: "" as number | "",
    toAccountId: "" as number | "",
    amount: "",
    description: ""
  });
  const [transferSaving, setTransferSaving] = useState(false);

  const openTransferModal = () => {
    setTransferData({
      date: new Date().toISOString().split("T")[0],
      fromAccountId: "",
      toAccountId: "",
      amount: "",
      description: ""
    });
    setIsTransferOpen(true);
  };

  const handleSaveTransfer = async () => {
    const { date, fromAccountId, toAccountId, amount, description } = transferData;
    if (!fromAccountId || !toAccountId) {
      alert("Please select both Source and Destination accounts.");
      return;
    }
    if (fromAccountId === toAccountId) {
      alert("Source and Destination accounts must be different.");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    setTransferSaving(true);
    try {
      const lines = [
        { accountId: Number(fromAccountId), debit: 0, credit: amt },
        { accountId: Number(toAccountId), debit: amt, credit: 0 }
      ];

      const memo = description.trim() || `Transfer from ${accounts.find(a => a.id === Number(fromAccountId))?.name} to ${accounts.find(a => a.id === Number(toAccountId))?.name}`;

      await createManualJournalEntry(new Date(date), memo, lines, 'transfer');

      setIsTransferOpen(false);
      await loadAccounts();
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to save transfer.");
    } finally {
      setTransferSaving(false);
    }
  };

  const loadAccounts = async (isCurrent?: () => boolean) => {
    setLoading(true);
    try {
      const data = await getAccounts();
      if (isCurrent && !isCurrent()) return;
      setAccounts(data);
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load accounts", e);
      }
    } finally {
      if (!isCurrent || isCurrent()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    loadAccounts(() => active);
    return () => { active = false; };
  }, []);

  // Account balance aggregates
  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const bankBalance = accounts.filter(a => a.type === "bank").reduce((sum, a) => sum + a.currentBalance, 0);
  const cashBalance = accounts.filter(a => a.type === "cash").reduce((sum, a) => sum + a.currentBalance, 0);

  const openNew = () => {
    setEditingId(null);
    setFormData({
      name: "",
      type: "bank",
      bankName: "",
      accountNumber: "",
      branch: "",
      initialBalance: "0"
    });
    setIsModalOpen(true);
  };

  const handleEdit = (acc: any) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      type: acc.type,
      bankName: acc.bankName || "",
      accountNumber: acc.accountNumber || "",
      branch: acc.branch || "",
      initialBalance: acc.initialBalance.toString()
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Account name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        initialBalance: parseFloat(formData.initialBalance) || 0
      };

      if (editingId) {
        await updateAccount(editingId, payload);
      } else {
        await createAccount(payload);
      }
      setIsModalOpen(false);
      await loadAccounts();
    } catch (e) {
      console.error("Failed to save account", e);
      alert("Error saving account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this account? This will delete all its ledger entries. Incomes and expenses linked to it will remain but will be set to no account.")) {
      try {
        await deleteAccount(id);
        await loadAccounts();
      } catch (e) {
        console.error("Failed to delete account", e);
        alert("Failed to delete account.");
      }
    }
  };

  useEffect(() => {
    const handleTransfer = () => openTransferModal();
    const handleNew = () => openNew();
    window.addEventListener("accounts:open-transfer", handleTransfer);
    window.addEventListener("accounts:open-new", handleNew);
    return () => {
      window.removeEventListener("accounts:open-transfer", handleTransfer);
      window.removeEventListener("accounts:open-new", handleNew);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={3} />
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-all duration-200">
          <div className="p-4 rounded-2xl bg-brand-400/10 text-brand-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Assets Balance</p>
            <p className={`text-2xl font-bold ${
              totalBalance < 0 ? "text-red-400" : totalBalance > 0 ? "text-green-400" : "text-white"
            }`}>{formatLKR(totalBalance)}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-all duration-200">
          <div className="p-4 rounded-2xl bg-green-400/10 text-green-400">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Bank Accounts Balance</p>
            <p className={`text-2xl font-bold ${
              bankBalance < 0 ? "text-red-400" : bankBalance > 0 ? "text-green-400" : "text-white"
            }`}>{formatLKR(bankBalance)}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-all duration-200">
          <div className="p-4 rounded-2xl bg-blue-400/10 text-blue-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Cash Accounts Balance</p>
            <p className={`text-2xl font-bold ${
              cashBalance < 0 ? "text-red-400" : cashBalance > 0 ? "text-green-400" : "text-white"
            }`}>{formatLKR(cashBalance)}</p>
          </div>
        </div>
      </div>

      {/* Grid list of accounts */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 animate-pulse">Loading Accounts...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <motion.div
              key={acc.id}
              whileHover={{ y: -4, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between h-[220px] transition-all duration-200"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${acc.type === "bank" ? "bg-green-400/10 text-green-400" : "bg-blue-400/10 text-blue-400"}`}>
                      {acc.type === "bank" ? <Landmark className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">{acc.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{acc.type} Account</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(acc)}
                      className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors"
                      title="Edit Account"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-2 hover:bg-white/10 text-red-500/80 hover:text-red-500 rounded-xl transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {acc.type === "bank" && (
                  <div className="mt-4 text-xs text-gray-400 space-y-0.5">

                    <p><span className="font-medium text-gray-300">A/C:</span> {acc.accountNumber}</p>
                    {acc.branch && <p><span className="font-medium text-gray-300">Branch:</span> {acc.branch}</p>}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-end">
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex items-center gap-1 text-green-400/95 font-medium">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Inflow: {formatLKR(acc.totalInflow)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400/95 font-medium">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Outflow: {formatLKR(acc.totalOutflow)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-xs block">Current Balance</span>
                  <span className={`font-bold text-xl ${
                    acc.currentBalance < 0 ? "text-red-400" : acc.currentBalance > 0 ? "text-green-400" : "text-white"
                  }`}>{formatLKR(acc.currentBalance)}</span>
                </div>
              </div>
            </motion.div>
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full bg-white/5 border border-dashed border-white/15 rounded-3xl p-12 text-center text-gray-400">
              No accounts registered yet. Click "Add Account" to get started.
            </div>
          )}
        </div>
      )}

      {/* Account Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-6"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-xl font-bold text-gray-900">{editingId ? "Edit Account" : "Create Account"}</h3>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Account Name</label>
                  <input
                    type="text"
                    placeholder="e.g. BOC Current A/C"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                  />
                </div>

                {/* Type */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Account Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, bankName: "", accountNumber: "", branch: "" })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm cursor-pointer appearance-none text-gray-900"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash/Cashier Drawer</option>
                  </select>
                </div>

                {/* Bank Fields (Only visible if type === 'bank') */}
                {formData.type === "bank" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Bank of Ceylon"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-medium">Account Number</label>
                        <input
                          type="text"
                          placeholder="e.g. 12345678"
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                          className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-medium">Branch</label>
                        <input
                          type="text"
                          placeholder="e.g. Colombo Main"
                          value={formData.branch}
                          onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                          className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Initial Balance */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Initial Balance (LKR)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    disabled={!!editingId}
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm disabled:opacity-50 text-gray-900"
                  />
                  {!editingId && (
                    <p className="text-[10px] text-gray-400">Note: Initial balance cannot be edited after creation.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md shadow-brand-500/20 transition-colors active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Account"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Cash Modal */}
      <AnimatePresence>
        {isTransferOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-6"
            >
              <button
                onClick={() => setIsTransferOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-xl font-bold text-gray-900">Transfer Cash</h3>
                <p className="text-xs text-gray-500 mt-1">Move funds between asset accounts</p>
              </div>

              <div className="space-y-4">
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Date</label>
                  <input
                    type="date"
                    value={transferData.date}
                    onChange={(e) => setTransferData({ ...transferData, date: e.target.value })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                  />
                </div>

                {/* From Account */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Source Account (From)</label>
                  <select
                    value={transferData.fromAccountId}
                    onChange={(e) => setTransferData({ ...transferData, fromAccountId: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900 cursor-pointer appearance-none"
                  >
                    <option value="">Select Source Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === Number(transferData.toAccountId)}>
                        {acc.name} ({formatLKR(acc.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Account */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Destination Account (To)</label>
                  <select
                    value={transferData.toAccountId}
                    onChange={(e) => setTransferData({ ...transferData, toAccountId: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900 cursor-pointer appearance-none"
                  >
                    <option value="">Select Destination Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === Number(transferData.fromAccountId)}>
                        {acc.name} ({formatLKR(acc.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Amount (LKR)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                  />
                </div>

                {/* Memo */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">Description</label>
                  <input
                    type="text"
                    placeholder="Description"
                    value={transferData.description}
                    onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-gray-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsTransferOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTransfer}
                  disabled={transferSaving}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md shadow-brand-500/20 transition-colors active:scale-95 disabled:opacity-50"
                >
                  {transferSaving ? "Saving..." : "Transfer Funds"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
