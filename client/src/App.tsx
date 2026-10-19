import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AIntro } from '@/components/AIntro';
import { LandingPage } from '@/pages/LandingPage';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardRoute } from '@/pages/dashboard/DashboardRoute';

function AppRoutes() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isDashboard = location.pathname.startsWith('/dashboard');
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (isLanding) {
      setShowIntro(true);
    }
  }, [isLanding]);

  return (
    <>
      {showIntro && <AIntro onComplete={() => setShowIntro(false)} />}
      {!['/login', '/register'].includes(location.pathname) && !isDashboard && <Navbar />}
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard/*" element={<DashboardRoute />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </AnimatePresence>
      {isLanding && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
