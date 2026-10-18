import React, { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';

export const LoadingLogo: React.FC<{ minDisplayTimeMs?: number }> = ({ minDisplayTimeMs = 800 }) => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 500);
      return () => clearTimeout(hideTimer);
    }, minDisplayTimeMs);

    return () => clearTimeout(timer);
  }, [minDisplayTimeMs]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-cream-50 dark:bg-slate-950 transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient radial glow */}
      <div className="absolute w-96 h-96 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 blur-[100px] pointer-events-none animate-pulse" />

      <div className="relative flex flex-col items-center space-y-6 text-center px-4">
        {/* Pulsing Sprout Brand Icon with Glowing Rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-3xl bg-emerald-500/20 dark:bg-emerald-400/20 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-forest blur-sm opacity-60" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-forest flex items-center justify-center text-white shadow-2xl shadow-emerald-700/30">
            <Sprout className="w-9 h-9 text-emerald-200 animate-pulse" />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-forest dark:text-emerald-400">
              AgriConnect
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Real-Time
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            From Farm to Every Table
          </p>
        </div>

        {/* Shimmering Progress Bar */}
        <div className="w-48 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 w-full animate-shimmer" />
        </div>
      </div>
    </div>
  );
};
