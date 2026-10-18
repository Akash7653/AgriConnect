import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { MobileDownNav } from './components/MobileDownNav.js';
import { Sidebar } from './components/Sidebar.js';
import { LoadingLogo } from './components/LoadingLogo.js';
import { AtmosphericBackgroundCanvas } from './components/3d/AtmosphericBackgroundCanvas.js';
import { AIAdvisorModal } from './components/AIAdvisorModal.js';
import { AuthModal } from './components/AuthModal.js';
import { LandingPage } from './pages/LandingPage.js';
import { MarketplacePage } from './pages/MarketplacePage.js';
import { CartCheckoutPage } from './pages/CartCheckoutPage.js';
import { FarmerDashboard } from './pages/FarmerDashboard.js';
import { BuyerDashboard } from './pages/BuyerDashboard.js';
import { B2BPortalPage } from './pages/B2BPortalPage.js';
import { LogisticsDashboard } from './pages/LogisticsDashboard.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { UserRole } from './types/index.js';
import { useAuth } from './context/AuthContext.js';

export const App: React.FC = () => {
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultRole, setAuthDefaultRole] = useState<UserRole>('buyer');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleOpenAuth = (role?: UserRole) => {
    if (role) setAuthDefaultRole(role);
    setAuthModalOpen(true);
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-cream-50/70 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 transition-colors relative overflow-x-hidden">
        {/* Animated Loading Screen Logo */}
        <LoadingLogo minDisplayTimeMs={700} />

        {/* Global Living 3D Atmospheric Background */}
        <AtmosphericBackgroundCanvas />

        {/* Desktop Side Navigation Bar (Displayed after login) */}
        {user && <Sidebar onOpenAI={() => setAiModalOpen(true)} />}

        <div className={`flex-1 flex flex-col transition-all duration-300 ${user ? 'md:pl-64' : ''}`}>
          <Navbar
            onOpenAuth={() => handleOpenAuth('buyer')}
            onOpenAI={() => setAiModalOpen(true)}
          />

          <main className="flex-1 pb-20 md:pb-0">
            <Routes>
              <Route
                path="/"
                element={
                  <LandingPage
                    onOpenAuthWithRole={(role) => handleOpenAuth(role as UserRole)}
                    onOpenAI={() => setAiModalOpen(true)}
                  />
                }
              />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/cart" element={<CartCheckoutPage />} />
              <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
              <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
              <Route path="/b2b/procurement" element={<B2BPortalPage />} />
              <Route path="/logistics/dashboard" element={<LogisticsDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>

        {/* Mobile Down-Nav (Fixed Bottom Navigation Bar) */}
        <MobileDownNav onOpenAuth={() => handleOpenAuth('buyer')} />

        {/* Global Floating Modals */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          defaultRole={authDefaultRole}
        />

        <AIAdvisorModal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
        />
      </div>
    </Router>
  );
};

export default App;
