import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HelmetProvider } from "react-helmet-async";

// Layouts
import MainLayout from "@/layouts/MainLayout";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import CRM from "@/pages/CRM";
import SocialMedia from "@/pages/SocialMedia";
import WhatsAppInbox from "@/pages/WhatsAppInbox";
import Settings from "@/pages/Settings";
import SiteBuilder from "@/pages/SiteBuilder";
import Strategy from "@/pages/Strategy";
import SEO from "@/pages/SEO";
import NotesReminders from "@/pages/NotesReminders";
import Ads from "@/pages/Ads";
import Marketing from "@/pages/Marketing";
import Subscription from "@/pages/Subscription";
import Credits from "@/pages/Credits";
import Invoices from "@/pages/Invoices";
import Domains from "@/pages/Domains";
import Performance from "@/pages/Performance";
import ProfilePage from "@/pages/Profile";
import FreelancerDashboard from "@/pages/FreelancerDashboard";
import Admin from "@/pages/Admin";
import Blog from "@/pages/Blog";
import SessionLanding from "@/pages/SessionLanding";
import AuthConfirm from "@/pages/AuthConfirm";
import BusinessSetup from "@/pages/BusinessSetup";
import Success from "@/pages/Success";

// Legal Pages
import DynamicLegalPage from "@/pages/legal/DynamicLegalPage";
import Contacto from "@/pages/legal/Contacto";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  // Check if URL has auth tokens that Supabase needs to process
  const hasAuthTokensInUrl =
    window.location.hash.includes("access_token") ||
    window.location.search.includes("access_token") ||
    window.location.search.includes("type=recovery") ||
    window.location.search.includes("token_hash");

  useEffect(() => {
    if (hasAuthTokensInUrl) {
      console.log("[ProtectedRoute] Auth tokens detected in URL, waiting for session...");
      console.log("[ProtectedRoute] Hash:", window.location.hash.substring(0, 80));
      console.log("[ProtectedRoute] Search:", window.location.search.substring(0, 80));
    }
  }, []);

  // Timeout: if auth tokens are in URL but session never resolves, stop waiting after 5s
  useEffect(() => {
    if (!hasAuthTokensInUrl || user) return;
    const timer = setTimeout(() => {
      console.warn("[ProtectedRoute] Session not resolved after 5s — redirecting to /auth");
      setTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [hasAuthTokensInUrl, user]);

  const isWaiting = loading || (hasAuthTokensInUrl && !user && !timedOut);

  if (isWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20" />
          <p className="text-sm text-muted-foreground">A carregar dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location, message: timedOut ? "A processar o seu acesso, por favor aguarde ou faça login" : undefined }}
      />
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/session" element={<SessionLanding />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route path="/setup" element={<BusinessSetup />} />
      <Route path="/success" element={<Success />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="builder" element={<SiteBuilder />} />
        <Route path="strategy" element={<Strategy />} />
        <Route path="crm" element={<CRM />} />
        <Route path="notes" element={<NotesReminders />} />
        <Route path="social-media" element={<SocialMedia />} />
        <Route path="ads" element={<Ads />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="seo" element={<SEO />} />
        <Route path="whatsapp" element={<WhatsAppInbox />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/subscription" element={<Subscription />} />
        <Route path="settings/credits" element={<Credits />} />
        <Route path="settings/invoices" element={<Invoices />} />
        <Route path="domains" element={<Domains />} />
        <Route path="performance" element={<Performance />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="freelancer-dashboard" element={<FreelancerDashboard />} />
        <Route path="blog" element={<Blog />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      {/* Legal Routes (Public) */}
      <Route path="/privacy" element={<Privacidade />} />
      <Route path="/privacidade" element={<Navigate to="/privacy" replace />} />
      <Route path="/terms" element={<Termos />} />
      <Route path="/termos" element={<Navigate to="/terms" replace />} />
      <Route path="/devolucoes" element={<Devolucoes />} />
      <Route path="/contacto" element={<Contacto />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
