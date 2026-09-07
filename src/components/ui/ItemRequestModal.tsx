"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shirt, Check, Loader2 } from "lucide-react";

interface Variant {
  sku: string;
  size: string;
  color: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  variants: Variant[];
  category: string;
  barcode: string;
  tags: string[];
  image: string;
}

interface ItemRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onRequest: (product: Product, variant: Variant, roomId: string) => void;
}

export default function ItemRequestModal({
  isOpen,
  onClose,
  product,
  onRequest,
}: ItemRequestModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("fr1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!product || !selectedVariant) return;
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    onRequest(product, selectedVariant, selectedRoom);
    setIsSubmitting(false);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      setSelectedVariant(null);
    }, 1200);
  };

  if (!product) return null;

  const uniqueColors = [...new Set(product.variants.map((v) => v.color))];
  const uniqueSizes = [...new Set(product.variants.map((v) => v.size))];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
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
                    <Shirt
                      size={18}
                      className="text-[var(--color-base)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-primary)]">
                      คำร้องขอลองชุด
                    </h3>
                    <p className="text-xs text-[var(--color-muted)]">
                      ส่งสินค้าไปยังห้องลองเสื้อ
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

              <div className="px-6 py-4 space-y-5">
                {/* Product info */}
                <div className="glass !rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-[var(--color-primary)]">
                    {product.name}
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {product.category} · ฿{product.price.toFixed(2)}
                  </p>
                </div>

                {/* Size selection */}
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] tracking-wider uppercase mb-2 block">
                    เลือกไซส์
                  </label>
                  <div className="flex gap-2">
                    {uniqueSizes.map((size) => {
                      const variant = product.variants.find(
                        (v) => v.size === size
                      );
                      const isSelected = selectedVariant?.size === size;
                      return (
                        <button
                          key={size}
                          onClick={() => variant && setSelectedVariant(variant)}
                          className={`w-10 h-10 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-[var(--color-primary)] text-[var(--color-base)] border-[var(--color-primary)]"
                              : "bg-[var(--color-base)] text-[var(--color-primary)] border-[var(--glass-border)] hover:border-[var(--color-secondary)]"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color display */}
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] tracking-wider uppercase mb-2 block">
                    สีที่มีให้เลือก
                  </label>
                  <div className="flex gap-2">
                    {uniqueColors.map((color) => (
                      <span
                        key={color}
                        className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-base)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)]"
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Room selection */}
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] tracking-wider uppercase mb-2 block">
                    ห้องลองเสื้อ
                  </label>
                  <div className="flex gap-2">
                    {["fr1", "fr2"].map((room) => (
                      <button
                        key={room}
                        onClick={() => setSelectedRoom(room)}
                        className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedRoom === room
                            ? "bg-[var(--color-primary)] text-[var(--color-base)] border-[var(--color-primary)]"
                            : "bg-[var(--color-base)] text-[var(--color-primary)] border-[var(--glass-border)] hover:border-[var(--color-secondary)]"
                        }`}
                      >
                        ห้อง {room === "fr1" ? "1" : "2"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="px-6 pb-6 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={!selectedVariant || isSubmitting}
                  className="btn-crwn-primary w-full !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSuccess ? (
                    <span className="flex items-center gap-2">
                      <Check size={16} /> ส่งคำร้องแล้ว!
                    </span>
                  ) : isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "ส่งไปยังห้องลองเสื้อ"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
