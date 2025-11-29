import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    // Timeout de segurança: se o Supabase não responder em 3s, cancela o loading
    const safetyTimeout = setTimeout(() => {
        if (mounted && loading) {
            console.warn("Auth check timed out, redirecting...");
            setLoading(false);
        }
    }, 3000);

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (!session) {
            setLoading(false);
            return;
          }

          setSession(session);
          
          let userRole = session.user.user_metadata?.role;
          if (!userRole) {
             const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
             userRole = data?.role;
          }

          setRole(userRole || 'client');
          setLoading(false);
        }
      } catch (error) {
        console.error("Erro auth:", error);
        if (mounted) setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
       if (mounted) {
           setSession(session);
           if (!session) {
               setLoading(false);
           }
       }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    // Redireciona para o login correto baseado na URL tentada
    if (location.pathname.includes('/driver')) return <Navigate to="/login/driver" replace />;
    if (location.pathname.includes('/admin')) return <Navigate to="/login/admin" replace />;
    return <Navigate to="/login" replace />;
  }

  // Verifica permissão
  if (role && !allowedRoles.includes(role)) {
      if (role === 'admin') return <Navigate to="/admin" replace />;
      if (role === 'driver') return <Navigate to="/driver" replace />;
      return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;