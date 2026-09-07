"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ScanLine, Search, Plus, Minus, Trash2, CreditCard, Banknote, QrCode } from "lucide-react";
import BarcodeScanner from "@/components/ui/BarcodeScanner";

interface CartItem {
  sku: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
}

export default function CashierPOS() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [memberPhone, setMemberPhone] = useState("");
  const [member, setMember] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("credit");
  
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleScan = async (barcode: string) => {
    try {
      const res = await fetch(`/api/products/barcode/${barcode}`);
      if (res.ok) {
        const product = await res.json();
        // Default to first variant
        const variant = product.variants[0];
        setItems(prev => {
          const existing = prev.find(i => i.sku === variant.sku);
          if (existing) {
            return prev.map(i => i.sku === variant.sku ? { ...i, quantity: i.quantity + 1 } : i);
          }
          return [...prev, {
            sku: variant.sku,
            productId: product.id,
            name: product.name,
            color: variant.color,
            size: variant.size,
            price: product.price,
            quantity: 1
          }];
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuantity = (sku: string, delta: number) => {
    setItems(prev => prev.map(i => i.sku === sku ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const handleCheckout = async () => {
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member?.id || null,
          items,
          total,
          paymentMethod
        })
      });
      if (res.ok) {
        alert("ทำรายการสำเร็จ!");
        setItems([]);
        setMember(null);
        setMemberPhone("");
      } else {
        const err = await res.json();
        alert(err.error || "ทำรายการไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-base)]">
      <header className="px-6 py-4 glass rounded-none border-t-0 border-l-0 border-r-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-primary)] heading-serif">
            ระบบแคชเชียร์ (POS)
          </h1>
          <p className="text-xs text-[var(--color-muted)]">พอร์ทัลแคชเชียร์ crwn.st</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          <LogOut size={16} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Scanner & Items */}
        <div className="w-2/3 p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="flex gap-4">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 glass p-6 flex flex-col items-center justify-center gap-2 hover:bg-[var(--glass-bg-hover)] transition-colors group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <ScanLine size={24} className="text-[var(--color-base)]" />
              </div>
              <span className="font-semibold text-[var(--color-primary)]">สแกนสินค้า</span>
            </button>
            <div className="flex-1 glass p-6 flex flex-col justify-center gap-2">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">ค้นหาสมาชิก</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={memberPhone}
                  onChange={e => setMemberPhone(e.target.value)}
                  placeholder="เบอร์โทรศัพท์"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--color-base)] focus:outline-none focus:border-[var(--color-secondary)]"
                />
                <button
                  onClick={() => setMember({ id: "u1", name: "Alice Customer" })}
                  className="btn-crwn !py-2 !px-3"
                >
                  <Search size={16} />
                </button>
              </div>
              {member && (
                <p className="text-xs font-medium text-[var(--color-accent-sage)] mt-1">
                  สมาชิก: {member.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 glass p-6">
            <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">รายการปัจจุบัน</h2>
            {items.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-[var(--color-muted)]">
                ยังไม่มีการสแกนสินค้า
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map(item => (
                  <div key={item.sku} className="flex items-center justify-between p-3 border border-[var(--glass-border)] rounded-xl">
                    <div>
                      <h4 className="font-medium text-[var(--color-primary)] text-sm">{item.name}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)]">{item.color} · ไซส์ {item.size} · ฿{item.price}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-sm">฿{(item.price * item.quantity).toFixed(2)}</span>
                      <div className="flex items-center gap-2 bg-[var(--color-base)] rounded-lg px-1 py-1 border border-[var(--glass-border)]">
                        <button onClick={() => updateQuantity(item.sku, -1)} className="p-1 hover:bg-[var(--glass-border)] rounded">
                          <Minus size={14} />
                        </button>
                        <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.sku, 1)} className="p-1 hover:bg-[var(--glass-border)] rounded">
                          <Plus size={14} />
                        </button>
                      </div>
                      <button onClick={() => updateQuantity(item.sku, -item.quantity)} className="text-[var(--color-muted)] hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Checkout */}
        <div className="w-1/3 border-l border-[var(--glass-border)] bg-[rgba(255,255,255,0.4)] p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-6">การชำระเงิน</h2>
          
          <div className="space-y-4 mb-8">
            <button
              onClick={() => setPaymentMethod("credit")}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${paymentMethod === "credit" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)]"}`}
            >
              <CreditCard size={20} />
              <span className="font-medium">บัตรเครดิต / เดบิต</span>
            </button>
            <button
              onClick={() => setPaymentMethod("qr")}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${paymentMethod === "qr" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)]"}`}
            >
              <QrCode size={20} />
              <span className="font-medium">คิวอาร์ พร้อมเพย์</span>
            </button>
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${paymentMethod === "cash" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--glass-border)] bg-[var(--color-base)] text-[var(--color-primary)]"}`}
            >
              <Banknote size={20} />
              <span className="font-medium">เงินสด</span>
            </button>
          </div>

          <div className="mt-auto space-y-4">
            <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
              <span>ยอดรวมย่อย</span>
              <span>฿{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
              <span>ภาษี (0%)</span>
              <span>฿0.00</span>
            </div>
            <div className="flex justify-between text-xl font-semibold text-[var(--color-primary)] pt-4 border-t border-[var(--glass-border)]">
              <span>ยอดรวมทั้งสิ้น</span>
              <span>฿{total.toFixed(2)}</span>
            </div>
            
            <button
              onClick={handleCheckout}
              disabled={items.length === 0}
              className="btn-crwn-primary w-full !py-4 mt-6 text-base"
            >
              สรุปการขาย
            </button>
          </div>
        </div>
      </div>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
}
