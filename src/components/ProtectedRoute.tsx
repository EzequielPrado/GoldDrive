import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null = carregando
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (mounted) setIsAuthorized(false);
          return;
        }

        // Tenta pegar a role do metadata (mais rápido e sem request ao banco)
        let role = session.user.user_metadata?.role;

        // Se não tiver no metadata, tenta via RPC (seguro contra RLS loop)
        if (!role) {
            const { data } = await supabase.rpc('get_my_role');
            role = data;
        }

        // Se ainda não tiver, tenta fallback para tabela profiles
        if (!role) {
            const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
            role = data?.role;
        }

        if (mounted) {
            // Verifica se a role encontrada está na lista de permitidos
            if (role && allowedRoles.includes(role)) {
                setIsAuthorized(true);
            } else {
                console.warn(`Acesso negado. Role do usuário: ${role}, Permitido: ${allowedRoles}`);
                setIsAuthorized(false);
            }
        }
      } catch (error) {
        console.error("Erro na verificação de auth:", error);
        if (mounted) setIsAuthorized(false);
      }
    };

    checkAuth();

    return () => { mounted = false; };
  }, [allowedRoles]);

  // Estado de Carregamento
  if (isAuthorized === null) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
                <p className="text-xs text-gray-400 font-medium">Verificando acesso...</p>
            </div>
        </div>
    );
  }

  // Não autorizado -> Redireciona para Login
  if (!isAuthorized) {
      // Evita loop: Se já estiver no login, não faz nada (embora o Router deva cuidar disso)
      
      // Define para qual login mandar baseado na tentativa
      let target = "/login";
      if (location.pathname.includes('/admin')) target = "/login/admin";
      else if (location.pathname.includes('/driver')) target = "/login/driver";
      
      return <Navigate to={target} replace />;
  }

  // Autorizado -> Renderiza o componente
  return <>{children}</>;
};

export default ProtectedRoute;