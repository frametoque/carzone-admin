"use client";

export function SkeletonHeader() {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 animate-pulse">
      <div className="h-8 w-48 bg-white/10 rounded-2xl" />
      <div className="h-10 w-36 bg-white/10 rounded-full" />
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-6 mb-6 animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-20 bg-white/10 rounded-md" />
            <div className="h-6 w-32 bg-white/10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden p-6 animate-pulse space-y-4">
      <div className="h-6 w-1/4 bg-white/10 rounded-lg mb-6" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-white/5 rounded-2xl flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10" />
              <div className="h-4 w-36 bg-white/10 rounded-md" />
            </div>
            <div className="h-4 w-24 bg-white/10 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-20 bg-white/10 rounded-md" />
              <div className="h-6 w-28 bg-white/10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 h-[380px] flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="h-6 w-32 bg-white/10 rounded-lg" />
            <div className="h-6 w-40 bg-white/10 rounded-full" />
          </div>
          <div className="h-[280px] w-full bg-white/5 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 h-[180px] space-y-3">
            <div className="h-5 w-28 bg-white/10 rounded-md" />
            <div className="h-24 w-full bg-white/5 rounded-xl" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 h-[180px] space-y-3">
            <div className="h-5 w-32 bg-white/10 rounded-md" />
            <div className="h-24 w-full bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
