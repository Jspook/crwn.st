"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, X, Loader2 } from "lucide-react";

interface RoomScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (roomId: string) => void;
}

export default function RoomScannerModal({
  isOpen,
  onClose,
  onScan,
}: RoomScannerModalProps) {
  const [manualCode, setManualCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setIsSearching(true);
    await new Promise((r) => setTimeout(r, 600));
    onScan(manualCode.trim());
    setIsSearching(false);
    setManualCode("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm glass-heavy !bg-[rgba(245,242,235,0.95)]"
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                    <Scan size={18} className="text-[var(--color-base)]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-primary)]">
                      สแกนห้องลอง
                    </h3>
                    <p className="text-xs text-[var(--color-muted)]">
                      สแกนคิวอาร์โค้ดที่ประตูห้องลองเสื้อ
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

              <div className="px-6 py-6">
                <div className="relative w-full h-40 rounded-xl bg-[var(--color-primary)] flex items-center justify-center overflow-hidden">
                  <motion.div
                    className="absolute left-6 right-6 h-[1px] bg-[var(--color-accent-warm)] shadow-[0_0_15px_var(--color-accent-warm)]"
                    animate={{ y: [-60, 60, -60] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  <Scan size={64} className="text-[var(--color-base)] opacity-20" strokeWidth={0.5} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="px-6 pb-6">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="หรือกรอกรหัสห้องลอง (เช่น fr1)..."
                    className="w-full px-4 py-3 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !manualCode.trim()}
                    className="btn-crwn-primary !py-3 !px-4 disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : "ตกลง"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
