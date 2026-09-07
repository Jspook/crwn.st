"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCw, CheckCircle2, Clock, Shirt } from "lucide-react";

interface FittingOrder {
  id: string;
  roomId: string;
  sku: string;
  productName: string;
  size: string;
  color: string;
  status: "pending" | "preparing" | "complete";
  createdAt: string;
}

export default function FittingRoomStaff() {
  const router = useRouter();
  const [orders, setOrders] = useState<FittingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/fitting-orders");
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Simple polling for real-time feel
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/fitting-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const completeOrders = orders.filter((o) => o.status === "complete");

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 glass rounded-none border-t-0 border-l-0 border-r-0 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-primary)] heading-serif">
            คิวห้องลองเสื้อ
          </h1>
          <p className="text-xs text-[var(--color-muted)]">พอร์ทัลพนักงาน crwn.st</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 overflow-x-auto">
        <div className="flex flex-col md:flex-row gap-6 md:h-[calc(100vh-120px)] h-auto">
          {/* Pending Column */}
          <div className="w-full md:w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                รอดำเนินการ
              </h3>
              <span className="text-xs font-bold bg-[var(--color-accent-rose)]/20 text-[var(--color-accent-rose)] px-2 py-0.5 rounded-full">
                {pendingOrders.length}
              </span>
            </div>
            <div className="flex-1 md:overflow-y-auto space-y-4 pb-4 md:pb-10">
              {pendingOrders.map((order) => (
                <div key={order.id} className="glass p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-[var(--color-primary)] text-[var(--color-base)] rounded-md">
                      ห้อง {order.roomId.toUpperCase()}
                    </span>
                    <Clock size={14} className="text-[var(--color-muted)]" />
                  </div>
                  <h4 className="font-semibold text-[var(--color-primary)] text-sm mb-1">{order.productName}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                    {order.color} · {order.size}
                  </p>
                  <button
                    onClick={() => updateStatus(order.id, "preparing")}
                    className="w-full btn-crwn-primary !py-2 !text-xs"
                  >
                    รับงาน
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preparing Column */}
          <div className="w-full md:w-80 flex flex-col gap-4 mt-6 md:mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                กำลังเตรียม
              </h3>
              <span className="text-xs font-bold bg-[var(--color-accent-sage)]/20 text-[var(--color-accent-sage)] px-2 py-0.5 rounded-full">
                {preparingOrders.length}
              </span>
            </div>
            <div className="flex-1 md:overflow-y-auto space-y-4 pb-4 md:pb-10">
              {preparingOrders.map((order) => (
                <div key={order.id} className="glass p-4 rounded-xl border border-[var(--color-accent-sage)]/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-[var(--color-primary)] text-[var(--color-base)] rounded-md">
                      ห้อง {order.roomId.toUpperCase()}
                    </span>
                    <Shirt size={14} className="text-[var(--color-accent-sage)]" />
                  </div>
                  <h4 className="font-semibold text-[var(--color-primary)] text-sm mb-1">{order.productName}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                    {order.color} · {order.size}
                  </p>
                  <button
                    onClick={() => updateStatus(order.id, "complete")}
                    className="w-full btn-crwn !py-2 !text-xs !border-[var(--color-accent-sage)] !text-[var(--color-accent-sage)]"
                  >
                    ทำเครื่องหมายว่าเสร็จสิ้น
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Column */}
          <div className="w-full md:w-80 flex flex-col gap-4 mt-6 md:mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                เสร็จสิ้น
              </h3>
              <span className="text-xs font-bold bg-[var(--glass-border)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">
                {completeOrders.length}
              </span>
            </div>
            <div className="flex-1 md:overflow-y-auto space-y-4 pb-10 opacity-60">
              {completeOrders.map((order) => (
                <div key={order.id} className="glass p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-[var(--glass-border)] text-[var(--color-primary)] rounded-md">
                      ห้อง {order.roomId.toUpperCase()}
                    </span>
                    <CheckCircle2 size={14} className="text-[var(--color-primary)]" />
                  </div>
                  <h4 className="font-semibold text-[var(--color-primary)] text-sm mb-1">{order.productName}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {order.color} · {order.size}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
