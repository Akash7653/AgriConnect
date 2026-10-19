import { motion } from 'framer-motion';
import { Hero } from '@/components/landing/Hero';
import { Marquee } from '@/components/landing/Marquee';
import { About } from '@/components/landing/About';
import { SupplyChainProblem } from '@/components/landing/SupplyChainProblem';
import { Ecosystem } from '@/components/landing/Ecosystem';
import { Partnerships } from '@/components/landing/Partnerships';
import { Advantages } from '@/components/landing/Advantages';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Scene3DSection } from '@/components/landing/Scene3DSection';
import { Logistics } from '@/components/landing/Logistics';
import { AgriculturalIntelligence } from '@/components/landing/AgriculturalIntelligence';
import { FarmerValue } from '@/components/landing/FarmerValue';
import { FinalCTA } from '@/components/landing/FinalCTA';

export function LandingPage() {
  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-agri-emerald z-[60] origin-left"
        style={{ scaleX: 0 }}
      />
      <Hero />
      <Marquee />
      <About />
      <SupplyChainProblem />
      <Ecosystem />
      <Partnerships />
      <Advantages />
      <HowItWorks />
      <Scene3DSection />
      <Logistics />
      <AgriculturalIntelligence />
      <FarmerValue />
      <FinalCTA />
    </>
  );
}
