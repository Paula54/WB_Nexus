import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HelmetProvider } from "react-helmet-async";

// Layouts
import MainLayout from "@/layouts/MainLayout";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
import Subscription from "@/pages/Subscription";
import Domains from "@/pages/Domains";
import Performance from "@/pages/Performance";

// Legal Pages
import Privacidade from "@/pages/legal/Privacidade";
import Termos from "@/pages/legal/Termos";
import Devolucoes from "@/pages/legal/Devolucoes";
import Contacto from "@/pages/legal/Contacto";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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
        <Route path="builder" element={<SiteBuilder />} />
        <Route path="strategy" element={<Strategy />} />
        <Route path="crm" element={<CRM />} />
        <Route path="notes" element={<NotesReminders />} />
        <Route path="social-media" element={<SocialMedia />} />
        <Route path="ads" element={<Ads />} />
        <Route path="seo" element={<SEO />} />
        <Route path="whatsapp" element={<WhatsAppInbox />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/subscription" element={<Subscription />} />
        <Route path="domains" element={<Domains />} />
        <Route path="performance" element={<Performance />} />
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
