import { motion } from 'framer-motion';
import { Handshake } from 'lucide-react';

const PARTNERS_IMAGE =
  'https://images.pexels.com/photos/40233650/pexels-photo-40233650.jpeg?auto=compress&cs=tinysrgb&w=1200';

const pathways = [
  {
    role: 'Farmers & FPOs',
    body: 'List your harvest, set transparent prices, and reach buyers across regions without relying on intermediaries.',
  },
  {
    role: 'Retailers & Restaurants',
    body: 'Discover verified suppliers, place recurring orders, and schedule deliveries that fit your kitchen or shelf rhythm.',
  },
  {
    role: 'Logistics Partners',
    body: 'Join the fulfilment network to receive pickup and delivery assignments along optimised routes in your operating zone.',
  },
];

export function Partnerships() {
  return (
    <section id="partnerships" className="relative bg-forest text-ivory py-24 lg:py-36 overflow-hidden">
      <div className="absolute inset-0 grain opacity-[0.04]" />
      <div className="mx-auto max-w-9xl px-5 sm:px-8 relative">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-14 lg:gap-20 items-center">
          <div>
            <motion.p
              className="eyebrow text-agri-emerald mb-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Partnerships
            </motion.p>
            <motion.h2
              className="font-display font-light text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              Built for collaboration, not competition.
            </motion.h2>
            <motion.p
              className="mt-7 text-ivory/70 text-lg leading-relaxed max-w-xl text-pretty"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              AgriConnect is designed so every participant — from a single farmer to a national
              retailer — can plug into the same network and find a role that works for them.
            </motion.p>

            <motion.div
              className="mt-10 relative rounded-[2rem] overflow-hidden aspect-[16/10] shadow-cinematic"
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9 }}
            >
              <img
                src={PARTNERS_IMAGE}
                alt="Farmers carrying crates filled with apples in a sunny orchard"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </motion.div>
          </div>

          <div className="space-y-6">
            {pathways.map((p, i) => (
              <motion.div
                key={p.role}
                className="border-l-2 border-agri-emerald/40 pl-6 py-2"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <Handshake className="h-5 w-5 text-agri-emerald" />
                  <h3 className="font-display text-2xl text-ivory">{p.role}</h3>
                </div>
                <p className="mt-3 text-ivory/65 leading-relaxed text-pretty">{p.body}</p>
              </motion.div>
            ))}
            <p className="text-xs text-ivory/40 pt-4">
              AgriConnect does not display invented partner logos. Partner branding appears only
              when partnerships are formally established.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
