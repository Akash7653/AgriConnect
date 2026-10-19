import { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';

const AgriScene3D = lazy(() =>
  import('@/components/landing/AgriScene3D').then((m) => ({ default: m.AgriScene3D }))
);

const SCENE_IMAGE =
  'https://images.pexels.com/photos/9158581/pexels-photo-9158581.jpeg?auto=compress&cs=tinysrgb&w=1200';

export function Scene3DSection() {
  return (
    <section className="relative bg-forest text-ivory py-24 lg:py-32 overflow-hidden">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.p
              className="eyebrow text-agri-emerald mb-5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              A Living Landscape
            </motion.p>
            <motion.h2
              className="font-display font-light text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              The field, rendered in motion.
            </motion.h2>
            <motion.p
              className="mt-7 text-ivory/70 text-lg leading-relaxed max-w-xl text-pretty"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              A gentle three-dimensional study of the agricultural landscape AgriConnect serves —
              rows of crops, rolling hills, and the warmth of the sun. Built to stay light on
              performance, with a static fallback for reduced-motion devices.
            </motion.p>
            <motion.div
              className="mt-8 flex items-center gap-3 text-ivory/50 text-sm"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span className="h-2 w-2 rounded-full bg-agri-emerald animate-pulse" />
              Interactive WebGL scene
            </motion.div>
          </div>

          <motion.div
            className="relative rounded-[2rem] overflow-hidden border border-ivory/10 aspect-square lg:aspect-[4/3] bg-forest-800"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
          >
            <Suspense
              fallback={
                <img
                  src={SCENE_IMAGE}
                  alt="Lush green crops swaying in a field beneath a dramatic sunset"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              }
            >
              <AgriScene3D className="absolute inset-0" />
            </Suspense>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest/40 to-transparent" />
            <div className="pointer-events-none absolute bottom-4 left-4 text-ivory/40 text-xs tracking-ultra-wide">
              AGRICONNECT · 3D
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
