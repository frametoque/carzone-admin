"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, ShieldCheck } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "System Logs",
      href: "/settings/logs",
      icon: Terminal,
      active: pathname.startsWith("/settings/logs"),
    },
    {
      name: "Security & Passkeys",
      href: "/settings/security",
      icon: ShieldCheck,
      active: pathname.startsWith("/settings/security"),
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab.active
                  ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                  : "bg-white/5 border border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {children}
      </div>
    </div>
  );
}
