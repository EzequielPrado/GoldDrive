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
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (mounted) setLoading(false);
          return;
        }

        if (mounted) setSession(session);

        // Busca a role no perfil com timeout para não travar
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (mounted) {
            if (profile) {
                setUserRole(profile.role);
            } else {
                // Fallback se o profile ainda não foi criado (race condition do signup)
                // Tenta ler dos metadados ou define padrão
                setUserRole(session.user.user_metadata?.role || 'client');
            }
            setLoading(false);
        }
      } catch (error) {
        console.error("Auth check error", error);
        if (mounted) setLoading(false);
      }
    };

    checkAuth();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-yellow-500" />
        <p className="text-gray-500 font-medium animate-pulse">Carregando GoldDrive...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se tiver a role mas ela não estiver na lista de permitidas
  if (userRole && !allowedRoles.includes(userRole)) {
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    if (userRole === 'driver') return <Navigate to="/driver" replace />;
    if (userRole === 'client') return <Navigate to="/client" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;