import { motion } from 'framer-motion';
import { Sparkles, CloudRain, TrendingUp } from 'lucide-react';

const AI_IMAGE =
  'https://images.pexels.com/photos/33786747/pexels-photo-33786747.jpeg?auto=compress&cs=tinysrgb&w=1200';

const working = [
  { icon: Sparkles, title: 'AI Assistant', body: 'An assistant to help farmers phrase listings and buyers compose orders — available where integrated.' },
];

const planned = [
  { icon: TrendingUp, title: 'Demand insights', body: 'Price and demand signals to guide planting decisions. Planned.' },
  { icon: CloudRain, title: 'Weather & market info', body: 'Localised weather and mandi-price context. Planned.' },
];

export function AgriculturalIntelligence() {
  return (
    <section className="relative bg-forest text-ivory py-24 lg:py-36 overflow-hidden">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-14 lg:gap-20 items-center">
          <div>
            <motion.p
              className="eyebrow text-agri-emerald mb-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Agricultural Intelligence
            </motion.p>
            <motion.h2
              className="font-display font-light text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              Intelligence that serves the field, not the other way around.
            </motion.h2>

            <div className="mt-12 space-y-8">
              <div>
                <p className="eyebrow text-agri-emerald/80 mb-4">Working where integrated</p>
                <div className="space-y-4">
                  {working.map((w, i) => (
                    <motion.div
                      key={w.title}
                      className="flex gap-5 p-5 rounded-2xl bg-ivory/5 border border-ivory/10"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    >
                      <w.icon className="h-6 w-6 text-agri-emerald shrink-0" strokeWidth={1.5} />
                      <div>
                        <h3 className="font-display text-lg text-ivory">{w.title}</h3>
                        <p className="text-sm text-ivory/60 mt-1.5 leading-relaxed">{w.body}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow text-ivory/40 mb-4">Planned capabilities</p>
                <div className="space-y-4">
                  {planned.map((p, i) => (
                    <motion.div
                      key={p.title}
                      className="flex gap-5 p-5 rounded-2xl border border-dashed border-ivory/15"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    >
                      <p.icon className="h-6 w-6 text-ivory/40 shrink-0" strokeWidth={1.5} />
                      <div>
                        <h3 className="font-display text-lg text-ivory/70">{p.title}</h3>
                        <p className="text-sm text-ivory/45 mt-1.5 leading-relaxed">{p.body}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
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
              src={AI_IMAGE}
              alt="Lush green corn plants under a golden sunset"
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest/60 to-transparent" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
