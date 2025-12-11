import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  allowedRoles: string[];
}

type AuthStatus = 'loading' | 'authorized' | 'unauthorized' | 'unauthenticated';

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                if (mounted) setStatus('unauthenticated');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            
            if (mounted) {
                if (!profile) {
                    setStatus('unauthorized');
                } else if (!allowedRoles.includes(profile.role)) {
                    setStatus('unauthorized');
                } else {
                    setStatus('authorized');
                }
            }
        } catch (error) {
            console.error("Auth check error:", error);
            if (mounted) setStatus('unauthorized');
        }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            checkUser();
        } else if (event === 'SIGNED_OUT') {
            if (mounted) setStatus('unauthenticated');
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [allowedRoles]);

  const handleForceLogout = async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-12 w-12 text-yellow-500 mx-auto" />
          <p className="text-white font-medium text-sm animate-pulse">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    let redirectUrl = '/login';
    if (allowedRoles.includes('admin')) redirectUrl = '/login/admin';
    else if (allowedRoles.includes('driver')) redirectUrl = '/login/driver';
    return <Navigate to={redirectUrl} replace />;
  }

  if (status === 'unauthorized') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
            <Shield className="w-12 h-12 text-black" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Acesso Negado</h1>
        <p className="text-gray-400 max-w-md mb-8 leading-relaxed text-sm">
            Não foi possível recuperar suas credenciais. Isso pode ocorrer por falha na conexão ou sessão expirada.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
            <Button 
                onClick={() => window.location.reload()} 
                className="flex-1 h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl"
            >
                Tentar Novamente
            </Button>
            <Button 
                variant="destructive"
                onClick={handleForceLogout}
                className="flex-1 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
            >
                Sair Agora
            </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;