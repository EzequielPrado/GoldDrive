import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [userRole, setUserRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Tenta recuperar sessão existente
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session) {
          // Sessão encontrada, verificar role
          await fetchRole(session.user.id, session.user.user_metadata?.role);
        } else {
          // Nenhuma sessão encontrada
          setSessionStatus('unauthenticated');
        }
      } catch (error) {
        console.error("Erro ao inicializar auth:", error);
        if (mounted) setSessionStatus('unauthenticated');
      }
    };

    const fetchRole = async (userId: string, metadataRole?: string) => {
        if (!mounted) return;
        
        let role = metadataRole;
        
        // Se não tiver no metadata (segurança dupla), busca no banco
        if (!role) {
            const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
            role = data?.role;
        }

        setUserRole(role || 'client');
        setSessionStatus('authenticated');
    };

    initializeAuth();

    // Escuta mudanças em tempo real (Login, Logout, Auto-Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT') {
            setSessionStatus('unauthenticated');
            setUserRole(null);
        } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
            await fetchRole(session.user.id, session.user.user_metadata?.role);
        }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // TELA DE LOADING (Enquanto verifica o "cookie")
  if (sessionStatus === 'loading') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <div className="relative flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-4" />
            <p className="text-gray-400 text-sm font-medium animate-pulse">Restaurando sessão...</p>
        </div>
      </div>
    );
  }

  // NÃO AUTENTICADO -> Redireciona para login correto
  if (sessionStatus === 'unauthenticated') {
    if (location.pathname.includes('/driver')) return <Navigate to="/login/driver" replace />;
    if (location.pathname.includes('/admin')) return <Navigate to="/login/admin" replace />;
    return <Navigate to="/login" replace />;
  }

  // AUTENTICADO MAS SEM PERMISSÃO DE ROLE
  if (userRole && !allowedRoles.includes(userRole)) {
      // Redireciona para o painel correto do usuário se ele tentar acessar área errada
      if (userRole === 'admin') return <Navigate to="/admin" replace />;
      if (userRole === 'driver') return <Navigate to="/driver" replace />;
      return <Navigate to="/client" replace />;
  }

  // TUDO CERTO -> Renderiza a página
  return <>{children}</>;
};

export default ProtectedRoute;