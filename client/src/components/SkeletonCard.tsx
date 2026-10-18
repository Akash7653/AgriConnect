import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col justify-between overflow-hidden shadow-sm">
      {/* Top Image area shimmer */}
      <div className="relative aspect-[4/3] w-full rounded-xl skeleton-shimmer overflow-hidden mb-3">
        {/* Fake badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <div className="w-14 h-5 rounded-full bg-white/40 dark:bg-slate-700/50 backdrop-blur-xs" />
          <div className="w-16 h-5 rounded-full bg-white/40 dark:bg-slate-700/50 backdrop-blur-xs" />
        </div>
        <div className="absolute top-2.5 right-2.5">
          <div className="w-12 h-5 rounded-md bg-white/40 dark:bg-slate-700/50 backdrop-blur-xs" />
        </div>
      </div>

      {/* Middle Text area */}
      <div className="space-y-2.5 mb-4">
        {/* Title bar */}
        <div className="h-4 w-4/5 rounded-md skeleton-shimmer" />
        {/* Subtitle / variety */}
        <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />

        {/* Farmer info line */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="h-3 w-2/3 rounded skeleton-shimmer" />
          <div className="flex justify-between">
            <div className="h-2.5 w-24 rounded skeleton-shimmer" />
            <div className="h-2.5 w-16 rounded skeleton-shimmer" />
          </div>
        </div>

        {/* Price box */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-2 w-12 rounded skeleton-shimmer" />
            <div className="h-4 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-2 w-16 rounded skeleton-shimmer ml-auto" />
            <div className="h-3 w-12 rounded skeleton-shimmer ml-auto" />
          </div>
        </div>
      </div>

      {/* Bottom Button shimmer */}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-20 h-8 rounded-xl skeleton-shimmer" />
        <div className="flex-1 h-8 rounded-xl skeleton-shimmer" />
      </div>
    </div>
  );
};
