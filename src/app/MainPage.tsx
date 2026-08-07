"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, ClipboardList, Sparkles } from "lucide-react";
import ProfileProgress from "./ProfileProgress";


function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(res => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then(data => {
        setUser({
          fullName: data.user.fullName || "Admin User",
          firstName: (data.user.fullName || "Admin").split(" ")[0],
        });
        setIsLoaded(true);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  const quickActions = [
    {
      href: "/invoices/new",
      icon: FileText,
      label: "Create Invoice",
      className:
        "flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-3xl font-semibold hover:opacity-90 transition-opacity",
    },
    {
      href: "/quotations/new",
      icon: ClipboardList,
      label: "Create Quotation",
      className:
        "flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/20 text-white rounded-3xl font-semibold hover:bg-white/20 transition-all duration-300",
    },
  ];

  if (!isLoaded || !user) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
        {/* Pulse Effect */}
        {/* <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl" /> */}

       <div className="flex items-center gap-2 mb-2">
  <Sparkles className="w-6 h-6 text-brand-400" />
  <span className="text-brand-400 font-semibold">{getGreeting()}</span>
</div>
<h1 className="text-3xl sm:text-4xl font-bold mb-3">
  <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
    Welcome back,&nbsp;
  </span>
  <span className="bg-gradient-to-r from-brand-400 to-brand-500 bg-clip-text text-transparent">
    {user?.firstName || user?.fullName || "there"}!
  </span>
</h1>
<p className="text-gray-300 text-lg mb-6 max-w-2xl">
  Your premium destination for high-quality vehicle parts, lubricants, and automotive spares.&nbsp;
  Explore our inventory and keep vehicles running at peak performance!
</p>


<div className="flex flex-wrap gap-4">
  {quickActions.map((action, idx) => {
    const IconComponent = action.icon;
    return (
      <Link key={idx} href={action.href} className={action.className}>
        <IconComponent className="w-5 h-5" />
        {action.label}
      </Link>
    );
  })}
</div>
      </div>

<ProfileProgress />


    </div>
  );
}
