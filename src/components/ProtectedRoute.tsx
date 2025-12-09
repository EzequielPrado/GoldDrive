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

        // 2. VALIDAÇÃO REAL: Confirma com o servidor se o usuário ainda existe e o token é válido
        // Isso corrige o problema do F5 onde o cache local diz que está logado mas o token expirou
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn("Sessão inválida ou expirada no servidor.");
          await supabase.auth.signOut(); // Limpa sessão inválida
          if (mounted) setStatus('unauthenticated');
          return;
        }

        // 3. Busca perfil e role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted) {
          if (profileError || !profile) {
            console.error('Erro ao buscar perfil:', profileError);
            // Se o usuário existe mas não tem perfil, é um erro de dados
            setStatus('unauthorized');
          } else {
            // 4. Valida permissão da role
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

    // Timeout de segurança aumentado para conexões lentas
    const timeout = setTimeout(() => {
        if (mounted && status === 'loading') {
             // Tenta verificar se é apenas lentidão ou erro real
             setStatus('unauthorized');
        }
    }, 15000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [allowedRoles]);

  const handleForceLogout = async () => {
      try {
          // 1. Logout no Supabase
          await supabase.auth.signOut();
      } catch (e) {
          console.error("Erro ao deslogar:", e);
      } finally {
          // 2. LIMPEZA BRUTAL: Remove manualmente o token do localStorage
          // Isso garante que o loop seja quebrado
          localStorage.removeItem('golddrive-auth-token');
          localStorage.clear(); // Limpa tudo por garantia
          
          // 3. Redirecionamento forçado via window.location para limpar estado da memória
          window.location.href = '/login';
      }
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
    return <Navigate to="/login" replace />;
  }

  if (status === 'unauthorized') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-red-500/20">
            <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Acesso Negado</h1>
        <p className="text-gray-400 max-w-md mb-8 leading-relaxed">
            Não foi possível validar suas permissões. Isso pode ocorrer se sua conta foi alterada ou se houve um erro de conexão.
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
                className="flex-1 h-14 rounded-2xl font-bold bg-red-600 hover:bg-red-700"
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