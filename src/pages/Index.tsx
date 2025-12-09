import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Car, ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  // Verificação silenciosa de sessão
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            if (profile.role === 'admin') navigate('/admin', { replace: true });
            else if (profile.role === 'driver') navigate('/driver', { replace: true });
            else navigate('/client', { replace: true });
          }
        }
      } catch (error) {
        console.error("Check user error", error);
      }
    };

    checkUser();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden font-sans">
      
      {/* Background Decorativo */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[20%] w-[150%] h-[80%] bg-gradient-to-b from-yellow-600/10 to-transparent rounded-full blur-[100px]" />
          <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-12 pb-6 relative z-10 max-w-md mx-auto w-full justify-between">
        
        {/* Header / Logo */}
        <div className="text-center space-y-4 mt-12 animate-in slide-in-from-top-10 duration-700 flex flex-col items-center">
            <img 
              src="/logo-goldmobile-2.png" 
              alt="Gold Mobile" 
              className="w-64 h-auto drop-shadow-2xl"
            />
            <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-[260px]">
              Mobilidade premium <br/> na palma da sua mão.
            </p>
        </div>

        {/* Action Area */}
        <div className="space-y-6 w-full mb-8 animate-in slide-in-from-bottom-10 duration-700 delay-150">
            
            {/* PASSAGEIRO - BOTÃO PRINCIPAL */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-[35px] blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <Button 
                    onClick={() => navigate('/login')}
                    className="relative w-full h-32 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 hover:to-yellow-500 text-black border-0 rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all transform active:scale-95 shadow-xl"
                >
                    <span className="text-2xl font-black tracking-tight flex items-center gap-2">
                        PEDIR CORRIDA <ArrowRight className="w-6 h-6 stroke-[3px]" />
                    </span>
                    <span className="text-sm font-semibold opacity-80 uppercase tracking-widest">
                        Entrar como Passageiro
                    </span>
                </Button>
            </div>

            {/* DIVISOR */}
            <div className="flex items-center gap-4 px-8">
                <div className="h-px bg-zinc-800 flex-1"></div>
                <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">Parceiros</span>
                <div className="h-px bg-zinc-800 flex-1"></div>
            </div>

            {/* MOTORISTA - BOTÃO SECUNDÁRIO */}
            <Button 
                onClick={() => navigate('/login/driver')}
                variant="outline"
                className="w-full h-16 bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-2xl flex items-center justify-between px-6 transition-all group"
            >
                <span className="font-bold text-lg flex items-center gap-3">
                    <Car className="w-5 h-5 text-zinc-500 group-hover:text-yellow-500 transition-colors" /> 
                    Sou Motorista
                </span>
                <ArrowRight className="w-5 h-5 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Button>

        </div>

      </div>

      {/* Footer / Admin Link */}
      <div className="pb-6 text-center space-y-4 relative z-10">
          <div 
            onClick={() => navigate('/login/admin')}
            className="text-[10px] font-bold text-zinc-800 uppercase tracking-widest hover:text-zinc-600 cursor-pointer transition-colors flex items-center justify-center gap-1"
          >
             <ShieldCheck className="w-3 h-3" /> Acesso Administrativo
          </div>
          
          <div className="opacity-40 scale-75">
            <MadeWithDyad />
          </div>
      </div>

    </div>
  );
};

export default Index;