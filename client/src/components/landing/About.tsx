import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const ABOUT_IMAGE =
  'https://images.pexels.com/photos/2382904/pexels-photo-2382904.jpeg?auto=compress&cs=tinysrgb&w=1200';

const pillars = [
  { label: 'Farmers & FPOs', note: 'Direct listing access' },
  { label: 'Households', note: 'Fresh, traceable produce' },
  { label: 'Restaurants & retail', note: 'Reliable B2B supply' },
  { label: 'Logistics partners', note: 'Coordinated fulfilment' },
];

export function About() {
  return (
    <section id="about" className="relative bg-ivory py-24 lg:py-40">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24 items-start">
          <div>
            <motion.p
              className="eyebrow text-agri-green mb-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              02 — Who we are
            </motion.p>
            <motion.h2
              className="font-display font-light text-forest text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              The field is not a starting point. It is the centre.
            </motion.h2>
            <motion.p
              className="mt-7 text-charcoal/70 text-lg leading-relaxed max-w-xl text-pretty"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              AgriConnect brings the people, produce and decisions around agriculture into one
              living network. A clearer route for value to move in both directions: from demand back
              to the field, and from the field to every table.
            </motion.p>

            <div className="mt-12 border-t border-forest/20">
              {pillars.map((p, i) => (
                <motion.div
                  key={p.label}
                  className="flex items-center justify-between gap-5 py-5 border-b border-forest/15 group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  <div>
                    <p className="font-display text-xl text-forest">{p.label}</p>
                    <p className="text-sm text-charcoal/60 mt-1">{p.note}</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-agri-green group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            className="relative lg:pt-16"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative overflow-hidden shadow-cinematic aspect-[4/5]">
              <img
                src={ABOUT_IMAGE}
                alt="Indian women harvesting crops in lush green fields"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-8 -left-4 sm:left-8 bg-forest text-ivory px-6 py-5 shadow-cinematic">
              <p className="font-display text-2xl">Network / field / table</p>
            </div>
          </motion.div>
        </div>
        <p className="mt-10 text-xs text-charcoal/40">A connected agricultural network, designed for the realities of India.</p>
      </div>
    </section>
  );
}
