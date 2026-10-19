import { motion } from 'framer-motion';
import { Sprout, Store, UtensilsCrossed, Building2, Truck, Home } from 'lucide-react';

const ECOSYSTEM_IMAGE =
  'https://images.pexels.com/photos/20858581/pexels-photo-20858581.jpeg?auto=compress&cs=tinysrgb&w=1200';

const actors = [
  { icon: Sprout, name: 'Farmers & FPOs', desc: 'List harvests, manage inventory, receive orders directly.' },
  { icon: Home, name: 'Households', desc: 'Buy fresh, traceable produce with transparent pricing.' },
  { icon: UtensilsCrossed, name: 'Restaurants', desc: 'Source reliable seasonal ingredients at scale.' },
  { icon: Store, name: 'Retailers & Supermarkets', desc: 'Restock efficiently with coordinated delivery.' },
  { icon: Building2, name: 'Institutional Buyers', desc: 'Procure for hospitals, schools and canteens.' },
  { icon: Truck, name: 'Logistics Partners', desc: 'Receive pickup and delivery assignments by zone.' },
];

export function Ecosystem() {
  return (
    <section className="relative bg-ivory py-24 lg:py-36">
      <div className="mx-auto max-w-9xl px-5 sm:px-8">
        <div className="max-w-2xl mb-14">
          <motion.p
            className="eyebrow text-agri-green mb-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            The Ecosystem
          </motion.p>
          <motion.h2
            className="font-display font-light text-forest text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tightest text-balance"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            Every participant, one connected network.
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
          <motion.div
            className="relative rounded-[2rem] overflow-hidden aspect-[5/4] shadow-cinematic order-2 lg:order-1"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
          >
            <img
              src={ECOSYSTEM_IMAGE}
              alt="Workers spreading and drying crops in a sunlit field in India"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </motion.div>

          <div className="order-1 lg:order-2 grid sm:grid-cols-2 gap-5">
            {actors.map((a, i) => (
              <motion.div
                key={a.name}
                className="group p-6 rounded-2xl border border-forest/10 bg-white/40 hover:bg-forest hover:border-forest transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <a.icon
                  className="h-7 w-7 text-agri-green group-hover:text-agri-emerald transition-colors mb-4"
                  strokeWidth={1.5}
                />
                <h3 className="font-display text-lg text-forest group-hover:text-ivory transition-colors">
                  {a.name}
                </h3>
                <p className="text-sm text-charcoal/60 group-hover:text-ivory/70 transition-colors mt-2 leading-relaxed">
                  {a.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
