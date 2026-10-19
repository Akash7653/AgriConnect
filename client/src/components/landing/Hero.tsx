import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight } from 'lucide-react';

const HERO_IMAGE =
  'https://images.pexels.com/photos/19392425/pexels-photo-19392425.jpeg?auto=compress&cs=tinysrgb&w=1920';

export function Hero() {
  return (
    <section className="hero-surface relative min-h-[100svh] flex items-end overflow-hidden bg-forest">
      <motion.img
        src={HERO_IMAGE}
        alt="An Indian farmer sowing seeds in a sunlit agricultural field"
        className="absolute inset-0 h-full w-full object-cover object-center"
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.92 }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        loading="eager"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-forest/25 via-forest/20 to-forest/95" />
      <div className="absolute inset-0 bg-gradient-to-r from-forest/85 via-forest/30 to-transparent" />
      <div className="absolute inset-0 bg-forest/10 mix-blend-multiply" />

      <div className="relative mx-auto max-w-9xl px-5 sm:px-8 pb-20 pt-32 w-full">
        <div className="max-w-7xl">
          <motion.p
            className="eyebrow text-ivory/70 mb-7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            AGRICONNECT — THE NETWORK
          </motion.p>

          <motion.h1
            className="font-display font-light text-ivory text-[clamp(3.25rem,8.5vw,9.5rem)] leading-[0.86] tracking-tightest max-w-6xl text-balance"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            A clearer way
            <br />
            to move what the earth
            <br />
            <span className="italic font-normal text-agri-emerald">grows next.</span>
          </motion.h1>

          <motion.p
            className="mt-9 text-ivory/75 text-base sm:text-lg max-w-md leading-relaxed text-pretty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.7 }}
          >
            The digital infrastructure for a fairer journey from the field to every table.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.7 }}
          >
            <Link
              to="/#how-it-works"
              className="group inline-flex items-center gap-2 text-ivory font-medium border-b border-agri-emerald pb-2 hover:text-agri-emerald transition-colors"
            >
              See how it works
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/register?role=farmer"
              className="group inline-flex items-center gap-2 text-ivory/70 hover:text-ivory transition-colors"
            >
              Join as a farmer
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-5 right-5 sm:left-8 sm:right-8 flex items-end justify-between text-ivory/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
      >
        <div className="hidden sm:flex items-center gap-3 text-xs tracking-wide">
          <span className="h-px w-12 bg-ivory/50" />
          Built for farmers, buyers &amp; the living supply chain
        </div>
        <a href="#about" className="group flex items-center gap-2 text-[10px] tracking-ultra-wide">
          SCROLL TO EXPLORE
          <ArrowDownRight className="h-4 w-4 group-hover:translate-y-1 group-hover:translate-x-1 transition-transform" />
        </a>
      </motion.div>
    </section>
  );
}
