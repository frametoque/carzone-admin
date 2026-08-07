"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
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
  ArrowLeftRight
} from "lucide-react";

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [ignoreHover, setIgnoreHover] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed") === "true";
    setCollapsed(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname === "/login") {
      setIsLoaded(true);
      return;
    }
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
    fetchSession();
    return () => { active = false; };
  }, [pathname]);

  if (pathname === "/login") {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <title>Admin | Island Spares</title>
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
      localStorage.setItem("sidebar-collapsed", String(next));
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
        <title>Admin | Island Spares</title>
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

  useEffect(() => {
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
  const shouldShowDateRange = (pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/income") || pathname.startsWith("/expenses") || pathname.startsWith("/ledgers") || pathname.startsWith("/quotations") || (pathname.startsWith("/reports") && !isReportsTrialTab));

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

          {/* Page Title */}
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {getPageTitle(pathname)}
          </h1>

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

          {/* Trial Balance As Of Date Selector in Top Bar */}
          {isReportsTrialTab && (
            <>
              <span className="hidden sm:block w-[1px] h-6 bg-white/20" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase font-semibold">As of:</span>
                <input
                  type="date"
                  value={tbAsOfDate}
                  onChange={(e) => handleTbAsOfDateChange(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none focus:border-brand-500 transition-colors text-sm text-white"
                />
              </div>
            </>
          )}

          {/* Page Specific Action Buttons on Top Bar */}
          {pathname.startsWith("/accounts") && (
            <>
              <span className="hidden sm:block w-[1px] h-5 bg-white/15" />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-transfer"))}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-4 h-4 text-brand-400" />
                  <span>Transfer Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("accounts:open-new"))}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
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
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-3xl font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transfer Cash</span>
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
    { name: "Accounts", href: "/accounts", icon: Landmark },
    { name: "Ledgers", href: "/ledgers", icon: BookOpen },
    { name: "Income", href: "/income", icon: Wallet },
    { name: "Expenses", href: "/expenses", icon: Receipt },
    { name: "Invoices", href: "/invoices", icon: FileText, divider: true },
    { name: "Quotations", href: "/quotations", icon: NotepadTextDashed },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Reports", href: "/reports", icon: BarChart3, divider: true },
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
        className={`fixed top-0 left-0 h-full bg-black backdrop-blur-xl border-r border-white/10 z-50
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
                      alt="IslandSpares"
                      width={120}
                      height={24}
                      className="h-[24px] w-auto flex-shrink-0 animate-fade-in object-contain"
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
                    alt="Logo"
                    width={32}
                    height={32}
                    className="w-8 h-8 flex-shrink-0 object-contain"
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
                        ? "active-nav-link bg-white text-black font-semibold shadow-md shadow-black/20"
                        : "text-gray-300 hover:bg-white/5"
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

          {/* User section */}
          <div className="p-3 border-t border-white/10">
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
          </div>
        </div>
      </motion.aside>
    </>
  );
};