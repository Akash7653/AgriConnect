import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const CTA_IMAGE =
  'https://images.pexels.com/photos/14689034/pexels-photo-14689034.jpeg?auto=compress&cs=tinysrgb&w=1920';

export function FinalCTA() {
  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden bg-forest">
      <img
        src={CTA_IMAGE}
        alt="An elderly farmer harvesting crops in a vibrant green field in India"
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/80 to-forest/30" />

      <div className="relative mx-auto max-w-9xl px-5 sm:px-8 py-24 w-full">
        <div className="max-w-2xl">
          <motion.p
            className="eyebrow text-agri-emerald mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Join the Network
          </motion.p>
          <motion.h2
            className="font-display font-light text-ivory text-4xl sm:text-5xl lg:text-7xl leading-[1.02] tracking-tightest text-balance"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            The next harvest is closer than you think.
          </motion.h2>
          <motion.p
            className="mt-7 text-ivory/75 text-lg leading-relaxed max-w-xl text-pretty"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Whether you grow, buy, or move produce — AgriConnect gives you a clear, connected place
            in the agricultural network.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              to="/register?role=farmer"
              className="group inline-flex items-center justify-center gap-2 bg-agri-emerald text-forest font-semibold px-7 py-4 rounded-full hover:bg-ivory transition-colors"
            >
              Join as a Farmer
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/register?role=buyer"
              className="group inline-flex items-center justify-center gap-2 border border-ivory/40 text-ivory font-medium px-7 py-4 rounded-full hover:bg-ivory/10 transition-colors"
            >
              Join as a Buyer
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
