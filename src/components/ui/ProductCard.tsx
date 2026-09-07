"use client";

import { motion } from "framer-motion";
import { Plus, Package } from "lucide-react";

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

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product, variant: Variant) => void;
  onRequestItem?: (product: Product, variant: Variant) => void;
  index?: number;
}

export default function ProductCard({
  product,
  onAddToCart,
  onRequestItem,
  index = 0,
}: ProductCardProps) {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const uniqueColors = [...new Set(product.variants.map((v) => v.color))];
  const uniqueSizes = [...new Set(product.variants.map((v) => v.size))];

  return (
    <motion.div
      className="glass flex flex-col overflow-hidden group"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{
        y: -4,
        boxShadow: "var(--shadow-float-hover)",
        transition: { duration: 0.25 },
      }}
    >
      {/* Product Image Placeholder */}
      <div className="relative h-48 bg-gradient-to-br from-[var(--color-accent-warm)] to-[var(--color-base)] flex items-center justify-center overflow-hidden">
        <Package
          size={48}
          className="text-[var(--color-secondary)] opacity-40"
          strokeWidth={1}
        />
        {/* Category badge */}
        <span className="absolute top-3 left-3 text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--color-text-secondary)] bg-[var(--glass-bg)] backdrop-blur-sm px-2.5 py-1 rounded-full border border-[var(--glass-border)]">
          {product.category}
        </span>
        {totalStock <= 3 && totalStock > 0 && (
          <span className="absolute top-3 right-3 text-[10px] font-medium tracking-wider uppercase text-[var(--color-accent-rose)] bg-[var(--glass-bg)] backdrop-blur-sm px-2.5 py-1 rounded-full border border-[var(--color-accent-rose)]/20">
            สินค้าใกล้หมด
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-primary)] leading-tight">
            {product.name}
          </h3>
          <p className="text-lg font-medium text-[var(--color-primary)] mt-1">
            ฿{product.price.toFixed(2)}
          </p>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {uniqueColors.map((color) => (
            <span
              key={color}
              className="text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-base)] px-2 py-0.5 rounded-full border border-[var(--glass-border)]"
            >
              {color}
            </span>
          ))}
        </div>

        {/* Sizes */}
        <div className="flex items-center gap-1">
          {uniqueSizes.map((size) => (
            <span
              key={size}
              className="text-[10px] font-medium text-[var(--color-muted)] w-7 h-7 flex items-center justify-center rounded-md border border-[var(--glass-border)]"
            >
              {size}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-auto pt-3 flex gap-2">
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product, product.variants[0])}
              className="btn-crwn-primary flex-1 !py-2 !text-xs"
            >
              <Plus size={14} />
              ใส่ตะกร้า
            </button>
          )}
          {onRequestItem && (
            <button
              onClick={() => onRequestItem(product, product.variants[0])}
              className="btn-crwn flex-1 !py-2 !text-xs"
              title="ขอลองชุดในห้องลอง"
            >
              ขอลองชุด
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
