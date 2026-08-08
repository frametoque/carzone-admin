"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import "./globals.css";
import DateRangeSelector from "./components/DateRangeSelector";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import {
  motion,
  AnimatePresence,
  type Transition,
  type Variants,
} from "framer-motion";

import {
  Bell,
  Menu,
  Search,
  LayoutDashboard,
  Car,
  Wallet,
  Receipt,
  FileText,
  Users,
  BarChart3,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  ChartLine,
  NotepadTextDashed,
  FolderOpenDot,
  Landmark,
  BookOpen,
  Clock,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ArrowLeftRight,
  RefreshCw,
  Cake,
  Settings,
  Terminal,
  Trash2,
  ChevronDown
} from "lucide-react";
import { getTodayBirthdays } from "./actions/actions";

// Framer Motion spring config for sidebar width
const sidebarSpring = {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 0.8,
} as const;

// Fade + slide config for labels
const labelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -8,
    width: 0,
  },
  visible: {
    opacity: 1,
    x: 0,
    width: "auto",
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: -8,
    width: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

// Page title mapping for browser tabs
const getDocumentTitle = (path: string): string => {
  if (path === "/" || path === "/dashboard") return "Dashboard | Carz One";
  if (path.startsWith("/stock")) return "Stock | Carz One";
  if (path.startsWith("/accounts")) return "Accounts | Carz One";
  if (path.startsWith("/ledgers")) return "Ledgers | Carz One";
  if (path.startsWith("/clients")) return "Clients | Carz One";
  if (path.startsWith("/invoice/")) {
    const parts = path.split("/");
    const id = parts[parts.length - 1];
    return id ? `Invoice #${id} | Carz One` : "Invoice | Carz One";
  }
  if (path.startsWith("/invoices")) return "Invoices | Carz One";
  if (path.startsWith("/quotations")) return "Quotations | Carz One";
  if (path.startsWith("/income")) return "Income | Carz One";
  if (path.startsWith("/expenses")) return "Expenses | Carz One";
  if (path.startsWith("/reports")) return "Reports | Carz One";
  if (path.startsWith("/forecasts")) return "Forecasts | Carz One";
  if (path.startsWith("/logs")) return "Logs | Carz One";
  if (path === "/login") return "Login | Carz One";
  return "Admin | Carz One";
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [ignoreHover, setIgnoreHover] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Dynamic browser tab title — update on every render (no useEffect needed)
  if (typeof document !== "undefined") {
    document.title = getDocumentTitle(pathname);
  }

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-is-collapsed") === "true";
    setCollapsed(saved);
    setMounted(true);
  }, []);

  // Fetch session ONCE on mount — session doesn't change between page navigations
  useEffect(() => {
    let active = true;
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setUser({
              fullName: data.user.fullName || "Admin User",
              firstName: (data.user.fullName || "Admin").split(" ")[0],
              imageUrl: data.user.imageUrl || "",
              emailAddresses: [{ emailAddress: data.user.email }]
            });
          }
        } else {
          // If unauthenticated, redirect to login (safeguard)
          if (active && pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      } finally {
        if (active) setIsLoaded(true);
      }
    };
    if (pathname !== "/login") {
      fetchSession();
    } else {
      setIsLoaded(true);
    }
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (pathname === "/login") {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <title>Admin | Carz One</title>
          <meta name="robots" content="noindex, nofollow" />
        </head>
        <body className="bg-black text-white antialiased">
          <ReactLenis root>
            <div className="min-h-screen bg-black text-white">{children}</div>
          </ReactLenis>
        </body>
      </html>
    );
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-is-collapsed", String(next));
      if (next) {
        setIgnoreHover(true);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout failed:", err);
    }
    window.location.href = "/login";
  };

  // On desktop, the sidebar is visually expanded if it is not collapsed,
  // OR if the user is hovering over it while it is collapsed.
  const desktopExpanded = !collapsed || (sidebarHovered && !ignoreHover);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Admin | Carz One</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="bg-black text-white antialiased">
        <ReactLenis root options={{ lerp: 0.08, duration: 1.2, smoothWheel: true }}>
          <div className="min-h-screen bg-black text-white">
            <Sidebar
              mobileMenuOpen={mobileMenuOpen}
              setMobileMenuOpen={setMobileMenuOpen}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              sidebarHovered={sidebarHovered}
              setSidebarHovered={setSidebarHovered}
              ignoreHover={ignoreHover}
              setIgnoreHover={setIgnoreHover}
              desktopExpanded={desktopExpanded}
              user={user}
              isLoaded={isLoaded}
              handleLogout={handleLogout}
            />

            {/* Content padding is driven by the *persistent* collapsed state, not hover, so layout doesn't shift on hover */}
            <motion.div
              animate={{ paddingLeft: collapsed ? 72 : 192 }}
              transition={sidebarSpring}
              className="min-h-screen lg:block hidden"
            >
              <Header user={user} isLoaded={isLoaded} setMobileMenuOpen={setMobileMenuOpen} />
              <main className="p-4 sm:p-6 lg:p-8">{children}</main>
            </motion.div>

            {/* Mobile: no left padding */}
            <div className="lg:hidden">
              <Header user={user} isLoaded={isLoaded} setMobileMenuOpen={setMobileMenuOpen} />
              <main className="p-4 sm:p-6">{children}</main>
            </div>
          </div>
        </ReactLenis>
      </body>
    </html>
  );
}

// ------------------ Header ------------------
const Header = ({ user, isLoaded, setMobileMenuOpen }: { user: any; isLoaded: boolean; setMobileMenuOpen: (open: boolean) => void }) => {
  const pathname = usePathname();
  const isInvoiceDetail = pathname.startsWith("/invoice/");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [headerSearchTerm, setHeaderSearchTerm] = useState("");
  const isClients = pathname.startsWith("/clients");

  // Date Range Context / state for top bar
  const isReportsOrForecasts = pathname.startsWith("/reports") || pathname.startsWith("/forecasts");
  const [dateRange, setDateRange] = useState(isReportsOrForecasts ? "this year" : "lifetime");
  const [startDate, setStartDate] = useState(() => {
    if (isReportsOrForecasts) {
      const today = new Date();
      return `${today.getFullYear()}-01-01`;
    }
    return "1970-01-01";
  });
  const [endDate, setEndDate] = useState(() => {
    if (isReportsOrForecasts) {
      const today = new Date();
      return today.toISOString().split("T")[0];
    }
    return "2099-12-31";
  });

  const pageGroup = isReportsOrForecasts ? "reports" : "general";
  const prevPageGroupRef = useRef(pageGroup);

  useEffect(() => {
    if (prevPageGroupRef.current !== pageGroup) {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      if (pageGroup === "reports") {
        setDateRange("this year");
        setStartDate(`${today.getFullYear()}-01-01`);
        setEndDate(todayStr);
      } else {
        setDateRange("lifetime");
        setStartDate("1970-01-01");
        setEndDate("2099-12-31");
      }
      prevPageGroupRef.current = pageGroup;
    }
  }, [pageGroup]);

  const handleRangeChange = (range: string) => {
    setDateRange(range);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    let sDate = startDate;
    let eDate = endDate;

    if (range === "this year") {
      sDate = `${today.getFullYear()}-01-01`;
      eDate = todayStr;
    } else if (range === "6 months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      sDate = d.toISOString().split("T")[0];
      eDate = todayStr;
    } else if (range === "three months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      sDate = d.toISOString().split("T")[0];
      eDate = todayStr;
    } else if (range === "one month") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      sDate = d.toISOString().split("T")[0];
      eDate = todayStr;
    } else if (range === "lifetime") {
      sDate = "1970-01-01";
      eDate = "2099-12-31";
    }

    setStartDate(sDate);
    setEndDate(eDate);

    window.dispatchEvent(
      new CustomEvent("admin:date-range-change", {
        detail: { range, startDate: sDate, endDate: eDate }
      })
    );
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    window.dispatchEvent(
      new CustomEvent("admin:date-range-change", {
        detail: { range: dateRange, startDate: val, endDate }
      })
    );
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    window.dispatchEvent(
      new CustomEvent("admin:date-range-change", {
        detail: { range: dateRange, startDate, endDate: val }
      })
    );
  };

  const getPageTitle = (path: string): string => {
    if (path === "/" || path === "/dashboard") return "Dashboard";
    if (path.startsWith("/stock")) return "Stock";
    if (path.startsWith("/accounts")) return "Accounts";
    if (path.startsWith("/ledgers")) return "Ledgers";
    if (path.startsWith("/clients")) return "Clients";
    if (path.startsWith("/invoice/")) {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      return id ? `Invoice #${id}` : "Invoice Details";
    }
    if (path.startsWith("/invoices")) return "Invoices";
    if (path.startsWith("/quotations")) return "Quotations";
    if (path.startsWith("/income")) return "Income";
    if (path.startsWith("/expenses")) return "Expenses";
    if (path.startsWith("/reports")) return "Reports";
    if (path.startsWith("/forecasts")) return "Forecasts";
    if (path.startsWith("/logs")) return "System Logs";
    return "Admin";
  };

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      
      const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Colombo",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      
      const dateStr = now.toLocaleDateString("en-US", {
        timeZone: "Asia/Colombo",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });

      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
    };
    updateDateTime();
    const clockInterval = setInterval(updateDateTime, 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, []);

  const [reportsTab, setReportsTab] = useState<string>("overview");
  const [tbAsOfDate, setTbAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [todayBirthdays, setTodayBirthdays] = useState<any[]>([]);
  const [hideBirthdayBtn, setHideBirthdayBtn] = useState(false);

  useEffect(() => {
    async function loadBirthdays() {
      try {
        const res = await getTodayBirthdays();
        setTodayBirthdays(res);
      } catch (e) {
        console.error("Failed to load birthdays", e);
      }
    }
    loadBirthdays();

    // Check if birthday button was hidden today
    const hiddenDate = localStorage.getItem("birthday-btn-hidden-date");
    const todayStr = new Date().toISOString().split("T")[0];
    if (hiddenDate === todayStr) {
      setHideBirthdayBtn(true);
    }

    const handleTabChange = (e: Event) => {
      const customEvt = e as CustomEvent<string>;
      if (customEvt.detail) {
        setReportsTab(customEvt.detail);
      }
    };
    const handleAsOfChange = (e: Event) => {
      const customEvt = e as CustomEvent<string>;
      if (customEvt.detail) {
        setTbAsOfDate(customEvt.detail);
      }
    };
    window.addEventListener("reports:tab-change", handleTabChange);
    window.addEventListener("reports:as-of-date-sync", handleAsOfChange);
    return () => {
      window.removeEventListener("reports:tab-change", handleTabChange);
      window.removeEventListener("reports:as-of-date-sync", handleAsOfChange);
    };
  }, []);

  const handleTbAsOfDateChange = (val: string) => {
    setTbAsOfDate(val);
    window.dispatchEvent(new CustomEvent("reports:as-of-date-change", { detail: val }));
  };

  const isReportsTrialTab = pathname.startsWith("/reports") && reportsTab === "trial";
  const isDashboardOrClientsPage = (pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/clients"));
  const shouldShowDateRange = (pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/income") || pathname.startsWith("/expenses") || pathname.startsWith("/ledgers") || pathname.startsWith("/quotations") || (pathname.startsWith("/reports") && !isReportsTrialTab));

  // Time-based greeting for dashboard
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const isDashboard = pathname === "/" || pathname === "/dashboard";
  const userName = user?.firstName || "Admin";

  return (
    <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/10 h-20 flex-shrink-0 flex items-center">
      <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left Side: Title & Date Range Selector */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-white/10 rounded-3xl"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Page Title + Dashboard Greeting */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {getPageTitle(pathname)}
            </h1>
            {isDashboard && (
              <p className="text-xs text-gray-400 font-medium -mt-0.5">
                {getGreeting()} !
              </p>
            )}
          </div>

          {/* Conditional Date Range Selector for pages that utilize dates */}
          {shouldShowDateRange && (
            <>
              {/* Divider */}
              <span className="hidden sm:block w-[1px] h-6 bg-white/20" />
              <DateRangeSelector
                dateRange={dateRange}
                startDate={startDate}
                endDate={endDate}
                onRangeChange={handleRangeChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
              />
            </>
          )}

          {/* Today Birthdays Button in Top Bar */}
          {isDashboardOrClientsPage && todayBirthdays.length > 0 && !(pathname === "/dashboard" && hideBirthdayBtn) && (
            <>
              <span className="hidden sm:block w-[1px] h-6 bg-white/20" />
              <button
                type="button"
                onClick={() => {
                  if (pathname === "/dashboard") {
                    setHideBirthdayBtn(true);
                    const todayStr = new Date().toISOString().split("T")[0];
                    localStorage.setItem("birthday-btn-hidden-date", todayStr);
                  }
                  if (todayBirthdays.length === 1) {
                    const client = todayBirthdays[0];
                    const rawMsg = "\u{1F389} Happy Birthday, " + client.name + "! \u{1F382}\u{1F697}\n\nThe entire *Carz One Motor Trading* team wishes you a fantastic birthday filled with happiness, success, and unforgettable moments! \u{1F973}\u{2728}\n\nMay your journey ahead be filled with new opportunities, exciting adventures, and many miles of success. \u{1F6E3}\u{FE0F}\u{1F3C6}\n\n*Keep moving forward. Keep chasing your dreams!* \u{1F698}\u{1F4A8}\n\n*Carz One Motor Trading*";
                    const msg = encodeURIComponent(rawMsg);
                    const phone = client.phone ? client.phone.replace(/[^0-9]/g, '') : '';
                    window.open(phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
                  } else {
                    window.location.href = '/clients';
                  }
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#b45309] hover:bg-[#92400e] text-[#ffffff] rounded-full font-bold transition-all cursor-pointer text-xs whitespace-nowrap shadow-sm border border-amber-500/40"
                title={`${todayBirthdays.length} Client Birthday(s) Today! Click to send WhatsApp wish`}
              >
                <Cake className="w-4 h-4 text-[#ffffff]" />
                <span className="text-[#ffffff] font-extrabold">Birthdays</span>
                <span className="px-1.5 py-0.5 bg-[#ffffff] text-[#b45309] text-[10px] font-black rounded-full">
                  {todayBirthdays.length}
                </span>
              </button>
            </>
          )}

          {/* Page Specific Action Buttons on Top Bar */}
          {pathname.startsWith("/logs") && (
            <>
              <span className="hidden sm:block w-[1px] h-6 bg-white/20" />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("logs:clear"))}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Logs</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("logs:refresh"))}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </>
          )}

          {pathname.startsWith("/stock") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("stock:open-new"))}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <Plus className="w-4 h-4" />
                <span>Add Vehicle</span>
              </button>
            </>
          )}

          {pathname.startsWith("/accounts") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-transfer"))}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                  style={{ minHeight: 44 }}
                >
                  <ArrowLeftRight className="w-4 h-4 text-brand-400" />
                  <span>Transfer Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-new"))}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                  style={{ minHeight: 44 }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Account</span>
                </button>
              </div>
            </>
          )}

          {pathname.startsWith("/clients") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <div className="flex items-center gap-3">
                <div className="relative w-32 sm:w-56">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={headerSearchTerm}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHeaderSearchTerm(val);
                      window.dispatchEvent(new CustomEvent("clients:search", { detail: val }));
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 outline-none focus:border-brand-500 transition-colors text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("clients:open-new"))}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                  style={{ minHeight: 44 }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Client</span>
                </button>
              </div>
            </>
          )}

          {pathname.startsWith("/expenses") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("expenses:open-new"))}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <Plus className="w-4 h-4" />
                <span>Record Expense</span>
              </button>
            </>
          )}

          {pathname.startsWith("/income") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("income:open-new"))}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <Plus className="w-4 h-4" />
                <span>Record Income</span>
              </button>
            </>
          )}

          {(pathname === "/invoices" || pathname.startsWith("/invoices")) && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <Link
                href="/invoices/new"
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <Plus className="w-4 h-4" />
                <span>Create Invoice</span>
              </Link>
            </>
          )}

          {(pathname === "/quotations" || pathname.startsWith("/quotations")) && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <Link
                href="/quotations/new"
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <Plus className="w-4 h-4" />
                <span>Create Quotation</span>
              </Link>
            </>
          )}

          {pathname.startsWith("/ledgers") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("ledgers:open-transfer"))}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                style={{ minHeight: 44 }}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transfer Cash</span>
              </button>
            </>
          )}

          {pathname.startsWith("/forecasts") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <div className="relative inline-flex items-center">
                <select
                  defaultValue="3"
                  onChange={(e) => window.dispatchEvent(new CustomEvent("forecasts:range-change", { detail: { months: parseInt(e.target.value) } }))}
                  className="text-[13px] font-semibold text-white cursor-pointer outline-none appearance-none transition-all pr-9 pl-3.5"
                  style={{ minHeight: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                >
                  <option value="1" style={{ color: '#1d1d1f', backgroundColor: 'white' }}>Next Month</option>
                  <option value="3" style={{ color: '#1d1d1f', backgroundColor: 'white' }}>Next 3 Months</option>
                  <option value="6" style={{ color: '#1d1d1f', backgroundColor: 'white' }}>Next 6 Months</option>
                  <option value="12" style={{ color: '#1d1d1f', backgroundColor: 'white' }}>Next Year</option>
                </select>
                <div className="absolute right-3 pointer-events-none text-white/70">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("forecasts:refresh"))}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white cursor-pointer whitespace-nowrap transition-all hover:opacity-80"
                style={{ padding: '10px 18px', minHeight: 44, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </>
          )}
        </div>

        {/* Right Side: System Stats */}
        <div className="hidden xl:flex items-center gap-5 text-sm text-gray-400">
          {/* Current Time */}
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-medium tabular-nums">{currentTime || "Loading..."}</span>
          </div>

          <span className="w-1 h-1 rounded-full bg-white/20" />

          {/* Current Date */}
          <div className="flex items-center gap-1.5 text-gray-300">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-medium">{currentDate || "Loading..."}</span>
          </div>
        </div>

      </div>
    </header>
  );
};

// ------------------ Sidebar Component (Module Level) ------------------
const Sidebar = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  collapsed,
  toggleCollapsed,
  sidebarHovered,
  setSidebarHovered,
  ignoreHover,
  setIgnoreHover,
  desktopExpanded,
  user,
  isLoaded,
  handleLogout,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
  sidebarHovered: boolean;
  setSidebarHovered: (hovered: boolean) => void;
  ignoreHover: boolean;
  setIgnoreHover: (ignore: boolean) => void;
  desktopExpanded: boolean;
  user: any;
  isLoaded: boolean;
  handleLogout: () => void;
}) => {
  const pathname = usePathname();

  const links: { name: string; href: string; icon: any; divider?: boolean; newtab?: boolean }[] = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Stock", href: "/stock", icon: Car },
    { name: "Accounts", href: "/accounts", icon: Landmark },
    { name: "Ledgers", href: "/ledgers", icon: BookOpen },
    { name: "Income", href: "/income", icon: Wallet },
    { name: "Expenses", href: "/expenses", icon: Receipt },
    { name: "Invoices", href: "/invoices", icon: FileText, divider: true },
    { name: "Quotations", href: "/quotations", icon: NotepadTextDashed },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Reports", href: "/reports", icon: BarChart3,  divider: true  },
    { name: "Forecasts", href: "/forecasts", icon: ChartLine},
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (href === "/invoices") {
      return pathname.startsWith("/invoices") || pathname.startsWith("/invoice");
    }
    return pathname.startsWith(href);
  };

  const sidebarSpring = {
    type: "spring",
    stiffness: 280,
    damping: 28,
    mass: 0.8,
  } as const;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        onMouseEnter={() => {
          if (collapsed && !ignoreHover) {
            setSidebarHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (collapsed) {
            setSidebarHovered(false);
            setIgnoreHover(false);
          }
        }}
        animate={{
          width: desktopExpanded ? 192 : 72,
          x: mobileMenuOpen ? 0 : undefined,
        }}
        transition={sidebarSpring}
        className={`fixed top-0 left-0 h-full bg-brand-500 backdrop-blur-xl border-r border-white/10 z-50
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ overflow: "hidden" }}
      >
        <div className="flex flex-col h-full">

          {/* Logo + Collapse toggle */}
          <div className="flex items-center justify-between border-b border-white/10 h-20 flex-shrink-0 overflow-hidden px-3">

            {desktopExpanded ? (
              <>
                <div className="flex-1 flex justify-start overflow-hidden pl-1">
                  <Link href="/" className="lg:block">
                    <Image
                      src="/logo-trans.png"
                      alt="Carz One"
                      width={160}
                      height={36}
                      style={{ width: 'auto', height: '36px' }}
                      className="flex-shrink-0 animate-fade-in object-contain"
                    />
                  </Link>
                </div>
                
                {/* Desktop: collapse toggle button */}
                <button
                  onClick={toggleCollapsed}
                  className="hidden lg:flex items-center justify-center p-1.5 hover:bg-white/10 rounded-2xl ml-auto text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center relative group w-full h-full">
                {/* Default collapsed: Logo */}
                <div className="group-hover:opacity-0 transition-opacity duration-150 flex items-center justify-center">
                  <Image
                    src="/logo-trans.png"
                    alt="Carz One"
                    width={40}
                    height={40}
                    style={{ width: 'auto', height: '40px' }}
                    className="flex-shrink-0 object-contain"
                  />
                </div>
                {/* Hover collapsed: lock toggle button */}
                <button
                  onClick={toggleCollapsed}
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center p-2 hover:bg-white/10 rounded-2xl text-gray-300 hover:text-white transition-all duration-150 cursor-pointer"
                  title="Expand Sidebar"
                >
                  <PanelLeftOpen className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Mobile: close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-2xl ml-auto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto min-h-0">
            {links.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <div key={item.href} className="flex justify-center lg:block">
                  {item.divider && (
                    <div className="my-2 border-t border-white/10 w-full" />
                  )}
                  <Link
                    href={item.href}
                    prefetch={true}
                    onClick={() => setMobileMenuOpen(false)}
                    target={item.newtab ? "_blank" : "_self"}
                    className={`flex items-center transition-all duration-150 overflow-hidden rounded-full h-10.5
                      ${desktopExpanded
                        ? "w-full justify-start px-0.5"
                        : "w-10.5 justify-center p-0 mx-auto"
                      }
                      ${active
                        ? "active-nav-link bg-accent-500 text-white font-semibold shadow-md shadow-accent-900/40"
                        : "text-brand-100 hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    {/* Fixed 42px icon box */}
                    <span className="w-10.5 h-10.5 flex-shrink-0 flex items-center justify-center">
                      <Icon className="w-5.5 h-5.5" />
                    </span>

                    {desktopExpanded && (
                      <span className="hidden lg:block overflow-hidden whitespace-nowrap text-sm font-medium pl-1 pr-3">
                        {item.name}
                      </span>
                    )}
                    <span className="lg:hidden text-sm font-medium pl-1 pr-3">{item.name}</span>
                  </Link>
                </div>
              );
            })}
          </nav>

          {/* User section & Branding Footer */}
          <div className="p-3 border-t border-white/10 space-y-1">
            {/* Logs Link */}
            <Link
              href="/logs"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center transition-all duration-150 overflow-hidden rounded-full h-10.5
                ${desktopExpanded
                  ? "w-full justify-start px-0.5"
                  : "w-10.5 justify-center p-0 mx-auto"
                }
                ${pathname.startsWith("/logs")
                  ? "active-nav-link bg-accent-500 text-white font-semibold shadow-md shadow-accent-900/40"
                  : "text-brand-100 hover:bg-white/10 hover:text-white"
                }`}
            >
              <span className="w-10.5 h-10.5 flex-shrink-0 flex items-center justify-center">
                <Terminal className="w-5.5 h-5.5" />
              </span>

              {desktopExpanded && (
                <span className="hidden lg:block overflow-hidden whitespace-nowrap text-sm font-medium pl-1 pr-3">
                  Logs
                </span>
              )}
              <span className="lg:hidden text-sm font-medium pl-1 pr-3">Logs</span>
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className={`flex items-center transition-all duration-150 hover:bg-red-500/10 cursor-pointer text-gray-300 hover:text-red-400 overflow-hidden rounded-full h-10.5
                ${desktopExpanded
                  ? "w-full justify-start px-0.5"
                  : "w-10.5 justify-center p-0 mx-auto"
                }`}
            >
              <span className="w-10.5 h-10.5 flex-shrink-0 flex items-center justify-center">
                <LogOut className="w-5.5 h-5.5" />
              </span>

              {desktopExpanded && (
                <span className="hidden lg:block overflow-hidden whitespace-nowrap text-sm font-medium pl-1 pr-3">
                  Logout
                </span>
              )}
              <span className="lg:hidden text-sm font-medium pl-1 pr-3">Logout</span>
            </button>

            {desktopExpanded && (
              <div className="hidden lg:block text-[11px] text-gray-400 px-2 pt-1 border-t border-white/5 space-y-1">
                <p className="leading-tight">
                  Developed by{" "}
                  <a
                    href="https://frametoque.online"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline font-semibold"
                  >
                    Frametoque Digital Media
                  </a>
                </p>
                <p className="text-[10px] text-gray-500 flex items-center justify-between">
                  <span>© {new Date().getFullYear()} All rights reserved.</span>
                  <span className="font-mono text-[9.5px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">v1.2.4</span>
                </p>
              </div>
            )}
            <div className="lg:hidden text-[11px] text-gray-400 px-2 pt-1 border-t border-white/5 space-y-1">
              <p className="leading-tight">
                Developed by{" "}
                <a
                  href="https://frametoque.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:underline font-semibold"
                >
                  Frametoque Digital Media
                </a>
              </p>
              <p className="text-[10px] text-gray-500 flex items-center justify-between">
                <span>© {new Date().getFullYear()} All rights reserved.</span>
                <span className="font-mono text-[9.5px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">v1.2.4</span>
              </p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};