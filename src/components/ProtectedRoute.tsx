import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import WrongRole from "@/pages/WrongRole";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (!session) {
          setLoading(false);
          return; // Deixa o Router redirecionar se não tiver sessão, ou Login lidar
        }

        setSession(session);

        const { data, error } = await supabase.from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (data) {
            setUserRole(data.role);
        }
      } catch (error) {
        console.error('Erro Auth:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAuth();
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-10 h-10 text-yellow-500" />
      </div>
    );
  }

  // Se não tem sessão, manda pro início (Login público)
  if (!session) {
      window.location.href = '/'; 
      return null;
  }

  // Se tem sessão mas a role não bate, mostra tela de erro
  if (userRole && !allowedRoles.includes(userRole)) {
      return <WrongRole userRole={userRole} requiredRole={allowedRoles} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;