"use client";

import { useEffect, useState, Fragment } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Download, 
  FileText, 
  Calendar, 
  Users, 
  Info,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getReports, getClients, getMainLedger } from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";
import DateRangeSelector from "../components/DateRangeSelector";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { getCachedData, setCachedData } from "@/lib/cache";
import { jsPDF } from "jspdf";

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "ledger" | "pnl" | "trial">("overview");
  
  // Date filters state
  const [pnlDateRange, setPnlDateRange] = useState("this year");
  const [pnlStartDate, setPnlStartDate] = useState("2026-01-01");
  const [pnlEndDate, setPnlEndDate] = useState("2026-07-14");
  const [pnlReportType, setPnlReportType] = useState("Accrual (Paid & Unpaid)");

  const [tbAsOfDate, setTbAsOfDate] = useState("2026-07-14");
  const [tbReportType, setTbReportType] = useState("Accrual (Paid & Unpaid)");

  const [data, setData] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Overview Search / Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [journalFilter, setJournalFilter] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      const cacheKey = "reports_lifetime";
      const cached = getCachedData(cacheKey);
      if (cached) {
        setData(cached.res);
        setClients(cached.cls);
        setLedgerEntries(cached.ledger);
        setLoading(false); // Instant load
      } else {
        setLoading(true);
      }

      try {
        const [res, cls, ledger] = await Promise.all([
          getReports(pnlDateRange, pnlStartDate, pnlEndDate),
          getClients(),
          getMainLedger(pnlDateRange, pnlStartDate, pnlEndDate)
        ]);
        if (active) {
          setData(res);
          setClients(cls);
          setLedgerEntries(ledger);
          setCachedData(cacheKey, { res, cls, ledger });
        }
      } catch (e) {
        if (active) {
          console.error("Failed to load reports", e);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [pnlDateRange, pnlStartDate, pnlEndDate]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("reports:tab-change", { detail: activeTab }));
  }, [activeTab]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("reports:as-of-date-sync", { detail: tbAsOfDate }));
  }, [tbAsOfDate]);

  useEffect(() => {
    const handleDateRangeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ range: string; startDate: string; endDate: string }>;
      if (customEvent.detail) {
        setPnlDateRange(customEvent.detail.range);
        setPnlStartDate(customEvent.detail.startDate);
        setPnlEndDate(customEvent.detail.endDate);
      }
    };
    const handleTbAsOfDateChange = (e: Event) => {
      const customEvt = e as CustomEvent<string>;
      if (customEvt.detail) {
        setTbAsOfDate(customEvt.detail);
      }
    };
    window.addEventListener("admin:date-range-change", handleDateRangeChange);
    window.addEventListener("reports:as-of-date-change", handleTbAsOfDateChange);
    return () => {
      window.removeEventListener("admin:date-range-change", handleDateRangeChange);
      window.removeEventListener("reports:as-of-date-change", handleTbAsOfDateChange);
    };
  }, []);

  // Update date pickers based on predefined ranges
  const handlePnlRangeChange = (range: string) => {
    setPnlDateRange(range);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    if (range === "this year") {
      setPnlStartDate(`${today.getFullYear()}-01-01`);
      setPnlEndDate(todayStr);
    } else if (range === "6 months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      setPnlStartDate(d.toISOString().split("T")[0]);
      setPnlEndDate(todayStr);
    } else if (range === "three months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      setPnlStartDate(d.toISOString().split("T")[0]);
      setPnlEndDate(todayStr);
    } else if (range === "one month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      setPnlStartDate(d.toISOString().split("T")[0]);
      setPnlEndDate(todayStr);
    } else if (range === "custom") {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let fyStartYear = currentYear;
      let fyEndYear = currentYear + 1;
      if (currentMonth < 3) {
        fyStartYear = currentYear - 1;
        fyEndYear = currentYear;
      }
      setPnlStartDate(`${fyStartYear}-04-01`);
      setPnlEndDate(`${fyEndYear}-03-31`);
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-gray-400 animate-pulse">Loading financial reports...</div>;
  }

  // CALCULATE PNL VALUES DYNAMICALLY FROM DATABASE
  const calculatePNLData = (startStr: string, endStr: string) => {
    const startSelected = new Date(startStr);
    const endSelected = new Date(endStr);
    endSelected.setHours(23, 59, 59, 999);

    const income: Record<string, number> = {};
    const expenses: Record<string, number> = {};

    (data.journalEntries || []).forEach((entry: any) => {
      const entryDate = new Date(entry.date);
      if (entryDate >= startSelected && entryDate <= endSelected) {
        const amt = entry.amount;
        if (entry.type === "income") {
          const cat = entry.category || "Other";
          income[cat] = (income[cat] || 0) + amt;
        } else if (entry.type === "expense") {
          const cat = entry.category || "Other";
          expenses[cat] = (expenses[cat] || 0) + amt;
        }
      }
    });

    const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const netProfit = totalIncome - totalExpenses;

    const netProfitPercent = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netProfit,
      netProfitPercent
    };
  };

  // CALCULATE TRIAL BALANCE DYNAMICALLY FROM DATABASE
  const calculateTBData = (asOfStr: string) => {
    const asOfDate = new Date(asOfStr);
    asOfDate.setHours(23, 59, 59, 999);

    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};

    // 1. Calculate assets and liabilities: bank/cash accounts historical balances
    (data.accounts || []).forEach((acc: any) => {
      let balance = acc.currentBalance;
      
      (ledgerEntries || []).forEach((entry: any) => {
        if (entry.accountId === acc.id) {
          const entryDate = new Date(entry.date);
          if (entryDate > asOfDate) {
            balance = balance - (entry.debit || 0) + (entry.credit || 0);
          }
        }
      });

      if (balance >= 0) {
        if (balance > 0) assets[acc.name] = balance;
      } else {
        liabilities[acc.name] = Math.abs(balance);
      }
    });

    // 2. Fetch all lifetime income and expenses up to asOfStr
    const pnl = calculatePNLData("2000-01-01", asOfStr);

    // 3. Calculate balancing figure
    const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);
    const totalExpenses = Object.values(pnl.expenses).reduce((a, b) => a + b, 0);
    const totalDebits = totalAssets + totalExpenses;

    const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
    const totalIncome = Object.values(pnl.income).reduce((a, b) => a + b, 0);
    const currentCredits = totalLiabilities + totalIncome;

    const equity: Record<string, number> = {};
    const imbalance = totalDebits - currentCredits;
    
    if (imbalance !== 0) {
      // If Debits > Credits, we need a Credit balance (Equity) to balance.
      // If Debits < Credits, we need a Debit balance (Negative Equity).
      equity["Capital & Historical Balancing"] = imbalance;
    }

    return {
      assets,
      liabilities,
      equity,
      income: pnl.income,
      expenses: pnl.expenses
    };
  };

  const pnlData = calculatePNLData(pnlStartDate, pnlEndDate);
  const tbData = calculateTBData(tbAsOfDate);

  // Helper to determine debit vs credit column for Trial Balance
  const isDebitAccount = (name: string, sectionTitle: string, value: number): boolean => {
    if (sectionTitle === "Assets" || sectionTitle === "Expenses") {
      return true;
    }
    if (sectionTitle === "Liabilities" || sectionTitle === "Income") {
      return false;
    }
    if (sectionTitle === "Equity") {
      if (name === "Capital & Historical Balancing") {
        return value < 0; // Negative equity balancing is a Debit
      }
      return false;
    }
    return true;
  };

  // Filter journal entries for Overview Tab
  const filteredJournal = (data.journalEntries || [])
    .filter((entry: any) => {
      const matchesSearch = 
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (journalFilter === "income") return matchesSearch && entry.type === "income";
      if (journalFilter === "expense") return matchesSearch && entry.type === "expense";
      return matchesSearch;
    });

  const stats = [
    { label: "Total Revenue", value: pnlData.totalIncome, currency: true, icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Expenses", value: pnlData.totalExpenses, currency: true, icon: TrendingDown, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Net Profit", value: pnlData.netProfit, currency: true, icon: DollarSign, color: "text-brand-400", bg: "bg-brand-400/10" },
    { label: "Profit Margin", value: pnlData.netProfitPercent, currency: false, isPercent: true, icon: Percent, color: "text-blue-400", bg: "bg-blue-400/10" },
  ];

  const expensesBreakdownChart = Object.entries(pnlData.expenses)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Top 5 clients by revenue for the chart
  const topClientsChart = [...clients]
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((c) => ({ name: c.name, revenue: c.revenue }));

  // EXPORT UTILITIES
  const handleExportCSV = () => {
    if (activeTab === "pnl") {
      const headers = ["Account", "Type", "Amount (LKR)"];
      const rows: string[][] = [];
      
      rows.push(["INCOME", "", ""]);
      Object.entries(pnlData.income).forEach(([k, v]) => rows.push([k, "Income Account", v.toFixed(2)]));
      rows.push(["Total Income", "", pnlData.totalIncome.toFixed(2)]);
      rows.push(["", "", ""]);

      rows.push(["EXPENSES", "", ""]);
      Object.entries(pnlData.expenses).forEach(([k, v]) => rows.push([k, "Expense Account", v.toFixed(2)]));
      rows.push(["Total Expenses", "", pnlData.totalExpenses.toFixed(2)]);
      rows.push(["", "", ""]);

      rows.push(["Net Profit", "", pnlData.netProfit.toFixed(2)]);

      exportToCSV(`Profit_and_Loss_${pnlStartDate}_to_${pnlEndDate}.csv`, headers, rows);
    } else if (activeTab === "trial") {
      const headers = ["Account", "Debit (LKR)", "Credit (LKR)"];
      const rows: string[][] = [];

      let totalDebit = 0;
      let totalCredit = 0;

      const addRows = (title: string, section: Record<string, number>) => {
        rows.push([title.toUpperCase(), "", ""]);
        Object.entries(section).forEach(([k, v]) => {
          const isDebit = isDebitAccount(k, title, v);
          const val = Math.abs(v);
          if (isDebit) {
            rows.push([k, val.toFixed(2), "0.00"]);
            totalDebit += val;
          } else {
            rows.push([k, "0.00", val.toFixed(2)]);
            totalCredit += val;
          }
        });
        rows.push(["", "", ""]);
      };

      addRows("Assets", tbData.assets);
      addRows("Liabilities", tbData.liabilities);
      addRows("Equity", tbData.equity);
      addRows("Income", tbData.income);
      addRows("Expenses", tbData.expenses);

      rows.push(["Total for all accounts", totalDebit.toFixed(2), totalCredit.toFixed(2)]);

      exportToCSV(`Trial_Balance_As_Of_${tbAsOfDate}.csv`, headers, rows);
    }
  };

  const exportToCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    
    if (activeTab === "pnl") {
      doc.text("Profit & Loss Statement", 14, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${pnlStartDate} to ${pnlEndDate}`, 14, 28);

      let y = 40;
      doc.setFont("helvetica", "bold");
      doc.text("ACCOUNTS", 14, y);
      doc.text("AMOUNT (LKR)", 160, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      // Income Section
      doc.setFont("helvetica", "bold");
      doc.text("Income", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      if (Object.keys(pnlData.income).length === 0) {
        doc.text("No income records found.", 18, y);
        y += 6;
      } else {
        Object.entries(pnlData.income).forEach(([k, v]) => {
          doc.text(k, 18, y);
          doc.text(formatLKR(v), 160, y);
          y += 6;
        });
      }
      doc.setFont("helvetica", "bold");
      doc.text("Total Income", 14, y);
      doc.text(formatLKR(pnlData.totalIncome), 160, y);
      y += 8;

      // Expenses
      doc.setFont("helvetica", "bold");
      doc.text("Expenses", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      if (Object.keys(pnlData.expenses).length === 0) {
        doc.text("No expense records.", 18, y);
        y += 6;
      } else {
        Object.entries(pnlData.expenses).forEach(([k, v]) => {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(k, 18, y);
          doc.text(formatLKR(v), 160, y);
          y += 6;
        });
      }
      doc.setFont("helvetica", "bold");
      doc.text("Total Expenses", 14, y);
      doc.text(formatLKR(pnlData.totalExpenses), 160, y);
      y += 10;

      // Net Profit
      doc.setFillColor(240, 243, 246);
      doc.rect(14, y - 5, 182, 8, "F");
      doc.text("Net Profit", 16, y);
      doc.text(formatLKR(pnlData.netProfit), 160, y);

      doc.save(`Profit_and_Loss_${pnlStartDate}_to_${pnlEndDate}.pdf`);
    } else if (activeTab === "trial") {
      doc.text("Trial Balance", 14, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`As of: ${tbAsOfDate}`, 14, 28);

      let y = 40;
      doc.setFont("helvetica", "bold");
      doc.text("ACCOUNTS", 14, y);
      doc.text("DEBIT (LKR)", 110, y);
      doc.text("CREDIT (LKR)", 160, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      let totalDebit = 0;
      let totalCredit = 0;

      const printSection = (title: string, section: Record<string, number>) => {
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        
        if (Object.keys(section).length === 0) {
          doc.text("No accounts active in this section.", 18, y);
          y += 6;
        } else {
          Object.entries(section).forEach(([k, v]) => {
            if (y > 275) {
              doc.addPage();
              y = 20;
            }
            doc.text(k, 18, y);
            const isDebit = isDebitAccount(k, title, v);
            const val = Math.abs(v);
            if (isDebit) {
              doc.text(formatLKR(val), 110, y);
              totalDebit += val;
            } else {
              doc.text(formatLKR(val), 160, y);
              totalCredit += val;
            }
            y += 6;
          });
        }
        y += 4;
      };

      printSection("Assets", tbData.assets);
      printSection("Liabilities", tbData.liabilities);
      printSection("Equity", tbData.equity);
      printSection("Income", tbData.income);
      printSection("Expenses", tbData.expenses);

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Total for all accounts", 14, y);
      doc.text(formatLKR(totalDebit), 110, y);
      doc.text(formatLKR(totalCredit), 160, y);

      doc.save(`Trial_Balance_As_Of_${tbAsOfDate}.pdf`);
    }
  };



  if (loading || !data) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={4} />
        <SkeletonTable rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* REPORT TYPE TAB SWITCHER */}
      <div className="bg-white/5 p-1 rounded-2xl border border-white/10 flex flex-wrap gap-1 w-fit">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "overview"
              ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Overview Dashboard
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "ledger"
              ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          General Ledger
        </button>
        <button
          onClick={() => setActiveTab("pnl")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "pnl"
              ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Profit & Loss
        </button>
        <button
          onClick={() => setActiveTab("trial")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === "trial"
              ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Trial Balance
        </button>
      </div>

      {/* VIEW: OVERVIEW DASHBOARD */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-colors">
                <div className={`p-4 rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <AnimatedCounter 
                    value={stat.value as number} 
                    currency={stat.currency} 
                    decimals={stat.isPercent ? 1 : 0} 
                    className="text-2xl font-semibold text-white block" 
                  />
                  {stat.isPercent && <span className="text-2xl font-semibold text-white">%</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6 text-white">Income by Service</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.incomeByService} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LKR ${value / 1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={80} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatLKR(value), 'Income']}
                    />
                    <Bar dataKey="value" fill="#4ade80" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6 text-white">Expenses Breakdown</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expensesBreakdownChart} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LKR ${value / 1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={80} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatLKR(value), 'Expense']}
                    />
                    <Bar dataKey="value" fill="#f87171" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Clients Chart */}
          {topClientsChart.length > 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-brand-400/10 rounded-xl">
                  <Users className="w-5 h-5 text-brand-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Top Clients by Revenue</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClientsChart} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LKR ${value / 1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={100} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatLKR(value), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#29B6F6" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          
        </div>
      )}

      {/* VIEW: GENERAL LEDGER */}
      {activeTab === "ledger" && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">General Ledger</h2>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500 transition-colors w-full sm:w-60"
                />
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                  {["all", "income", "expense"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setJournalFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        journalFilter === filter
                          ? "bg-brand-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-xs font-medium uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredJournal.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No transactions found in this period.
                      </td>
                    </tr>
                  ) : (
                    filteredJournal.map((entry: any) => {
                      const isIncome = entry.type === "income";
                      return (
                        <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 whitespace-nowrap text-gray-300">
                            {new Date(entry.date).toLocaleDateString("en-LK", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="p-4 font-medium text-white">{entry.description}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-xs bg-white/5 text-gray-400 border border-white/10">
                              {entry.category}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isIncome
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}
                            >
                              {isIncome ? "Credit (In)" : "Debit (Out)"}
                            </span>
                          </td>
                          <td
                            className={`p-4 whitespace-nowrap text-right font-bold ${
                              isIncome ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {isIncome ? "+" : "-"} Rs. {entry.amount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* VIEW: PROFIT & LOSS */}
      {activeTab === "pnl" && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
          {/* KPI Equation row */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <div className="grid grid-cols-5 items-center text-center">
              <div className="col-span-1 space-y-1">
                <p className="text-gray-400 text-xs uppercase font-medium">Income</p>
                <p className="text-md sm:text-lg font-semibold text-white">{formatLKR(pnlData.totalIncome)}</p>
              </div>

              <div className="col-span-1 flex items-center justify-center">
                <span className="text-2xl text-gray-500 font-light">&minus;</span>
              </div>

              <div className="col-span-1 space-y-1">
                <p className="text-gray-400 text-xs uppercase font-medium">Expenses</p>
                <p className="text-md sm:text-lg font-semibold text-white">{formatLKR(pnlData.totalExpenses)}</p>
              </div>

              <div className="col-span-1 flex items-center justify-center">
                <span className="text-2xl text-gray-500 font-light">=</span>
              </div>

              <div className="col-span-1 space-y-1">
                <p className="text-gray-400 text-xs uppercase font-medium">Net Profit</p>
                <p className={`text-md sm:text-xl font-bold ${pnlData.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{formatLKR(pnlData.netProfit)}</p>
              </div>
            </div>
          </div>

          {/* PNL accounts list */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
            <table className="w-full border-collapse text-left text-sm text-white">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-white/10">
                  <th className="p-4">Accounts</th>
                  <th className="p-4 text-right whitespace-nowrap">
                    {new Date(pnlStartDate).toLocaleDateString("en-LK", {month: 'short', day: 'numeric', year: 'numeric'})} to {new Date(pnlEndDate).toLocaleDateString("en-LK", {month: 'short', day: 'numeric', year: 'numeric'})}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {/* SECTION: INCOME */}
                <tr className="bg-white/5">
                  <td colSpan={2} className="p-4 font-bold text-gray-300">Income</td>
                </tr>
                {Object.keys(pnlData.income).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-4 pl-8 text-gray-500 font-normal italic">No income entries in this range</td>
                  </tr>
                ) : (
                  Object.entries(pnlData.income).map(([k, v]) => (
                    <tr key={k} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 pl-8 text-gray-400">
                        {k}
                      </td>
                      <td className="p-4 text-right font-normal text-white">{formatLKR(v)}</td>
                    </tr>
                  ))
                )}
                <tr>
                  <td className="p-4 pl-6 font-semibold text-gray-300">Total Income</td>
                  <td className="p-4 text-right font-semibold text-white">{formatLKR(pnlData.totalIncome)}</td>
                </tr>

                {/* SECTION: EXPENSES */}
                <tr className="bg-white/5">
                  <td colSpan={2} className="p-4 font-bold text-gray-300">Expenses</td>
                </tr>
                {Object.keys(pnlData.expenses).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-4 pl-8 text-gray-500 font-normal italic">No expense entries in this range</td>
                  </tr>
                ) : (
                  Object.entries(pnlData.expenses).map(([k, v]) => (
                    <tr key={k} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 pl-8 text-gray-400">
                        {k}
                      </td>
                      <td className="p-4 text-right font-normal text-white">{formatLKR(v)}</td>
                    </tr>
                  ))
                )}
                <tr>
                  <td className="p-4 pl-6 font-semibold text-gray-300">Total Expenses</td>
                  <td className="p-4 text-right font-semibold text-white">{formatLKR(pnlData.totalExpenses)}</td>
                </tr>

                {/* NET PROFIT */}
                <tr className="bg-brand-600/20 border-t border-brand-500/30">
                  <td className="p-4 font-bold text-white">
                    <div>Net Profit</div>
                    <div className="text-xs text-gray-400 font-normal mt-0.5">As a percentage of Total Income</div>
                  </td>
                  <td className={`p-4 text-right font-bold ${pnlData.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    <div>{formatLKR(pnlData.netProfit)}</div>
                    <div className="text-xs text-gray-400 font-normal mt-0.5">{pnlData.netProfitPercent.toFixed(2)}%</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: TRIAL BALANCE */}
      {activeTab === "trial" && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
          
          {/* As Of Date Selector */}
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm font-medium">As Of Date:</span>
              <input
                type="date"
                value={tbAsOfDate}
                onChange={(e) => setTbAsOfDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand-500 transition-colors outline-none"
              />
            </div>
          </div>

          {/* Trial balance table */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
            <table className="w-full border-collapse text-left text-sm text-white font-medium">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-white/10">
                  <th className="p-4">Accounts</th>
                  <th className="p-4 text-right">Debit</th>
                  <th className="p-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {/* RENDER GROUPED SECTIONS HELPER */}
                {(() => {
                  let totalDebitSum = 0;
                  let totalCreditSum = 0;

                  const sections = [
                    { title: "Assets", accounts: tbData.assets },
                    { title: "Liabilities", accounts: tbData.liabilities },
                    { title: "Equity", accounts: tbData.equity },
                    { title: "Income", accounts: tbData.income },
                    { title: "Expenses", accounts: tbData.expenses }
                  ];

                  return (
                    <>
                      {sections.map((sec) => {
                        let secDebit = 0;
                        let secCredit = 0;

                        return (
                          <Fragment key={sec.title}>
                            {/* Section Header */}
                            <tr className="bg-white/5">
                              <td colSpan={3} className="p-4 font-bold text-gray-300 border-y border-white/10">{sec.title}</td>
                            </tr>
                            
                            {/* Section Accounts */}
                            {Object.keys(sec.accounts).length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-4 pl-8 text-gray-500 font-normal italic">No accounts in this section</td>
                              </tr>
                            ) : (
                              Object.entries(sec.accounts).map(([k, v]) => {
                                const isDebit = isDebitAccount(k, sec.title, v);
                                const absVal = Math.abs(v);

                                if (isDebit) {
                                  secDebit += absVal;
                                  totalDebitSum += absVal;
                                } else {
                                  secCredit += absVal;
                                  totalCreditSum += absVal;
                                }

                                return (
                                  <tr key={k} className="hover:bg-white/5 transition-colors font-medium text-gray-300">
                                    <td className="p-4 pl-8 text-gray-300">
                                      {k}
                                    </td>
                                    <td className="p-4 text-right font-normal">
                                      {isDebit ? formatLKR(absVal) : "0.00"}
                                    </td>
                                    <td className="p-4 text-right font-normal">
                                      {isDebit ? "0.00" : formatLKR(absVal)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}

                            {/* Section Summary */}
                            <tr className="border-b border-white/10 bg-white/2">
                              <td className="p-4 pl-6 font-semibold text-gray-300">Total {sec.title}</td>
                              <td className="p-4 text-right font-semibold">{formatLKR(secDebit)}</td>
                              <td className="p-4 text-right font-semibold">{formatLKR(secCredit)}</td>
                            </tr>
                          </Fragment>
                        );
                      })}

                      {/* Bottom Grand Total */}
                      <tr className="bg-brand-500/10 border-t border-brand-500/30 text-white font-bold">
                        <td className="p-4">Total for all accounts</td>
                        <td className="p-4 text-right">{formatLKR(totalDebitSum)}</td>
                        <td className="p-4 text-right">{formatLKR(totalCreditSum)}</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
