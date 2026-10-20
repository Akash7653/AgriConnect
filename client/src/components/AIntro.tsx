import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { prefersReducedMotion } from '@/utils';

interface AIntroProps {
  onComplete: () => void;
}

export function AIntro({ onComplete }: AIntroProps) {
  const [stage, setStage] = useState<'dark' | 'draw' | 'zoom' | 'done'>('dark');
  const reduced = typeof window !== 'undefined' && prefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(onComplete, 200);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setStage('draw'), 120);
    const t2 = setTimeout(() => setStage('zoom'), 1700);
    const t3 = setTimeout(() => setStage('done'), 2450);
    const t4 = setTimeout(onComplete, 2700);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [onComplete, reduced]);

  if (stage === 'done') return null;

  const logoScale = stage === 'dark' ? 0.45 : stage === 'zoom' ? 14 : 1;
  const logoOpacity = stage === 'zoom' ? 0 : 1;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-forest"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <motion.div
          className="relative"
          initial={{ scale: 0.45, opacity: 0 }}
          animate={{ scale: logoScale, opacity: logoOpacity }}
          transition={{
            scale: stage === 'zoom' ? { duration: 0.75, ease: [0.76, 0, 0.24, 1] } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
            opacity: stage === 'zoom' ? { duration: 0.5, ease: 'easeIn' } : { duration: 0.4 },
          }}
        >
          <svg
            width="220"
            height="240"
            viewBox="0 0 220 240"
            className="overflow-visible"
            role="img"
            aria-label="AgriConnect animated logo"
          >
            <defs>
              <linearGradient id="aStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38A169" />
                <stop offset="100%" stopColor="#246B45" />
              </linearGradient>
            </defs>
            <motion.path
              d="M110 30 L195 210 H150 L110 110 L70 210 H25 Z"
              fill="none"
              stroke="url(#aStroke)"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="butt"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: stage === 'dark' ? 0 : 1,
                opacity: stage === 'dark' || stage === 'zoom' ? 0 : 1,
              }}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
            />
            <motion.path
              d="M78 168 H142"
              fill="none"
              stroke="#38A169"
              strokeWidth="5"
              strokeLinecap="butt"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: stage === 'dark' || stage === 'draw' ? 0 : 1,
                opacity: stage === 'dark' || stage === 'zoom' ? 0 : 1,
              }}
              transition={{ duration: 0.5, delay: 0.9 }}
            />
          </svg>
        </motion.div>
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-ivory/40 text-xs tracking-ultra-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: stage === 'zoom' ? 0 : 1 }}
          transition={{ duration: 0.4 }}
        >
          AGRICONNECT
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
