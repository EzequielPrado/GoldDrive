import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            if (mounted) {
                setIsAuthenticated(false);
                setIsLoading(false);
            }
            return;
        }

        // Se tem sessão, busca a role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (mounted) {
            if (profile) {
                setUserRole(profile.role);
                setIsAuthenticated(true);
            } else {
                // Sessão existe mas perfil não (erro raro)
                setIsAuthenticated(false);
            }
            setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth Check Error:", error);
        if (mounted) {
            setIsAuthenticated(false);
            setIsLoading(false);
        }
      }
    };

    checkSession();

    // Listener para mudanças (logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            setIsAuthenticated(false);
            setUserRole(null);
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
        <p className="text-gray-400 text-sm animate-pulse">Verificando credenciais...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirecionamento inteligente baseado na URL que tentou acessar
    if (location.pathname.includes('/admin')) return <Navigate to="/login/admin" replace />;
    if (location.pathname.includes('/driver')) return <Navigate to="/login/driver" replace />;
    return <Navigate to="/login" replace />;
  }

  // Verifica permissão de Role
  if (userRole && !allowedRoles.includes(userRole)) {
      if (userRole === 'admin') return <Navigate to="/admin" replace />;
      if (userRole === 'driver') return <Navigate to="/driver" replace />;
      return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;