import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        // 1. Verifica sessão local (Instantâneo)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          if (mounted) setLoading(false);
          return;
        }

        if (mounted) setSession(currentSession);

        // 2. Verifica role nos metadados (Sem ir ao banco de dados)
        // Isso resolve o problema de lentidão/loop
        const metaRole = currentSession.user.user_metadata?.role || 'client';
        
        // Se a role bater, libera imediatamente
        if (allowedRoles.includes(metaRole)) {
            if (mounted) {
                setAuthorized(true);
                setLoading(false);
            }
        } else {
            // Se não bater, tenta buscar no banco apenas por garantia (fallback)
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentSession.user.id)
                .single();
            
            if (mounted) {
                if (profile && allowedRoles.includes(profile.role)) {
                    setAuthorized(true);
                }
                setLoading(false);
            }
        }

      } catch (error) {
        console.error("Auth check error", error);
        if (mounted) setLoading(false);
      }
    };

    checkAuth();

    return () => { mounted = false; };
  }, [allowedRoles]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white gap-4">
        {/* Loading Minimalista */}
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!authorized) {
      // Redireciona para o dashboard correto baseado na role se tentar acessar área errada
      const role = session.user.user_metadata?.role;
      if (role === 'admin') return <Navigate to="/admin" replace />;
      if (role === 'driver') return <Navigate to="/driver" replace />;
      return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;