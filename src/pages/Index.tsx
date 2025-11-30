import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Car, MapPin, ShieldCheck, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        if (data) {
           if (data.role === 'client') navigate('/client');
           else if (data.role === 'driver') navigate('/driver');
           else if (data.role === 'admin') navigate('/admin');
        }
      }
    };
    checkUser();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans selection:bg-yellow-200">
      
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
         {/* Background Decor */}
         <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] bg-yellow-400/20 rounded-full blur-[100px] pointer-events-none" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

         <div className="mb-10 animate-in slide-in-from-bottom-5 duration-700">
             <div className="inline-flex items-center justify-center p-3 bg-black rounded-2xl mb-6 shadow-xl transform hover:rotate-3 transition-transform duration-300">
                 <span className="text-3xl font-black text-white tracking-tighter">Gold<span className="text-yellow-500">Drive</span></span>
             </div>
             <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                 Sua cidade.<br/>Seu controle.
             </h1>
             <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
                 A plataforma premium de mobilidade urbana que conecta passageiros exigentes aos melhores motoristas.
             </p>
         </div>

         {/* HIERARQUIA VISUAL AQUI */}
         <div className="w-full max-w-md space-y-4 z-10 animate-in slide-in-from-bottom-8 duration-700 delay-150">
             
             {/* 1. PASSAGEIRO (Principal - Grande) */}
             <div 
                onClick={() => navigate('/login')}
                className="group relative bg-slate-900 hover:bg-black text-white p-6 rounded-[32px] cursor-pointer shadow-2xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
             >
                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                             <MapPin className="w-7 h-7" />
                         </div>
                         <div className="text-left">
                             <h3 className="text-2xl font-bold">Sou Passageiro</h3>
                             <p className="text-slate-400 group-hover:text-white/80 transition-colors">Solicitar uma corrida agora</p>
                         </div>
                     </div>
                     <ChevronRight className="w-6 h-6 text-slate-500 group-hover:text-white" />
                 </div>
             </div>

             {/* 2. MOTORISTA (Secundário - Médio) */}
             <div 
                onClick={() => navigate('/login/driver')}
                className="group relative bg-white border-2 border-slate-100 hover:border-yellow-500 p-5 rounded-[28px] cursor-pointer transition-all hover:shadow-lg hover:shadow-yellow-100"
             >
                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                             <Car className="w-6 h-6" />
                         </div>
                         <div className="text-left">
                             <h3 className="text-lg font-bold text-slate-900">Sou Motorista</h3>
                             <p className="text-sm text-gray-500">Fazer login ou cadastro</p>
                         </div>
                     </div>
                     <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-yellow-500" />
                 </div>
             </div>

             {/* 3. ADMIN (Terciário - Link Pequeno) */}
             <div className="pt-6">
                 <button 
                    onClick={() => navigate('/login/admin')}
                    className="text-xs font-bold text-gray-400 hover:text-slate-900 flex items-center justify-center gap-2 mx-auto transition-colors px-4 py-2 rounded-full hover:bg-gray-50"
                 >
                     <ShieldCheck className="w-3 h-3" /> Acesso Administrativo
                 </button>
             </div>

         </div>
      </div>
      
      <div className="py-4">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;