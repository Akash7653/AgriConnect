import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

const AUTH_IMAGE =
  'https://images.pexels.com/photos/38876366/pexels-photo-38876366.jpeg?auto=compress&cs=tinysrgb&w=1200';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-ivory flex">
      <div className="hidden lg:flex lg:w-[46%] relative">
        <img
          src={AUTH_IMAGE}
          alt="An elderly Indian farmer holding a pole against a cloudy sky"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/40 to-forest/20" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Logo variant="light" size="lg" />
          <div>
            <motion.h2
              className="font-display font-light text-ivory text-4xl xl:text-5xl leading-[1.1] tracking-tightest text-balance max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              The land remembers those who tend it with care.
            </motion.h2>
            <p className="mt-5 text-ivory/70 max-w-sm text-pretty">
              Join an agricultural network built around transparency, fair value, and coordinated
              delivery — from farm to every table.
            </p>
          </div>
          <p className="text-ivory/50 text-xs tracking-ultra-wide">FROM FARM TO EVERY TABLE</p>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col">
        <div className="lg:hidden p-6 bg-forest">
          <Logo variant="light" size="md" />
        </div>
        <div className="flex-1 flex items-center justify-center p-6 pt-24 sm:p-12 sm:pt-24">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-2 text-xs font-medium text-ivory shadow-sm transition-colors hover:bg-agri-emerald hover:text-forest"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <h1 className="font-display font-light text-forest text-3xl sm:text-4xl tracking-tightest">
              {title}
            </h1>
            <p className="mt-3 text-charcoal/60 text-pretty">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
