"use client";

import { useEffect, useState } from "react";
import { 
  Landmark, 
  Wallet, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  FileText,
  BookOpen,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DateRangeSelector from "../components/DateRangeSelector";
import { 
  getAccounts, 
  getAccountLedger, 
  getMainLedger,
  createManualJournalEntry,
  updateManualJournalEntry,
  deleteJournalEntry,
  getJournalEntry
} from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

const formatRefId = (type: string, id: string) => {
  if (!id) return "";
  const cleanType = (type || "").toLowerCase();
  if (cleanType === "transfer" || cleanType === "manual" || cleanType === "initial") {
    if (id.includes("-")) {
      const parts = id.split("-");
      if (parts.length > 2) {
        // Long format (prefix-timestamp-random): shorten to prefix-random
        return `${parts[0]}-${parts[2]}`;
      }
    }
    return id;
  }
  return `${cleanType.toUpperCase()}-${id}`;
};

export default function LedgersPage() {
  const [activeTab, setActiveTab] = useState<"general" | "individual">("general");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("lifetime");
  const [startDate, setStartDate] = useState("1970-01-01");
  const [endDate, setEndDate] = useState("2099-12-31");
  const [searchTerm, setSearchTerm] = useState("");

  // Transfer Cash Modal States
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferEditingRefId, setTransferEditingRefId] = useState<string | null>(null);
  const [transferData, setTransferData] = useState({
    date: new Date().toISOString().split("T")[0],
    fromAccountId: "" as number | "",
    toAccountId: "" as number | "",
    amount: "",
    description: ""
  });
  const [transferSaving, setTransferSaving] = useState(false);

  const openTransferModal = () => {
    setTransferEditingRefId(null);
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

      if (transferEditingRefId) {
        await updateManualJournalEntry(transferEditingRefId, new Date(date), memo, lines, 'transfer');
      } else {
        await createManualJournalEntry(new Date(date), memo, lines, 'transfer');
      }

      setIsTransferOpen(false);
      await Promise.all([loadAccounts(), loadLedgerData()]);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to save transfer.");
    } finally {
      setTransferSaving(false);
    }
  };

  const handleDelete = async (refId: string) => {
    if (confirm(`Are you sure you want to delete this journal entry (${refId})? This will revert all associated account balances.`)) {
      try {
        await deleteJournalEntry(refId);
        await Promise.all([loadAccounts(), loadLedgerData()]);
      } catch (e) {
        console.error("Failed to delete entry", e);
        alert("Failed to delete journal entry.");
      }
    }
  };

  const handleEdit = async (refType: string, refId: string) => {
    try {
      const lines = await getJournalEntry(refId);
      if (lines.length === 0) return;

      const dateStr = new Date(lines[0].date).toISOString().split('T')[0];

      if (refType === 'transfer') {
        const creditLine = lines.find(l => l.credit > 0);
        const debitLine = lines.find(l => l.debit > 0);

        setTransferEditingRefId(refId);
        setTransferData({
          date: dateStr,
          fromAccountId: creditLine ? creditLine.accountId : "",
          toAccountId: debitLine ? debitLine.accountId : "",
          amount: creditLine ? creditLine.credit.toString() : (debitLine ? debitLine.debit.toString() : ""),
          description: lines[0].description || ""
        });
        setIsTransferOpen(true);
      }
    } catch (e) {
      console.error("Failed to load journal entry for editing", e);
      alert("Error loading entry data.");
    }
  };

  const loadAccounts = async (isCurrent?: () => boolean) => {
    try {
      const data = await getAccounts();
      if (isCurrent && !isCurrent()) return;
      setAccounts(data);
      if (data.length > 0 && selectedAccountId === "") {
        setSelectedAccountId(data[0].id);
      }
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load accounts", e);
      }
    }
  };

  const loadLedgerData = async (isCurrent?: () => boolean) => {
    setLoading(true);
    try {
      if (activeTab === "general") {
        const data = await getMainLedger("lifetime");
        if (isCurrent && !isCurrent()) return;
        setEntries(data);
      } else if (activeTab === "individual" && selectedAccountId !== "") {
        const data = await getAccountLedger(Number(selectedAccountId), "lifetime");
        if (isCurrent && !isCurrent()) return;
        setEntries(data);
      } else {
        if (!isCurrent || isCurrent()) {
          setEntries([]);
        }
      }
    } catch (e) {
      if (!isCurrent || isCurrent()) {
        console.error("Failed to load ledger data", e);
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

  useEffect(() => {
    let active = true;
    loadLedgerData(() => active);
    return () => { active = false; };
  }, [activeTab, selectedAccountId]);

  const selectedAccount = accounts.find(a => a.id === Number(selectedAccountId));

  // Ledger Summary calculations based on current entries
  const filteredEntries = entries.filter((row: any) => {
    const matchesSearch = searchTerm === "" || 
      (row.description || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (row.accountName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.refType || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.refId || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    const rowDate = new Date(row.date);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return rowDate >= start && rowDate <= end;
  });

  const totalInflow = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalOutflow = filteredEntries.reduce((sum, e) => sum + e.credit, 0);
  const netFlow = totalInflow - totalOutflow;

  const currentBalance = activeTab === "general" 
    ? accounts.reduce((sum, a) => sum + a.currentBalance, 0)
    : (selectedAccount ? selectedAccount.currentBalance : 0);

  useEffect(() => {
    const handleTransfer = () => openTransferModal();
    window.addEventListener("ledgers:open-transfer", handleTransfer);
    return () => {
      window.removeEventListener("ledgers:open-transfer", handleTransfer);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={3} />
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Navigation */}
      <div className="flex flex-wrap items-center justify-start gap-4 mb-6">
        <div className="bg-white/5 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "general"
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            General Ledger
          </button>
          <button
            onClick={() => setActiveTab("individual")}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === "individual"
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Account Ledgers
          </button>
        </div>

        {/* Merged Inline Select Account Dropdown */}
        {activeTab === "individual" && accounts.length > 0 && (
          <div className="relative flex items-center">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value === "" ? "" : Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-full pl-5 pr-10 py-2 outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer text-sm font-semibold text-white h-[42px]"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-black">
                  {acc.name} ({acc.type.toUpperCase()})
                </option>
              ))}
            </select>
            <span className="absolute right-4 pointer-events-none text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-all duration-200">
          <div className="p-4 rounded-2xl bg-brand-400/10 text-brand-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">{activeTab === "general" ? "Total Ledger Cash assets" : "Account Book Balance"}</p>
            <p className="text-2xl font-bold">{formatLKR(currentBalance)}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-all duration-200">
          <div className="p-4 rounded-2xl bg-green-400/10 text-green-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Period Inflow (Debit)</p>
            <p className="text-2xl font-bold text-green-400">+{formatLKR(totalInflow)}</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-all duration-200">
          <div className="p-4 rounded-2xl bg-red-400/10 text-red-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Period Outflow (Credit)</p>
            <p className="text-2xl font-bold text-red-400">-{formatLKR(totalOutflow)}</p>
          </div>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-400" />
            {activeTab === "general" ? "General Ledger Book" : `Ledger: ${selectedAccount?.name || "Select Account"}`}
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-brand-500 transition-colors text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading Ledger Entries...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/2 text-gray-400 font-medium">
                  <th className="p-4 pl-6">Date</th>
                  {activeTab === "general" && <th className="p-4">Account</th>}
                  <th className="p-4">Description</th>
                  <th className="p-4">Reference</th>
                  <th className="p-4 text-right">Debit (+)</th>
                  <th className="p-4 text-right">Credit (-)</th>
                  <th className="p-4 pr-6 text-right">Running Balance</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEntries
                  .map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/2 transition-colors">
                      <td className="p-4 pl-6 text-gray-400 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      {activeTab === "general" && (
                        <td className="p-4 whitespace-nowrap font-semibold">
                          <span className="flex items-center gap-2">
                            <span className={entry.accountType === "bank" ? "text-green-400" : "text-blue-400"}>
                              {entry.accountType === "bank" ? <Landmark className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                            </span>
                            {entry.accountName}
                          </span>
                        </td>
                      )}
                      <td className="p-4 font-medium text-white max-w-[220px] min-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis group/desc relative" title={entry.description || "Transaction"}>
                        <span className="block truncate">{entry.description || "Transaction"}</span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {entry.refType ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            entry.refType === "income" 
                              ? "bg-green-500/10 text-green-400 border-green-500/20" 
                              : entry.refType === "expense" 
                                ? "bg-red-500/10 text-red-400 border-red-500/20" 
                                : entry.refType === "transfer"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                  : entry.refType === "manual"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}>
                            <FileText className="w-3 h-3" />
                            {formatRefId(entry.refType, entry.refId)}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold text-green-400 whitespace-nowrap">
                        {entry.debit > 0 ? `+${formatLKR(entry.debit)}` : "-"}
                      </td>
                      <td className="p-4 text-right font-semibold text-red-400 whitespace-nowrap">
                        {entry.credit > 0 ? `-${formatLKR(entry.credit)}` : "-"}
                      </td>
                      <td className={`p-4 pr-6 text-right font-bold whitespace-nowrap ${
                        entry.runningBalance < 0 ? "text-red-400" : entry.runningBalance > 0 ? "text-green-400" : "text-white"
                      }`}>
                        {formatLKR(entry.runningBalance)}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {entry.refType === "transfer" ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEdit(entry.refType, entry.refId)}
                              className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                              title="Edit Entry"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry.refId)}
                              className="p-1.5 hover:bg-white/10 text-red-500/80 hover:text-red-500 rounded-lg transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : entry.refType === "manual" ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDelete(entry.refId)}
                              className="p-1.5 hover:bg-white/10 text-red-500/80 hover:text-red-500 rounded-lg transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}

                 {filteredEntries.length === 0 && (
                   <tr>
                     <td colSpan={activeTab === "general" ? 8 : 7} className="p-12 text-center text-gray-500">
                       No transaction entries found in the ledger for this range.
                     </td>
                   </tr>
                 )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                className="absolute top-4 right-4 p-2 hover:bg-[#f1f5f9] rounded-full transition-colors text-[#64748b] hover:text-[#0f172a]"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-xl font-bold text-[#0f172a]">
                  {transferEditingRefId ? "Edit Cash Transfer" : "Transfer Cash"}
                </h3>
                <p className="text-xs text-[#64748b] mt-1">Move funds between asset accounts</p>
              </div>

              <div className="space-y-4">
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#475569]">Date</label>
                  <input
                    type="date"
                    value={transferData.date}
                    onChange={(e) => setTransferData({ ...transferData, date: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-[#0f172a]"
                  />
                </div>

                {/* From Account */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#475569]">Source Account (From)</label>
                  <select
                    value={transferData.fromAccountId}
                    onChange={(e) => setTransferData({ ...transferData, fromAccountId: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-[#0f172a] cursor-pointer appearance-none"
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
                  <label className="text-xs font-medium text-[#475569]">Destination Account (To)</label>
                  <select
                    value={transferData.toAccountId}
                    onChange={(e) => setTransferData({ ...transferData, toAccountId: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-[#0f172a] cursor-pointer appearance-none"
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
                  <label className="text-xs font-medium text-[#475569]">Amount (LKR)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-[#0f172a]"
                  />
                </div>

                {/* Memo */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#475569]">Description</label>
                  <input
                    type="text"
                    placeholder="Description"
                    value={transferData.description}
                    onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm text-[#0f172a]"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-[#e2e8f0]">
                <button
                  onClick={() => setIsTransferOpen(false)}
                  className="bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTransfer}
                  disabled={transferSaving}
                  className="bg-brand-600 hover:bg-brand-700 text-[#ffffff] px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md transition-colors active:scale-95 disabled:opacity-50"
                >
                  {transferSaving ? "Saving..." : transferEditingRefId ? "Update Transfer" : "Transfer Funds"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
