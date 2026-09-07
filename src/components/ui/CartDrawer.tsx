"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

interface CartItem {
  sku: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (sku: string, delta: number) => void;
  onRemoveItem: (sku: string) => void;
  onCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col"
            style={{
              background: "rgba(245, 242, 235, 0.92)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              borderLeft: "1px solid var(--glass-border)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-3">
                <ShoppingBag
                  size={20}
                  className="text-[var(--color-primary)]"
                  strokeWidth={1.5}
                />
                <h2 className="text-lg font-semibold text-[var(--color-primary)]">
                  ตะกร้าสินค้า
                </h2>
                {itemCount > 0 && (
                  <span className="text-xs font-medium bg-[var(--color-primary)] text-[var(--color-base)] px-2 py-0.5 rounded-full">
                    {itemCount}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--glass-border)] transition-colors"
              >
                <X size={18} className="text-[var(--color-muted)]" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <ShoppingBag
                    size={48}
                    className="text-[var(--color-secondary)] opacity-40"
                    strokeWidth={1}
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-primary)]">
                      ตะกร้าสินค้าว่างเปล่า
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      เพิ่มสินค้าจากแคตตาล็อกเพื่อเริ่มต้น
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((item) => (
                    <motion.div
                      key={item.sku}
                      className="glass !rounded-xl p-4 flex gap-4"
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--color-primary)] truncate">
                          {item.name}
                        </h4>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                          {item.color} · ไซส์ {item.size}
                        </p>
                        <p className="text-sm font-medium text-[var(--color-primary)] mt-2">
                          ฿{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => onRemoveItem(item.sku)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-accent-rose)] transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="flex items-center gap-2 bg-[var(--color-base)] rounded-full px-1 py-0.5 border border-[var(--glass-border)]">
                          <button
                            onClick={() => onUpdateQuantity(item.sku, -1)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--glass-border)] transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-semibold text-[var(--color-primary)] w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.sku, 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--glass-border)] transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-[var(--glass-border)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    ยอดรวมย่อย
                  </span>
                  <span className="text-lg font-semibold text-[var(--color-primary)]">
                    ฿{total.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={onCheckout}
                  className="btn-crwn-primary w-full !py-3"
                >
                  ชำระเงิน
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
