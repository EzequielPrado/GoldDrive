import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
        try {
            // 1. Verifica Sessão
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                if (mounted) setStatus('unauthorized');
                return;
            }

            // 2. Tenta obter role do metadata (mais rápido)
            let role = session.user.user_metadata?.role;

            // 3. Se não tiver no metadata, busca no banco (fonte da verdade)
            if (!role) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .maybeSingle();
                role = profile?.role;
            }

            // 4. Validação final
            if (mounted) {
                if (role && allowedRoles.includes(role)) {
                    setStatus('authorized');
                } else {
                    console.warn(`Acesso negado. Role encontrada: ${role}, Permitidas: ${allowedRoles.join(', ')}`);
                    setStatus('unauthorized');
                }
            }
        } catch (error) {
            console.error("Erro ao verificar acesso:", error);
            if (mounted) setStatus('unauthorized');
        }
    };

    checkAccess();

    // Listener para mudanças de estado (ex: logout em outra aba)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            setStatus('unauthorized');
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (status === 'loading') {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-yellow-500" />
            <p className="text-sm text-gray-400 font-medium animate-pulse">Verificando credenciais...</p>
        </div>
    );
  }

  if (status === 'unauthorized') {
      // Redireciona para o login correto baseado na rota tentada
      let target = "/login";
      if (location.pathname.includes('/admin')) target = "/login/admin";
      else if (location.pathname.includes('/driver')) target = "/login/driver";
      
      return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;