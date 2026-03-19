import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AirQualityProvider } from '@/context/AirQualityContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import BottomTicker from '@/components/BottomTicker';
import LoadingScreen from '@/components/LoadingScreen';
import Dashboard from '@/pages/Dashboard';
import Predict from '@/pages/Predict';
import Hotspots from '@/pages/Hotspots';
import Advisory from '@/pages/Advisory';
import Analytics from '@/pages/Analytics';
import NotFound from '@/pages/NotFound';
import Login from '@/pages/Login';

const queryClient = new QueryClient();

// Protects all routes — redirects to /login if not signed in
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0e14' }} />
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Inner app — needs AuthProvider already mounted above
const AppInner = () => {
  const [loaded, setLoaded] = useState(false);
  const handleLoadComplete = useCallback(() => setLoaded(true), []);
  const { user } = useAuth();

  return (
    <>
      {/* Only show loading screen for authenticated users */}
      {!loaded && user && <LoadingScreen onComplete={handleLoadComplete} />}
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — all your existing pages */}
          <Route path="/" element={
            <ProtectedRoute>
              <AirQualityProvider>
                <Navbar />
                <Dashboard />
                <BottomTicker />
              </AirQualityProvider>
            </ProtectedRoute>
          } />
          <Route path="/predict" element={
            <ProtectedRoute>
              <AirQualityProvider>
                <Navbar />
                <Predict />
                <BottomTicker />
              </AirQualityProvider>
            </ProtectedRoute>
          } />
          <Route path="/hotspots" element={
            <ProtectedRoute>
              <AirQualityProvider>
                <Navbar />
                <Hotspots />
                <BottomTicker />
              </AirQualityProvider>
            </ProtectedRoute>
          } />
          <Route path="/advisory" element={
            <ProtectedRoute>
              <AirQualityProvider>
                <Navbar />
                <Advisory />
                <BottomTicker />
              </AirQualityProvider>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <AirQualityProvider>
                <Navbar />
                <Analytics />
                <BottomTicker />
              </AirQualityProvider>
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;