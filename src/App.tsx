import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RideProvider } from "@/context/RideContext";

import Index from "./pages/Index";
import Login from "./pages/Login";
import ClientDashboard from "./pages/ClientDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Wallet from "./pages/Wallet";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RideProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/driver" element={<DriverDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </RideProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;