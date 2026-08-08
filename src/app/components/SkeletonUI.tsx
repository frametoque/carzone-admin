"use client";

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export function SkeletonHeader() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <motion.div variants={item} className="h-8 w-48 bg-white/10 rounded-2xl animate-pulse" />
      <motion.div variants={item} className="h-10 w-36 bg-white/10 rounded-full animate-pulse" />
    </motion.div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-6 mb-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div variants={item} key={i} className="bg-white/5 border border-white/10 p-6 flex items-center gap-4" style={{ borderRadius: 16 }}>
          <div className="w-12 h-12 bg-white/10 flex-shrink-0 animate-pulse" style={{ borderRadius: 10 }} />
          <div className="space-y-2 flex-1 animate-pulse">
            <div className="h-3 w-20 bg-white/10 rounded-md" />
            <div className="h-6 w-32 bg-white/10 rounded-lg" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="bg-white/5 border border-white/10 overflow-hidden p-6 space-y-4" style={{ borderRadius: 16 }}>
      <motion.div variants={item} className="h-6 w-1/4 bg-white/10 rounded-lg mb-6 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div variants={item} key={i} className="h-12 w-full bg-white/5 flex items-center justify-between px-4 animate-pulse" style={{ borderRadius: 10 }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10" />
              <div className="h-4 w-36 bg-white/10 rounded-md" />
            </div>
            <div className="h-4 w-24 bg-white/10 rounded-md" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function SkeletonDashboard() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div variants={item} key={i} className="bg-white/5 border border-white/10 p-6 flex items-center gap-4" style={{ borderRadius: 16 }}>
            <div className="w-12 h-12 bg-white/10 animate-pulse" style={{ borderRadius: 10 }} />
            <div className="space-y-2 flex-1 animate-pulse">
              <div className="h-3 w-20 bg-white/10 rounded-md" />
              <div className="h-6 w-28 bg-white/10 rounded-lg" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2 bg-white/5 border border-white/10 p-6 h-[380px] flex flex-col justify-between" style={{ borderRadius: 16 }}>
          <div className="flex justify-between items-center animate-pulse">
            <div className="h-6 w-32 bg-white/10 rounded-lg" />
            <div className="h-6 w-40 bg-white/10 rounded-full" />
          </div>
          <div className="h-[280px] w-full bg-white/5 animate-pulse" style={{ borderRadius: 10 }} />
        </motion.div>
        <div className="space-y-6">
          <motion.div variants={item} className="bg-white/5 border border-white/10 p-6 h-[180px] space-y-3" style={{ borderRadius: 16 }}>
            <div className="h-5 w-28 bg-white/10 rounded-md animate-pulse" />
            <div className="h-24 w-full bg-white/5 animate-pulse" style={{ borderRadius: 10 }} />
          </motion.div>
          <motion.div variants={item} className="bg-white/5 border border-white/10 p-6 h-[180px] space-y-3" style={{ borderRadius: 16 }}>
            <div className="h-5 w-32 bg-white/10 rounded-md animate-pulse" />
            <div className="h-24 w-full bg-white/5 animate-pulse" style={{ borderRadius: 10 }} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
