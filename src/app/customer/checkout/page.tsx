"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CreditCard, QrCode, ShieldCheck, Loader2 } from "lucide-react";

interface CartItem {
  sku: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
}

export default function PayAndGoCheckout() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"credit" | "qr" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await fetch("/api/cart");
        const data = await res.json();
        setItems(data.items || []);
      } catch (err) {
        console.error("Failed to load cart", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCart();
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePayment = async () => {
    if (!paymentMethod) return;
    setIsProcessing(true);
    setError(null);

    // Simulate payment delay
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // memberId is set inside the API or passed, for now we will pass null 
          // and let the API figure it out or just rely on session.
          // Wait, the API relies on memberId passed from body or session.
          items,
          total,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      // Clear cart
      await fetch("/api/cart", { method: "DELETE" });

      router.push(`/customer/receipt/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[var(--color-muted)]" size={32} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h2 className="text-xl font-semibold text-[var(--color-primary)] mb-2">ไม่มีสินค้า</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">ตะกร้าสินค้าของคุณว่างเปล่า</p>
        <button onClick={() => router.push("/customer/dashboard")} className="btn-crwn">
          กลับสู่หน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen pb-20">
      <header className="px-6 py-4 flex items-center gap-4 sticky top-0 z-30" style={{ background: "rgba(245,242,235,0.85)", backdropFilter: "blur(20px)" }}>
        <button onClick={() => router.push("/customer/dashboard")} className="p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-[var(--color-primary)] heading-serif">ชำระเงิน (Pay & Go)</h1>
      </header>

      <main className="flex-1 px-6 max-w-xl mx-auto w-full pt-6 flex flex-col gap-8">
        
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">สรุปคำสั่งซื้อ</h2>
          <div className="glass !rounded-2xl p-5 flex flex-col gap-4">
            {items.map((item) => (
              <div key={item.sku} className="flex justify-between items-center border-b border-[var(--glass-border)] pb-3 last:border-0 last:pb-0">
                <div>
                  <h4 className="font-semibold text-[var(--color-primary)] text-sm">{item.name}</h4>
                  <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{item.color} · ไซส์ {item.size} x {item.quantity}</p>
                </div>
                <span className="font-medium text-[var(--color-primary)] text-sm">฿{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 mt-1 border-t border-[var(--glass-border)]">
              <span className="font-medium text-[var(--color-text-secondary)] text-sm">ยอดรวม</span>
              <span className="text-xl font-semibold text-[var(--color-primary)]">฿{total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">ช่องทางการชำระเงิน</h2>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setPaymentMethod("credit")}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                paymentMethod === "credit" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-lg scale-[1.02]" : "border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] hover:border-[var(--color-secondary)]"
              }`}
            >
              <div className={`p-2 rounded-xl ${paymentMethod === "credit" ? "bg-white/20" : "bg-[var(--glass-border)]"}`}>
                <CreditCard size={20} />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-sm">บัตรเครดิต / เดบิต</p>
                <p className={`text-[10px] ${paymentMethod === "credit" ? "text-white/80" : "text-[var(--color-muted)]"}`}>รองรับ Visa, Mastercard, Amex</p>
              </div>
            </button>

            <button
              onClick={() => setPaymentMethod("qr")}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                paymentMethod === "qr" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-lg scale-[1.02]" : "border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)] hover:border-[var(--color-secondary)]"
              }`}
            >
              <div className={`p-2 rounded-xl ${paymentMethod === "qr" ? "bg-white/20" : "bg-[var(--glass-border)]"}`}>
                <QrCode size={20} />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-sm">คิวอาร์ พร้อมเพย์ (QR PromptPay)</p>
                <p className={`text-[10px] ${paymentMethod === "qr" ? "text-white/80" : "text-[var(--color-muted)]"}`}>สแกนด้วยแอปโมบายแบงก์กิ้ง</p>
              </div>
            </button>
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center font-medium">
            {error}
          </div>
        )}

      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 z-40 bg-gradient-to-t from-[var(--color-base)] to-transparent pt-12">
        <div className="max-w-xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--color-muted)]">
            <ShieldCheck size={12} />
            ชำระเงินอย่างปลอดภัยด้วยการเข้ารหัส
          </div>
          <button
            onClick={handlePayment}
            disabled={!paymentMethod || isProcessing}
            className="btn-crwn-primary w-full !py-4 shadow-[0_10px_30px_rgba(31,36,33,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                กำลังดำเนินการ...
              </span>
            ) : (
              `ชำระเงิน ฿${total.toFixed(2)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
