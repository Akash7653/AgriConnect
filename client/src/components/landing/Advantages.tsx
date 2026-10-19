import { motion } from 'framer-motion';
import { BadgePercent, Search, Layers, ShoppingBag, Truck } from 'lucide-react';

const advantages = [
  {
    icon: BadgePercent,
    title: 'Transparent pricing',
    body: 'Farmers and buyers see the same price structure — no hidden margins, no last-minute surprises.',
  },
  {
    icon: Search,
    title: 'Buyer discovery',
    body: 'Farmers reach households, restaurants and institutions beyond their local mandi.',
  },
  {
    icon: Layers,
    title: 'Crop availability',
    body: 'Live listings show what is harvest-ready, in stock, and where it can be delivered.',
  },
  {
    icon: ShoppingBag,
    title: 'Digital ordering',
    body: 'Buyers place and repeat orders through a single, structured digital workflow.',
  },
  {
    icon: Truck,
    title: 'Coordinated fulfilment',
    body: 'Pickups and deliveries are matched to logistics partners across zones and routes.',
  },
];

export function Advantages() {
  return (
    <section className="relative bg-ivory py-24 lg:py-36">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="max-w-2xl mb-16">
          <motion.p
            className="eyebrow text-agri-green mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Why AgriConnect
          </motion.p>
          <motion.h2
            className="font-display font-light text-forest text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            Advantages that change the equation.
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-forest/10 border border-forest/10 rounded-3xl overflow-hidden">
          {advantages.map((a, i) => (
            <motion.div
              key={a.title}
              className="bg-ivory p-8 lg:p-10 hover:bg-forest hover:text-ivory transition-colors duration-300 group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <a.icon
                className="h-8 w-8 text-agri-green group-hover:text-agri-emerald transition-colors mb-5"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-xl text-forest group-hover:text-ivory transition-colors">
                {a.title}
              </h3>
              <p className="mt-3 text-charcoal/65 group-hover:text-ivory/75 transition-colors leading-relaxed text-pretty">
                {a.body}
              </p>
            </motion.div>
          ))}
          <motion.div
            className="bg-ivory p-8 lg:p-10 flex flex-col justify-end hover:bg-forest transition-colors duration-300 group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <p className="font-display text-2xl text-forest group-hover:text-ivory transition-colors leading-tight">
              A fairer, faster, more visible agricultural network.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
