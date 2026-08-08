"use client";

import { useEffect, useState } from "react";
import { Wallet, Receipt, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, FileText, PieChart as PieIcon, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { getDashboardData } from "../actions/actions";
import DateRangeSelector from "../components/DateRangeSelector";
import { SkeletonDashboard } from "../components/SkeletonUI";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { getCachedData, setCachedData } from "@/lib/cache";

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

const DONUT_COLORS = [
  "#c11e2f", // Vibrant Brand Red
  "#38bdf8", // Sky Brand Blue
  "#0284c7", // Bright Teal Blue
  "#e98292", // Light Brand Rose
  "#005080", // Electric Blue
  "#f4b8c1", // Pastel Brand Pink
  "#0a3350", // Muted Brand Navy
  "#f9dbe0", // Creamy Coral
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Date Range States
  const [dateRange, setDateRange] = useState("this year");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const handleRangeChange = (range: string) => {
    setDateRange(range);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    if (range === "this year") {
      setStartDate(`${today.getFullYear()}-01-01`);
      setEndDate(todayStr);
    } else if (range === "last year") {
      setStartDate(`${today.getFullYear() - 1}-01-01`);
      setEndDate(`${today.getFullYear() - 1}-12-31`);
    } else if (range === "this month") {
      setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
      setEndDate(todayStr);
    } else if (range === "last month") {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`);
      setEndDate(`${prevEnd.getFullYear()}-${String(prevEnd.getMonth() + 1).padStart(2, '0')}-${prevEnd.getDate()}`);
    } else if (range === "this quarter") {
      const qStartMonth = Math.floor(today.getMonth() / 3) * 3;
      setStartDate(`${today.getFullYear()}-${String(qStartMonth + 1).padStart(2, '0')}-01`);
      setEndDate(todayStr);
    } else if (range === "lifetime") {
      setStartDate("1970-01-01");
      setEndDate("2099-12-31");
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
    let isCurrent = true;
    async function load() {
      const cacheKey = `dashboard_${startDate}_${endDate}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        setData(cached);
        setLoading(false); // Instant load
      } else {
        setLoading(true);
      }
      
      try {
        const res = await getDashboardData(startDate, endDate);
        if (isCurrent) {
          setData(res);
          setCachedData(cacheKey, res);
        }
      } catch (e) {
        if (isCurrent) {
          console.error("Failed to load dashboard data", e);
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      isCurrent = false;
    };
  }, [startDate, endDate]);

  if (loading || !data) {
    return <SkeletonDashboard />;
  }

  const stats = [
    { label: "Total Income", value: data.totalIncome, currency: true, icon: Wallet, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Expenses", value: data.totalExpenses, currency: true, icon: Receipt, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Net Profit", value: data.netProfit, currency: true, icon: TrendingUp, color: "text-brand-400", bg: "bg-brand-400/10" },
    { label: "Unpaid Invoices", value: data.unpaidCount, currency: false, icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-400/10" },
  ];

  const cleanedChartData = (data.chartData || []).map((row: any) => ({
    name: row.name,
    income: Math.max(0, row.income),
    expenses: Math.max(0, row.expenses)
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-white/10 transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <AnimatedCounter value={stat.value} currency={stat.currency} className="text-2xl font-semibold block" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left Column (2 cols): Cash Flow Chart + Recent Transactions */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
            <div>
              <h2 className="text-xl font-semibold">
                Cash Flow
              </h2>
            </div>
            <div className="text-xs text-brand-400 font-semibold bg-brand-400/10 px-3 py-1.5 rounded-full border border-brand-400/20">
              12-Month Flow (to End Date)
            </div>
          </div>
          <div className="flex-1 w-full min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleanedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={(val) => `LKR ${val/1000}k`} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ backgroundColor: 'rgba(10,10,15,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  labelStyle={{ color: '#9ca3af', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}
                  formatter={(value: any) => formatLKR(value)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
                <Bar dataKey="income" name="Income" fill="#4ade80" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column (1 col): Net Income Comparison + Recent Invoices */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Comparison Table */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <h2 className="text-lg font-semibold mb-4">Net Income</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white font-medium">
                <thead>
                  <tr className="text-gray-400 font-semibold uppercase border-b border-white/10">
                    <th className="pb-2">Fiscal Year</th>
                    <th className="pb-2 text-right">Previous (2025)</th>
                    <th className="pb-2 text-right">Current (2026)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2.5 font-semibold text-gray-300">Income</td>
                    <td className="py-2.5 text-right text-green-400">{formatLKR(data.netIncomeComparison.previous.income)}</td>
                    <td className="py-2.5 text-right text-green-400">{formatLKR(data.netIncomeComparison.current.income)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-semibold text-gray-300">Expense</td>
                    <td className="py-2.5 text-right text-red-400">{formatLKR(data.netIncomeComparison.previous.expenses)}</td>
                    <td className="py-2.5 text-right text-red-400">{formatLKR(data.netIncomeComparison.current.expenses)}</td>
                  </tr>
                  <tr className="bg-white/5 font-bold">
                    <td className="py-2 px-1 font-bold text-white rounded-l-xl">Net Income</td>
                    <td className={`py-2 px-1 text-right ${data.netIncomeComparison.previous.netIncome >= 0 ? "text-brand-400" : "text-red-400"}`}>{formatLKR(data.netIncomeComparison.previous.netIncome)}</td>
                    <td className={`py-2 px-1 text-right rounded-r-xl ${data.netIncomeComparison.current.netIncome >= 0 ? "text-brand-400" : "text-red-400"}`}>{formatLKR(data.netIncomeComparison.current.netIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-3">Recent Invoices</h2>
              <div className="space-y-2.5">
                {data.recentInvoices.map((invoice: any, i: number) => {
                  let statusColor = "text-gray-400 bg-gray-400/10 border-gray-400/20";
                  const statusStr = invoice.status?.toLowerCase() || '';
                  if (statusStr === 'paid') statusColor = "text-green-400 bg-green-400/10 border-green-400/20";
                  else if (statusStr === 'unpaid' || statusStr === 'pending') statusColor = "text-amber-400 bg-amber-400/10 border-amber-400/20";
                  else if (statusStr === 'overdue') statusColor = "text-red-400 bg-red-400/10 border-red-400/20";

                  return (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/5 rounded-lg">
                          <FileText className="w-4 h-4 text-gray-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-white">{invoice.id}</p>
                          <p className="text-[10px] text-gray-400 truncate w-24">{invoice.client || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-xs text-white">{formatLKR(invoice.amount)}</p>
                        <span className={`inline-block mt-0.5 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${statusColor}`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {data.recentInvoices.length === 0 && <p className="text-gray-500 text-xs">No recent invoices in range.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 2: Recent Transactions & Expense Breakdown Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
          <h2 className="text-xl font-semibold mb-6">Recent Transactions</h2>
          <div className="space-y-3">
            {data.recentTransactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${tx.type === 'income' ? 'bg-green-400/10' : 'bg-red-400/10'}`}>
                    {tx.type === 'income' ? (
                      <ArrowUpRight className={`w-5 h-5 text-green-400`} />
                    ) : (
                      <ArrowDownRight className={`w-5 h-5 text-red-400`} />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{tx.name}</p>
                    <p className="text-sm text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <p className={`font-semibold ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatLKR(tx.amount)}
                </p>
              </div>
            ))}
            {data.recentTransactions.length === 0 && <p className="text-gray-500 text-sm">No recent transactions in range.</p>}
          </div>
        </div>

        {/* Expense Breakdown Donut */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Expense Breakdown
              </h2>
            </div>
          </div>
          
          <div className="h-[200px] w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.expenseBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10,10,15,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  formatter={(value: any) => formatLKR(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center label */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Total</span>
              <span className="text-sm font-bold text-white mt-0.5">
                {formatLKR(data.expenseBreakdown.reduce((sum: number, item: any) => sum + item.value, 0))}
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[140px] pr-1">
            {data.expenseBreakdown.map((item: any, index: number) => {
              const total = data.expenseBreakdown.reduce((sum: number, i: any) => sum + i.value, 0);
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
              
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                    <span className="text-gray-300 truncate font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-400">{percentage}%</span>
                    <span className="font-semibold text-white">{formatLKR(item.value)}</span>
                  </div>
                </div>
              );
            })}
            {data.expenseBreakdown.length === 0 && <p className="text-gray-500 text-xs text-center py-4">No expenses recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}