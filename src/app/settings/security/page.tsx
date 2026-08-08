"use client";

import { useState, useEffect } from "react";
import { Fingerprint, Loader2, ShieldCheck, CheckCircle2, Trash2, MonitorSmartphone } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

export default function SecuritySettingsPage() {
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySuccess, setPasskeySuccess] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/auth/webauthn/devices");
      const data = await res.json();
      if (res.ok) {
        setDevices(data.devices || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const registerPasskey = async () => {
    setPasskeyLoading(true);
    setPasskeyError(null);
    setPasskeySuccess(false);

    try {
      // 1. Generate options
      const optionsRes = await fetch("/api/auth/webauthn/generate-registration-options");
      const optionsData = await optionsRes.json();
      
      if (!optionsRes.ok) throw new Error(optionsData.error || "Failed to generate options");

      // 2. Browser native prompt
      let authResponse;
      try {
        authResponse = await startRegistration({ optionsJSON: optionsData });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
           throw new Error("Registration was canceled.");
        }
        throw err;
      }

      // 3. Verify
      const verifyRes = await fetch("/api/auth/webauthn/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || "Failed to verify passkey");
      }

      setPasskeySuccess(true);
      fetchDevices(); // Refresh list
    } catch (err: any) {
      console.error(err);
      setPasskeyError(err.message || "Failed to register passkey");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const removeDevice = async (credentialId: string) => {
    if (!confirm("Are you sure you want to remove this passkey?")) return;

    try {
      const res = await fetch(`/api/auth/webauthn/devices?credential_id=${encodeURIComponent(credentialId)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchDevices();
      } else {
        alert("Failed to remove device");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to remove device");
    }
  };

  return (
    <div className="w-full animate-fade-in text-white">
      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Passkey Registration Section */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">Device Passkey</h2>
            </div>
          </div>

          <div className="mb-6 text-sm text-gray-300">
            Sign in with a device passkey
          </div>

          {passkeyError && <p className="text-red-400 text-xs mb-3">{passkeyError}</p>}
          {passkeySuccess && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs mb-3 bg-emerald-400/10 p-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              <span>Passkey registered successfully!</span>
            </div>
          )}

          <button
            onClick={registerPasskey}
            disabled={passkeyLoading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold transition-all disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
          >
            {passkeyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Device Passkey"}
          </button>
        </div>

        {/* Registered Devices List */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <MonitorSmartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-white">Registered Devices</h2>
            </div>
          </div>

          {devicesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No devices registered yet.
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.credential_id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {device.device_name || "Unknown Device"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Added: {new Date(device.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeDevice(device.credential_id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors cursor-pointer"
                    title="Revoke Device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      
    </div>
  );
}
