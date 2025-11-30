import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Car, ShieldCheck, User, ArrowRight, LogIn, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Usuário já logado, verifica a role para redirecionar
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (profile?.role === 'admin') {
            navigate('/admin');
            return;
          } else if (profile?.role === 'driver') {
            navigate('/driver');
            return;
          } else if (profile?.role === 'client') {
            navigate('/client');
            return;
          }
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        // Se não tiver sessão ou der erro, libera a home page
        setCheckingSession(false);
      }
    };

    checkUser();
  }, [navigate]);

  if (checkingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin mb-4" />
        <p className="text-gray-400 text-sm animate-pulse">Verificando acesso...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
         <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-yellow-600/20 rounded-full blur-[120px]" />
         <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-zinc-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl w-full space-y-12 z-10 animate-in fade-in duration-700">
        <div className="text-center space-y-6">
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter">
            Gold<span className="text-yellow-500">Drive</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-light">
            A excelência da mobilidade urbana.
            <br />
            Conforto, segurança e rapidez em um só lugar.
          </p>
          
          <div className="pt-4">
            <Button 
                onClick={() => navigate('/login')} 
                className="h-14 px-8 text-lg rounded-full bg-yellow-500 text-black hover:bg-yellow-400 transition-all font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:scale-105"
            >
                Entrar na Plataforma <LogIn className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-8">
           {/* Passageiro */}
           <div onClick={() => navigate('/login')} className="group relative bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm">
                <div className="w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Passageiro</h3>
                <p className="text-gray-400">Viaje com padrão ouro pela cidade.</p>
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-white w-6 h-6" />
                </div>
           </div>

           {/* Motorista */}
           <div onClick={() => navigate('/login/driver')} className="group relative bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm">
                <div className="w-12 h-12 bg-yellow-500 text-black rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <Car className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Motorista</h3>
                <p className="text-gray-400">Maximize seus ganhos dirigindo.</p>
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-white w-6 h-6" />
                </div>
           </div>

           {/* Admin */}
           <div onClick={() => navigate('/login/admin')} className="group relative bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm">
                <div className="w-12 h-12 bg-zinc-800 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Administrador</h3>
                <p className="text-gray-400">Gestão completa da plataforma.</p>
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-white w-6 h-6" />
                </div>
           </div>
        </div>
      </div>
      
      <div className="fixed bottom-0 w-full z-20">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;