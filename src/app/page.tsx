"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { LogIn, User, Lock, Phone, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

export default function Login() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"customer" | "staff">("customer");
  
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginType: activeTab,
          identifier,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push(data.redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 min-h-screen">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl tracking-tight mb-2 heading-serif">
          crwn
          <span className="text-[var(--color-secondary)]">.</span>
          st
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          เข้าสู่ระบบ (System Authentication)
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <GlassCard className="p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-8 bg-[var(--color-base)]/50 p-1 rounded-xl border border-[var(--glass-border)]">
            <button
              onClick={() => {
                setActiveTab("customer");
                setError(null);
                setIdentifier("");
                setPassword("");
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === "customer"
                  ? "bg-[var(--glass-bg)] shadow-sm text-[var(--color-primary)] border border-[var(--glass-border)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
              }`}
            >
              ลูกค้า
            </button>
            <button
              onClick={() => {
                setActiveTab("staff");
                setError(null);
                setIdentifier("");
                setPassword("");
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === "staff"
                  ? "bg-[var(--glass-bg)] shadow-sm text-[var(--color-primary)] border border-[var(--glass-border)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
              }`}
            >
              พนักงาน
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {activeTab === "customer" ? (
              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5 block">
                  เบอร์โทรศัพท์
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="tel"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    placeholder="เช่น 0812345678"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5 block">
                    ชื่อผู้ใช้ (Username)
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5 block">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 mt-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !identifier}
              className="btn-crwn-primary w-full mt-4 !py-3"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={16} />
                  เข้าสู่ระบบ
                </span>
              )}
            </button>
            
            {activeTab === "staff" && (
              <div className="mt-4 text-[10px] text-[var(--color-muted)] text-center space-y-1">
                <p>แคชเชียร์ (Cashier): <code className="font-mono bg-[var(--color-base)] px-1 py-0.5 rounded">cashier</code> / <code className="font-mono bg-[var(--color-base)] px-1 py-0.5 rounded">68070254</code></p>
                <p>พนักงานห้องลอง (Fitting): <code className="font-mono bg-[var(--color-base)] px-1 py-0.5 rounded">fitting</code> / <code className="font-mono bg-[var(--color-base)] px-1 py-0.5 rounded">68070056</code></p>
              </div>
            )}
            
            {activeTab === "customer" && (
              <div className="mt-4 text-[10px] text-[var(--color-muted)] text-center space-y-1">
                <p>เบอร์ทดสอบ (Test Phone): <code className="font-mono bg-[var(--color-base)] px-1 py-0.5 rounded">0812345678</code></p>
              </div>
            )}
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}
