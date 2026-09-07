"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Filter, X, Loader2 } from "lucide-react";
import ProductCard from "@/components/ui/ProductCard";
import ItemRequestModal from "@/components/ui/ItemRequestModal";

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

function FittingRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get("roomId");

  const [products, setProducts] = useState<Product[]>([]);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestProduct, setRequestProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch products
  useEffect(() => {
    if (!roomId) {
      router.replace("/customer/dashboard");
      return;
    }
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [roomId, router]);

  // Filters
  const categories = [...new Set(products.map((p) => p.category))];
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRequestItem = useCallback((product: Product) => {
    setRequestProduct(product);
    setIsRequestOpen(true);
  }, []);

  const handleSubmitRequest = useCallback(
    async (product: Product, variant: Variant) => {
      try {
        await fetch("/api/fitting-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            sku: variant.sku,
            productName: product.name,
            size: variant.size,
            color: variant.color,
          }),
        });
      } catch (err) {
        console.error("Failed to submit request:", err);
      }
    },
    [roomId]
  );

  if (!roomId) return null;

  return (
    <div className="flex flex-1 flex-col min-h-screen pb-20">
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/customer/dashboard")}
              className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-[var(--color-primary)] heading-serif">
                ห้อง {roomId.toUpperCase()}
              </h1>
              <p className="text-[10px] text-[var(--color-accent-sage)] uppercase tracking-wider font-medium">
                กำลังใช้งาน
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Search & Filters */}
      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              className="w-full pl-11 pr-10 py-3 text-sm rounded-2xl glass focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--glass-border)] transition-colors"
              >
                <X size={14} className="text-[var(--color-muted)]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter size={14} className="text-[var(--color-muted)] shrink-0" />
            <button
              onClick={() => setSelectedCategory(null)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap border transition-all ${
                !selectedCategory
                  ? "bg-[var(--color-primary)] text-[var(--color-base)] border-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] border-[var(--glass-border)] hover:border-[var(--color-secondary)]"
              }`}
            >
              ทั้งหมด
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap border transition-all ${
                  selectedCategory === cat
                    ? "bg-[var(--color-primary)] text-[var(--color-base)] border-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] border-[var(--glass-border)] hover:border-[var(--color-secondary)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="px-6 flex-1">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[var(--color-muted)]" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-[var(--color-muted)]">ไม่พบสินค้า</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  // Hide cart button in fitting room mode
                  onAddToCart={() => {}}
                  onRequestItem={() => handleRequestItem(product)}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ItemRequestModal
        isOpen={isRequestOpen}
        onClose={() => {
          setIsRequestOpen(false);
          setRequestProduct(null);
        }}
        product={requestProduct}
        onRequest={(p, v) => handleSubmitRequest(p, v)}
      />
    </div>
  );
}

export default function FittingRoom() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-[var(--color-muted)]" /></div>}>
      <FittingRoomContent />
    </Suspense>
  );
}
