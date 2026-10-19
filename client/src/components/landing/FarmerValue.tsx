import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

const splits = [
  { pct: '90%', label: 'Farmer / FPO payout', tone: 'emerald' },
  { pct: '8%', label: 'Platform commission', tone: 'green' },
  { pct: '2%', label: 'Payment & operations reserve', tone: 'soil' },
];

export function FarmerValue() {
  return (
    <section className="relative bg-ivory py-24 lg:py-36">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <motion.p
            className="eyebrow text-agri-green mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Transparent Farmer Value
          </motion.p>
          <motion.h2
            className="font-display font-light text-forest text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            A clear, public value split.
          </motion.h2>
          <motion.p
            className="mt-7 text-charcoal/70 text-lg leading-relaxed text-pretty"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            When produce sells through AgriConnect, the commercial split is intended to be visible
            and consistent. Delivery is charged separately where applicable.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {splits.map((s, i) => (
            <motion.div
              key={s.label}
              className="rounded-3xl p-10 border border-forest/10 bg-white/40 text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <p
                className={`font-display text-6xl lg:text-7xl ${
                  s.tone === 'emerald'
                    ? 'text-agri-emerald'
                    : s.tone === 'green'
                    ? 'text-agri-green'
                    : 'text-soil'
                }`}
              >
                {s.pct}
              </p>
              <p className="mt-4 text-forest font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-10 flex items-start gap-3 text-sm text-charcoal/55 max-w-2xl"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Info className="h-5 w-5 shrink-0 text-soil" />
          <p>
            This is a proposed commercial model, not a guarantee of farmer earnings or completed
            payouts. Actual figures depend on the live backend and per-transaction configuration.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
