import { motion } from 'framer-motion';
import { MapPin, PackageCheck, Route } from 'lucide-react';

const LOGISTICS_IMAGE =
  'https://images.pexels.com/photos/36994958/pexels-photo-36994958.jpeg?auto=compress&cs=tinysrgb&w=1200';

const features = [
  { icon: MapPin, title: 'Zone-based assignments', body: 'Pickups and deliveries matched to a partner’s operating region.' },
  { icon: Route, title: 'Route coordination', body: 'Multi-stop routes planned to reduce empty miles and spoilage.' },
  { icon: PackageCheck, title: 'Proof of delivery', body: 'Digital confirmation at each handoff for full traceability.' },
];

export function Logistics() {
  return (
    <section className="relative bg-ivory py-24 lg:py-36">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <div>
            <motion.p
              className="eyebrow text-agri-green mb-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Farm-to-Market Logistics
            </motion.p>
            <motion.h2
              className="font-display font-light text-forest text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              Coordinated movement, field to doorstep.
            </motion.h2>
            <motion.p
              className="mt-7 text-charcoal/70 text-lg leading-relaxed max-w-xl text-pretty"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Freshness depends on speed. AgriConnect coordinates logistics partners so produce
              travels the shortest viable path from harvest to buyer.
            </motion.p>

            <div className="mt-10 space-y-6">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="flex gap-5"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div className="shrink-0 h-12 w-12 rounded-full bg-forest/5 border border-forest/10 flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-agri-green" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-forest">{f.title}</h3>
                    <p className="text-sm text-charcoal/60 mt-1.5 leading-relaxed">{f.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            className="relative rounded-[2rem] overflow-hidden aspect-[4/5] shadow-cinematic"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
          >
            <img
              src={LOGISTICS_IMAGE}
              alt="A truck loaded with hay travelling through mountainous terrain in India"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
