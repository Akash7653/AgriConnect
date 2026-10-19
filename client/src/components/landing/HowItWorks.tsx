import { motion } from 'framer-motion';

const steps = [
  {
    n: '01',
    title: 'Farmer lists harvest',
    body: 'A farmer or FPO lists a crop with quantity, unit price, harvest date and delivery zone.',
  },
  {
    n: '02',
    title: 'Buyer places order',
    body: 'Households, restaurants, retailers or institutions discover produce and place orders.',
  },
  {
    n: '03',
    title: 'Inventory & confirmation',
    body: 'Stock is reserved, the order is confirmed, and the farmer is notified to prepare the produce.',
  },
  {
    n: '04',
    title: 'Coordinated fulfilment',
    body: 'A logistics partner receives a pickup assignment and collects the harvest from the farm.',
  },
  {
    n: '05',
    title: 'Delivery & settlement',
    body: 'Produce reaches the buyer. The farmer payout is calculated per the transparent value model.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-charcoal text-ivory py-24 lg:py-36 overflow-hidden">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="max-w-2xl mb-16">
          <motion.p
            className="eyebrow text-agri-emerald mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            How It Works
          </motion.p>
          <motion.h2
            className="font-display font-light text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            From listing to delivery, in five clear steps.
          </motion.h2>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-[88px] h-px bg-ivory/15 hidden lg:block" />
          <div className="grid gap-10 lg:grid-cols-5 lg:gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <span className="font-display text-5xl text-agri-emerald">{s.n}</span>
                  <div className="h-px flex-1 bg-ivory/15" />
                </div>
                <h3 className="font-display text-xl text-ivory mb-3">{s.title}</h3>
                <p className="text-ivory/60 leading-relaxed text-sm text-pretty">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="mt-12 text-xs text-ivory/40">
          This is the intended end-to-end workflow. Some capabilities are under active development.
        </p>
      </div>
    </section>
  );
}
