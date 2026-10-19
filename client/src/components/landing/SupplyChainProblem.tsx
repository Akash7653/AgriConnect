import { motion } from 'framer-motion';
import { Unplug, ArrowRight } from 'lucide-react';

const PROBLEM_IMAGE =
  'https://images.pexels.com/photos/1406880/pexels-photo-1406880.jpeg?auto=compress&cs=tinysrgb&w=1200';

const painPoints = [
  {
    n: '01',
    title: 'Fragmented intermediaries',
    body: 'Produce passes through multiple middlemen, each eroding farmer margins and inflating buyer prices.',
  },
  {
    n: '02',
    title: 'Opaque pricing',
    body: 'Farmers rarely see end-prices or demand signals, making planting decisions a gamble.',
  },
  {
    n: '03',
    title: 'Uncoordinated logistics',
    body: 'Pickup, transport and delivery are arranged ad-hoc — causing delays, spoilage and waste.',
  },
];

export function SupplyChainProblem() {
  return (
    <section className="relative bg-charcoal text-ivory py-24 lg:py-36 overflow-hidden">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-14 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative rounded-[2rem] overflow-hidden aspect-[4/3] order-2 lg:order-1"
          >
            <img
              src={PROBLEM_IMAGE}
              alt="Truck loaded with produce on a country road"
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-charcoal/20" />
          </motion.div>

          <div className="order-1 lg:order-2">
            <motion.p
              className="eyebrow text-agri-emerald mb-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              The Problem
            </motion.p>
            <motion.h2
              className="font-display font-light text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              A supply chain that leaves too many behind.
            </motion.h2>

            <div className="mt-10 space-y-7">
              {painPoints.map((p, i) => (
                <motion.div
                  key={p.n}
                  className="flex gap-5 group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <span className="font-display text-agri-emerald text-2xl shrink-0 w-10">{p.n}</span>
                  <div>
                    <h3 className="font-display text-xl text-ivory">{p.title}</h3>
                    <p className="text-ivory/60 mt-2 leading-relaxed text-pretty">{p.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="mt-10 inline-flex items-center gap-2 text-agri-emerald"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Unplug className="h-5 w-5" />
              <span className="text-sm">AgriConnect coordinates every link in the chain.</span>
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
