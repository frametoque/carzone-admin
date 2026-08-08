"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Mail, Lock, Loader2, ShieldCheck, AlertCircle, Fingerprint, ArrowRight, ArrowLeft } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

export default function LoginPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyFailCount, setPasskeyFailCount] = useState(0);
  const [passkeyBlocked, setPasskeyBlocked] = useState(false);

  // Step 1: Email & Password
  const handleStep1Submit = async (e: React.FormEvent) => {
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
        if (data.step2Required) {
          setStep(2);
          // Automatically attempt passkey once we reach step 2
          triggerPasskey();
        } else {
          // No 2FA setup yet, log them directly in
          window.location.href = "/dashboard";
        }
      } else {
        setError(data.error || "Invalid email or password");
      }
    } catch (err) {
      console.error("Login request error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Biometrics (Auto-triggered or manual retry)
  const triggerPasskey = async () => {
    setError(null);
    setPasskeyLoading(true);
    
    try {
      // 1. Get authentication options from server
      const optionsRes = await fetch("/api/auth/webauthn/generate-authentication-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const optionsData = await optionsRes.json();
      
      if (!optionsRes.ok) {
        setError(optionsData.error || "Failed to generate passkey options");
        setPasskeyLoading(false);
        return;
      }

      // 2. Start authentication in browser
      const authResponse = await startAuthentication({ optionsJSON: optionsData });

      // 3. Verify authentication response on server
      const verifyRes = await fetch("/api/auth/webauthn/verify-authentication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, response: authResponse }),
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok && verifyData.verified) {
        window.location.href = "/dashboard";
      } else {
        setError(verifyData.error || "Passkey verification failed");
        setPasskeyFailCount(prev => prev + 1);
      }
    } catch (err: any) {
      console.warn("Passkey login error/canceled:", err);
      if (err.name === 'NotAllowedError') {
        // The user dismissed the prompt or the browser blocked it because of missing user activation
        setPasskeyBlocked(true);
        setError("Passkey prompt was canceled or blocked. Please click the button to try again.");
      } else {
        setPasskeyFailCount(prev => prev + 1);
        setError(err.message || "Failed to start passkey login.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // OTP Fallback
  const requestOtp = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStep(3);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send OTP");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json();
        setError(data.error || "Invalid OTP");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden select-none">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-[#002f4c]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-[#c11e2f]/10 rounded-full blur-[120px]" />

      <div className="relative w-full max-w-md p-8 sm:p-10 bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] mx-4 z-10 transition-all duration-300">
        
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
            {step === 1 ? "Admin Portal Sign In" : "2-Step Verification"}
          </h2>
          <p className="text-gray-400 text-xs mt-1 text-center">
            {step === 1 ? "Access secure admin controls & operations" : "Please verify your identity to continue"}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-[#c11e2f]/10 border border-[#c11e2f]/20 text-[#ff4c5a] text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-5 animate-fade-in">
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-4 bg-brand-600 hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50 text-white rounded-2xl font-bold tracking-wide transition-all shadow-[0_4px_20px_rgba(0,47,76,0.3)] cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            {/* Passkey Retry Button */}
            <button
              type="button"
              onClick={triggerPasskey}
              disabled={passkeyLoading || submitting}
              className="w-full flex flex-col items-center justify-center gap-3 py-6 border border-brand-500/30 bg-brand-900/20 hover:bg-brand-900/40 active:scale-[0.98] disabled:opacity-50 text-white rounded-2xl transition-all cursor-pointer"
            >
              {passkeyLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
              ) : (
                <Fingerprint className="w-8 h-8 text-brand-400" />
              )}
              <div className="text-center">
                <span className="block font-bold tracking-wide">Use Biometrics / Device Lock</span>
                <span className="text-[10px] text-gray-400 mt-1">Recommended for faster login</span>
              </div>
            </button>

            {(passkeyBlocked || passkeyFailCount >= 3) && (
              <>
                <div className="flex items-center justify-center gap-4 mt-6">
                  <div className="h-px bg-white/10 flex-1"></div>
                  <span className="text-xs text-gray-500">OR</span>
                  <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <button 
                  onClick={requestOtp}
                  disabled={submitting}
                  className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white transition-colors mx-auto"
                >
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  <span>Sign in from a new device</span>
                </button>
              </>
            )}

            <button 
              onClick={() => { setStep(1); setError(null); setPasskeyFailCount(0); setPasskeyBlocked(false); }}
              className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mx-auto"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Login</span>
            </button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={verifyOtp} className="space-y-6 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Check Your Email</h3>
              <p className="text-xs text-gray-400 mt-1">We've sent a 6-digit code to {email}</p>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • • • •"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 text-white placeholder-gray-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all text-xl tracking-[1em] text-center font-mono font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="w-full mt-2 flex items-center justify-center gap-2 py-4 bg-brand-600 hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50 text-white rounded-2xl font-bold tracking-wide transition-all shadow-[0_4px_20px_rgba(0,47,76,0.3)] cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>Verify Code</span>
              )}
            </button>

            <button 
              type="button"
              onClick={() => { setStep(2); setOtp(""); setError(null); }}
              className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mx-auto"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Passkeys</span>
            </button>
          </form>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-gray-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Protected by TLS encryption & WebAuthn</span>
        </div>
      </div>
    </div>
  );
}
