import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RideProvider } from "@/context/RideContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import LoginClient from "./pages/LoginClient";
import LoginDriver from "./pages/LoginDriver";
import LoginAdmin from "./pages/LoginAdmin";
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
      {/* Configuração atualizada do Toast (Sonner) */}
      <Sonner position="top-right" closeButton richColors theme="light" />
      <RideProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Rotas de Login Separadas */}
            <Route path="/login" element={<LoginClient />} /> {/* Default / Passageiro */}
            <Route path="/login/driver" element={<LoginDriver />} />
            <Route path="/login/admin" element={<LoginAdmin />} />
            
            {/* Rotas Protegidas de Cliente */}
            <Route path="/client" element={
              <ProtectedRoute allowedRoles={['client']}>
                <ClientDashboard />
              </ProtectedRoute>
            } />

            {/* Rotas Protegidas de Motorista */}
            <Route path="/driver" element={
              <ProtectedRoute allowedRoles={['driver']}>
                <DriverDashboard />
              </ProtectedRoute>
            } />

            {/* Rotas Protegidas de Admin */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Rotas Comuns (Acessíveis a todos os logados) */}
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['client', 'driver', 'admin']}>
                <Profile />
              </ProtectedRoute>
            } />
            
            <Route path="/wallet" element={
              <ProtectedRoute allowedRoles={['client', 'driver', 'admin']}>
                <Wallet />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </RideProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;