"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ScanLine, LogOut, X } from "lucide-react";
import RoomScannerModal from "@/components/ui/RoomScannerModal";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import CartDrawer from "@/components/ui/CartDrawer";

// Same interfaces...
interface Variant {
  sku: string;
  size: string;
  color: string;
  stock: number;
}
interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  tags: string[];
  variants: Variant[];
  image: string;
}
interface CartItem {
  sku: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [isRoomScannerOpen, setIsRoomScannerOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleRoomScan = async (roomId: string) => {
    // In a real app, validate room ID with backend
    router.push(`/customer/fitting-room?roomId=${roomId}`);
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const res = await fetch(`/api/products/barcode/${barcode}`);
      if (res.ok) {
        const product = await res.json();
        setScannedProduct(product);
      } else {
        alert("ไม่พบสินค้า");
      }
    } catch {
      alert("สแกนไม่สำเร็จ");
    } finally {
      setIsBarcodeScannerOpen(false);
    }
  };

  const addToCart = (product: Product, variant: Variant) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.sku === variant.sku);
      if (existing) {
        return prev.map((item) =>
          item.sku === variant.sku ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          sku: variant.sku,
          productId: product.id,
          name: product.name,
          color: variant.color,
          size: variant.size,
          price: product.price,
          quantity: 1,
        },
      ];
    });
    setScannedProduct(null);
    setIsCartOpen(true);
  };

  const updateQuantity = useCallback((sku: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.sku === sku
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((sku: string) => {
    setCartItems((prev) => prev.filter((item) => item.sku !== sku));
  }, []);

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems }),
      });
      router.push("/customer/checkout");
    } catch (err) {
      alert("ไม่สามารถดำเนินการชำระเงินได้");
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-screen">
      <motion.header
        className="sticky top-0 z-30 px-6 py-4"
        style={{
          background: "rgba(245, 242, 235, 0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--color-primary)] heading-serif">
            crwn.st
          </h1>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors p-2">
              <LogOut size={16} />
            </button>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative btn-crwn !py-2 !px-3"
            >
              <ShoppingBag size={16} />
              {totalCartItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-primary)] text-[var(--color-base)] text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-xl mx-auto w-full">
        {scannedProduct ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full glass p-6 flex flex-col gap-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                  {scannedProduct.category}
                </p>
                <h2 className="text-2xl font-semibold text-[var(--color-primary)]">
                  {scannedProduct.name}
                </h2>
                <p className="text-xl font-medium text-[var(--color-primary)] mt-1">
                  ฿{scannedProduct.price.toFixed(2)}
                </p>
              </div>
              <button onClick={() => setScannedProduct(null)} className="p-2 hover:bg-[var(--glass-border)] rounded-full transition-colors">
                <X size={20} className="text-[var(--color-muted)]" />
              </button>
            </div>
            
            <button
              onClick={() => addToCart(scannedProduct, scannedProduct.variants[0])}
              className="btn-crwn-primary w-full !py-3 mt-4"
            >
              เพิ่มลงตะกร้า
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="text-center w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setIsBarcodeScannerOpen(true)}
              className="w-32 h-32 mx-auto rounded-full bg-[var(--color-primary)] text-[var(--color-base)] flex items-center justify-center hover:scale-105 transition-transform shadow-[0_12px_40px_rgba(31,36,33,0.15)] mb-8"
            >
              <ScanLine size={40} strokeWidth={1} />
            </button>
            <h2 className="text-2xl font-semibold text-[var(--color-primary)] mb-2">
              สแกนเสื้อผ้า
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm mb-12">
              สแกนบาร์โค้ดเพื่อดูรายละเอียดและเพิ่มลงตะกร้า
            </p>
          </motion.div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <button
          onClick={() => setIsRoomScannerOpen(true)}
          className="glass-heavy px-6 py-3 rounded-full flex items-center gap-3 hover:scale-105 transition-transform"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-secondary)]/20 flex items-center justify-center">
            <ScanLine size={16} className="text-[var(--color-primary)]" />
          </div>
          <span className="font-semibold text-[var(--color-primary)] tracking-wide">
            ห้องลองเสื้อ (Fitting Room)
          </span>
        </button>
      </motion.div>

      <RoomScannerModal
        isOpen={isRoomScannerOpen}
        onClose={() => setIsRoomScannerOpen(false)}
        onScan={handleRoomScan}
      />
      <BarcodeScanner
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
