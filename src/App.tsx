import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AirQualityProvider } from '@/context/AirQualityContext';
import Navbar from '@/components/Navbar';

import BottomTicker from '@/components/BottomTicker';
import LoadingScreen from '@/components/LoadingScreen';
import Dashboard from '@/pages/Dashboard';
import Predict from '@/pages/Predict';
import Hotspots from '@/pages/Hotspots';
import Advisory from '@/pages/Advisory';
import Analytics from '@/pages/Analytics';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient();

const App = () => {
  const [loaded, setLoaded] = useState(false);
  const handleLoadComplete = useCallback(() => setLoaded(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <AirQualityProvider>
          {!loaded && <LoadingScreen onComplete={handleLoadComplete} />}
          <BrowserRouter>
            <Navbar />
            
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/predict" element={<Predict />} />
              <Route path="/hotspots" element={<Hotspots />} />
              <Route path="/advisory" element={<Advisory />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomTicker />
          </BrowserRouter>
        </AirQualityProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
