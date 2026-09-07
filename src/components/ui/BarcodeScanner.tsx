"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, X, Search, Loader2 } from "lucide-react";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({
  isOpen,
  onClose,
  onScan,
}: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to let the animation settle
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setIsSearching(true);
    // Simulate a brief scan delay
    await new Promise((r) => setTimeout(r, 600));
    onScan(manualCode.trim());
    setIsSearching(false);
    setManualCode("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm"
              style={{
                background: "rgba(245, 242, 235, 0.95)",
                backdropFilter: "blur(32px)",
                WebkitBackdropFilter: "blur(32px)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-glass)",
                boxShadow: "var(--shadow-float-hover)",
              }}
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                    <ScanLine
                      size={18}
                      className="text-[var(--color-base)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-primary)]">
                      สแกนบาร์โค้ด
                    </h3>
                    <p className="text-xs text-[var(--color-muted)]">
                      กรอกหรือสแกนบาร์โค้ดสินค้า
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--glass-border)] transition-colors"
                >
                  <X size={16} className="text-[var(--color-muted)]" />
                </button>
              </div>

              {/* Scanner visualization */}
              <div className="px-6 py-6">
                <div className="relative w-full h-32 rounded-xl bg-gradient-to-br from-[var(--color-accent-warm)]/30 to-[var(--color-base)] border border-dashed border-[var(--color-secondary)]/30 flex items-center justify-center overflow-hidden">
                  {/* Scan line animation */}
                  <motion.div
                    className="absolute left-4 right-4 h-[2px] bg-[var(--color-accent-rose)]/50 rounded-full"
                    animate={{ y: [-40, 40, -40] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <div className="text-center z-10">
                    <ScanLine
                      size={32}
                      className="text-[var(--color-secondary)] opacity-50 mx-auto mb-2"
                      strokeWidth={1}
                    />
                    <p className="text-xs text-[var(--color-muted)]">
                      ระบบสแกนด้วยกล้องจะมาเร็วๆ นี้
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual input */}
              <form onSubmit={handleSubmit} className="px-6 pb-6">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                    />
                    <input
                      ref={inputRef}
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="กรอกหมายเลขบาร์โค้ด..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !manualCode.trim()}
                    className="btn-crwn-primary !py-2.5 !px-4 !text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "ค้นหา"
                    )}
                  </button>
                </div>

                {/* Quick codes for demo */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-[var(--color-muted)] mr-1 self-center">
                    ลองใช้:
                  </span>
                  {[
                    "8901234567890",
                    "8901234567891",
                    "8901234567892",
                  ].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setManualCode(code);
                        onScan(code);
                      }}
                      className="text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-base)] border border-[var(--glass-border)] px-2 py-0.5 rounded-md hover:border-[var(--color-secondary)] transition-colors cursor-pointer"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
