const WORDS = [
  'From Farm to Every Table',
  'Transparent Pricing',
  'Verified Farmers',
  'Coordinated Logistics',
  'Fresh Produce',
  'Connected Ecosystem',
  'Agricultural Intelligence',
  'Fair Value',
];

export function Marquee() {
  const sequence = [...WORDS, ...WORDS];
  return (
    <div className="relative bg-forest text-ivory py-6 overflow-hidden border-y border-ivory/10">
      <div className="flex whitespace-nowrap animate-[marquee_32s_linear_infinite] will-change-transform">
        {sequence.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-6 px-6">
            <span className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tightest text-ivory/90">
              {w}
            </span>
            <span className="text-agri-emerald text-2xl">✦</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[marquee_32s_linear_infinite\\] { animation: none; }
        }
      `}</style>
    </div>
  );
}
