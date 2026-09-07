"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "heavy" | "subtle";
  float?: boolean;
  floatDelay?: number;
  glowColor?: "violet" | "cyan" | "rose" | "none";
  onClick?: () => void;
}

const glowMap = {
  violet: "var(--shadow-glow-violet)",
  cyan: "var(--shadow-glow-cyan)",
  rose: "var(--shadow-glow-rose)",
  none: "none",
};

const variantClass = {
  default: "glass",
  heavy: "glass-heavy",
  subtle: "glass-subtle",
};

export default function GlassCard({
  children,
  className = "",
  variant = "default",
  float = true,
  floatDelay = 0,
  glowColor = "none",
  onClick,
}: GlassCardProps) {
  return (
    <motion.div
      className={`${variantClass[variant]} ${className}`}
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.8,
        delay: floatDelay * 0.15,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={
        float
          ? {
              y: -6,
              scale: 1.02,
              boxShadow: glowColor !== "none" ? glowMap[glowColor] : undefined,
              transition: { duration: 0.3, ease: "easeOut" },
            }
          : undefined
      }
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined }}
    >
      {children}
    </motion.div>
  );
}
