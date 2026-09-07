"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { ArrowLeft, CreditCard, Receipt, ScanBarcode } from "lucide-react";

export default function PosPortal() {
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16 min-h-screen">
      {/* Back nav */}
      <motion.div
        className="w-full max-w-5xl mb-12"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--surreal-text-muted)] hover:text-[var(--surreal-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Portals
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          <span className="text-gradient-cyan">Cashier</span>{" "}
          <span className="text-[var(--surreal-text-primary)]">POS</span>
        </h1>
        <p className="text-[var(--surreal-text-secondary)] text-lg">
          Process transactions with zero friction
        </p>
      </motion.div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <GlassCard
          float
          floatDelay={0}
          glowColor="cyan"
          className="p-8 flex flex-col items-center text-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
            <ScanBarcode size={28} className="text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold">Scan & Add</h3>
          <p className="text-sm text-[var(--surreal-text-secondary)]">
            Rapid barcode scanning to build the transaction in seconds.
          </p>
        </GlassCard>

        <GlassCard
          float
          floatDelay={1}
          glowColor="violet"
          className="p-8 flex flex-col items-center text-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
            <CreditCard size={28} className="text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold">Payment</h3>
          <p className="text-sm text-[var(--surreal-text-secondary)]">
            Simulated payment flows — cash, card, or digital wallet.
          </p>
        </GlassCard>

        <GlassCard
          float
          floatDelay={2}
          glowColor="rose"
          className="p-8 flex flex-col items-center text-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
            <Receipt size={28} className="text-rose-400" />
          </div>
          <h3 className="text-lg font-semibold">E-Receipt</h3>
          <p className="text-sm text-[var(--surreal-text-secondary)]">
            Generate and display digital receipts instantly after checkout.
          </p>
        </GlassCard>
      </div>

      <motion.div
        className="mt-16 w-full max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        <GlassCard variant="subtle" className="p-12 text-center">
          <p className="text-[var(--surreal-text-muted)] text-sm">
            ✦ Full POS interface coming in Loop 4
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
