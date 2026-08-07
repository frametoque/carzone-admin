"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Mail, Lock, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Redirect to dashboard on successful login
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Invalid email or password");
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Login request error:", err);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Decorative Gradient Background (Deep Blue & Red Accent Highlights) */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-[#002f4c]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-[#c11e2f]/10 rounded-full blur-[120px]" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md p-8 sm:p-10 bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] mx-4 z-10 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo-trans.png"
            alt="IslandSpares Logo"
            width={240}
            height={70}
            className="h-16 w-auto object-contain mb-4"
            priority
          />
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Admin Portal Sign In
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            Access secure admin controls & operations
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-[#c11e2f]/10 border border-[#c11e2f]/20 text-[#ff4c5a] text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium ml-1">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="email"
                required
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-[#002f4c] focus:ring-1 focus:ring-[#002f4c]/20 transition-all text-sm"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium ml-1">Secure Password</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-[#002f4c] focus:ring-1 focus:ring-[#002f4c]/20 transition-all text-sm"
              />
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-4 bg-brand-600 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 text-white rounded-2xl font-bold tracking-wide transition-all shadow-[0_4px_20px_rgba(0,47,76,0.3)] cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In to Dashboard</span>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-gray-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Protected by TLS encryption</span>
        </div>
      </div>
    </div>
  );
}
