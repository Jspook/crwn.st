"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Home, Download, Loader2 } from "lucide-react";

interface Receipt {
  id: string;
  memberId: string | null;
  items: {
    sku: string;
    productId: string;
    name: string;
    color: string;
    size: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  paymentMethod: string;
  createdAt: string;
}

export default function EReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await fetch(`/api/receipts/${id}`);
        if (!res.ok) throw new Error("Receipt not found");
        const data = await res.json();
        setReceipt(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReceipt();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[var(--color-muted)]" size={32} />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h2 className="text-xl font-semibold text-[var(--color-primary)] mb-2">อุ๊ปส์!</h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">{error || "ไม่พบใบเสร็จ"}</p>
        <button onClick={() => router.push("/customer/dashboard")} className="btn-crwn">
          กลับสู่หน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen py-12 px-6">
      
      <motion.div
        className="w-full max-w-sm glass-heavy !rounded-3xl overflow-hidden relative shadow-[0_20px_60px_rgba(31,36,33,0.1)]"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 24, stiffness: 200 }}
      >
        {/* Decorative receipt zig-zag top */}
        <div className="absolute top-0 left-0 right-0 h-3 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDAgNSwxMCAxMCwwIiBmaWxsPSIjRjVGMkVCIiAvPjwvc3ZnPg==')] bg-repeat-x opacity-50 z-10" />

        <div className="p-8 pt-10 text-center border-b border-dashed border-[var(--glass-border)]">
          <div className="w-16 h-16 bg-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--color-primary)]/20">
            <CheckCircle2 size={32} className="text-[var(--color-base)]" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl heading-serif text-[var(--color-primary)] mb-1">crwn.st</h1>
          <p className="text-xs text-[var(--color-muted)] font-mono">#{receipt.id}</p>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-4">
            {new Date(receipt.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>

        <div className="p-8 space-y-4 bg-[rgba(255,255,255,0.3)]">
          {receipt.items.map((item) => (
            <div key={item.sku} className="flex justify-between items-start text-sm">
              <div className="flex-1 pr-4">
                <p className="font-semibold text-[var(--color-primary)]">{item.name}</p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">{item.color} · ไซส์ {item.size} x {item.quantity}</p>
              </div>
              <p className="font-medium text-[var(--color-primary)]">฿{(item.price * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="p-8 pt-6 border-t border-dashed border-[var(--glass-border)]">
          <div className="flex justify-between items-center text-sm mb-2 text-[var(--color-text-secondary)]">
            <span>ยอดรวมย่อย</span>
            <span>฿{receipt.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-4 text-[var(--color-text-secondary)]">
            <span>ภาษี (0%)</span>
            <span>฿0.00</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold text-[var(--color-primary)] pt-4 border-t border-[var(--glass-border)]">
            <span>ยอดรวมทั้งสิ้น</span>
            <span>฿{receipt.total.toFixed(2)}</span>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest font-semibold mb-1">ช่องทางการชำระเงิน</p>
            <p className="text-sm font-medium text-[var(--color-primary)] capitalize">
              {receipt.paymentMethod === 'qr' ? 'คิวอาร์ พร้อมเพย์ (QR PromptPay)' : receipt.paymentMethod}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div 
        className="mt-8 flex gap-4 w-full max-w-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <button className="btn-crwn flex-1 flex items-center justify-center gap-2 !py-3 bg-white/50">
          <Download size={16} />
          บันทึก PDF
        </button>
        <button 
          onClick={() => router.push("/customer/dashboard")}
          className="btn-crwn-primary flex-1 flex items-center justify-center gap-2 !py-3"
        >
          <Home size={16} />
          หน้าหลัก
        </button>
      </motion.div>

    </div>
  );
}
