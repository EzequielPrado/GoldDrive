import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  allowedRoles: string[];
}

type AuthStatus = 'loading' | 'authorized' | 'unauthorized' | 'unauthenticated' | 'blocked' | 'pending_driver';

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let mounted = true;

    const check = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            if(mounted) setStatus('unauthenticated');
            return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, driver_status, is_blocked')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (profileError || !profile) {
            console.error("Profile fetch error in ProtectedRoute:", profileError);
            await supabase.auth.signOut(); // Sign out if profile can't be fetched
            if(mounted) setStatus('unauthenticated');
            return;
        }

        if (profile.is_blocked) {
            await supabase.auth.signOut(); // Blocked users must be signed out
            if(mounted) setStatus('blocked');
            return;
        }

        if (profile.role === 'driver' && profile.driver_status === 'PENDING') {
            // Se um motorista pendente tentar acessar qualquer rota que não seja a de pendência, redireciona.
            // A rota /driver-pending deve ser acessível a qualquer driver logado para que o componente DriverPending possa fazer sua própria verificação.
            if (!window.location.pathname.includes('/driver-pending')) {
                if(mounted) setStatus('pending_driver');
                return;
            }
        }

        if (allowedRoles.includes(profile.role)) {
            if(mounted) setStatus('authorized');
        } else {
            // Usuário autenticado, mas com função incorreta para ESTA rota.
            // Desloga para forçar reavaliação ou redirecionamento para o login apropriado.
            await supabase.auth.signOut();
            if(mounted) setStatus('unauthenticated'); // Redireciona para o login genérico
        }
    };

    check();

    return () => { mounted = false; };
  }, [allowedRoles]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin h-8 w-8 text-yellow-500" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // Redireciona para o login genérico, que então lida com logins de função específica
    return <Navigate to="/login" replace />;
  }

  if (status === 'blocked') {
    // Redirecionamento específico para motoristas bloqueados, caso contrário, login genérico com erro
    if (allowedRoles.includes('driver')) { // Se esta rota protegida era para um motorista
        return <Navigate to="/login/driver?blocked=true" replace />;
    }
    return <Navigate to="/login" replace />; // Redirecionamento genérico para outras funções
  }

  if (status === 'pending_driver') {
    return <Navigate to="/driver-pending" replace />;
  }

  if (status === 'unauthorized') {
    // Este estado idealmente não deve ser alcançado se a lógica de logout acima funcionar
    // Mas como um fallback, redireciona para o login genérico
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;