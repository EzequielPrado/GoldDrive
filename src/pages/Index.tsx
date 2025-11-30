import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Car, User, Shield, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

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
        console.error("Erro verificação:", error);
      }
    };
    checkUser();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-yellow-600/20 rounded-full blur-[120px]" />
         <div className="absolute bottom-[0%] -right-[10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-md w-full z-10 flex flex-col items-center space-y-12 animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_0_30px_rgba(234,179,8,0.3)] mb-4">
             <MapPin className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter">
            Gold<span className="text-yellow-500">Drive</span>
          </h1>
          <p className="text-gray-400 text-lg font-light leading-relaxed">
            Sua mobilidade com padrão ouro.
          </p>
        </div>

        {/* Buttons Stack */}
        <div className="w-full space-y-4 flex flex-col items-center">
            
            {/* 1. PASSAGEIRO (Botão Principal - Grande) */}
            <Button 
                onClick={() => navigate('/login')} 
                className="w-full h-16 text-xl rounded-2xl bg-white text-black hover:bg-gray-100 transition-all font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
            >
                <User className="mr-3 w-6 h-6 group-hover:text-yellow-600 transition-colors" />
                Sou Passageiro
            </Button>

            {/* 2. MOTORISTA (Botão Médio) */}
            <Button 
                onClick={() => navigate('/login/driver')} 
                className="w-full h-14 text-lg rounded-2xl bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 transition-all font-medium"
            >
                <Car className="mr-3 w-5 h-5 text-yellow-500" />
                Sou Motorista
            </Button>

            {/* 3. ADMIN (Link Pequeno) */}
            <button 
                onClick={() => navigate('/login/admin')}
                className="mt-6 text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors uppercase font-bold tracking-widest pt-4"
            >
                <Shield className="w-3 h-3" /> Acesso Administrativo
            </button>
        </div>
      </div>
      
      <div className="fixed bottom-0 w-full z-20">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;