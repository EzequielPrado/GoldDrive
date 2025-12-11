import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, LogOut, RefreshCw } from "lucide-react";
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

    const verifyAccess = async () => {
      try {
        // 1. Tenta pegar a sessão local
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (mounted) setStatus('unauthenticated');
          return;
        }

        // 2. Valida usuário no servidor
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn("Sessão inválida ou expirada no servidor.");
          if (mounted) {
             localStorage.clear();
             setStatus('unauthenticated');
          }
          return;
        }

        // 3. Busca perfil
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted) {
          if (profileError || !profile) {
            console.error('Erro ao buscar perfil:', profileError);
            setStatus('unauthorized');
          } else {
            const hasAccess = allowedRoles.includes(profile.role);
            setStatus(hasAccess ? 'authorized' : 'unauthorized');
          }
        }
      } catch (error) {
        console.error('Erro crítico na verificação:', error);
        if (mounted) setStatus('unauthorized');
      }
    };

    verifyAccess();

    // Timeout aumentado para 15 segundos para evitar falsos positivos no painel admin
    const timeout = setTimeout(() => {
        if (mounted && status === 'loading') {
            setStatus('unauthorized');
        }
    }, 15000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [allowedRoles]);

  const handleForceLogout = () => {
      // Fire and forget logout
      try { supabase.auth.signOut(); } catch (e) { console.error(e); }

      // Limpeza brutal e imediata
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirecionamento inteligente baseado na permissão da rota
      let redirectUrl = '/login';
      if (allowedRoles.includes('admin')) {
          redirectUrl = '/login/admin';
      } else if (allowedRoles.includes('driver')) {
          redirectUrl = '/login/driver';
      }

      window.location.replace(redirectUrl);
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
    // Redirecionamento inteligente também para casos não autenticados
    let redirectUrl = '/login';
    if (allowedRoles.includes('admin')) redirectUrl = '/login/admin';
    else if (allowedRoles.includes('driver')) redirectUrl = '/login/driver';
    
    return <Navigate to={redirectUrl} replace />;
  }

  if (status === 'unauthorized') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-red-500/20">
            <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Acesso Negado</h1>
        <p className="text-gray-400 max-w-md mb-8 leading-relaxed">
            Não foi possível recuperar suas credenciais. Isso pode ocorrer por falha na conexão ou sessão expirada.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <Button 
                onClick={() => window.location.reload()} 
                className="flex-1 h-14 bg-white text-black hover:bg-gray-200 font-bold rounded-2xl"
            >
                <RefreshCw className="mr-2 h-5 w-5" /> Tentar Novamente
            </Button>
            <Button 
                variant="destructive"
                onClick={handleForceLogout}
                className="flex-1 h-14 rounded-2xl font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
            >
                <LogOut className="mr-2 h-5 w-5" /> Sair Agora
            </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;