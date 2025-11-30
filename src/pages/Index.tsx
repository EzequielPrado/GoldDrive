import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Car, ShieldCheck, ArrowRight, LogIn, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 relative overflow-hidden font-sans selection:bg-yellow-500 selection:text-black">
      
      {/* Background Effects (Subtle & Premium) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2583')] bg-cover bg-center opacity-10 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/90 to-zinc-900" />
          
          {/* Orbs */}
          <div className="absolute top-[-10%] right-[-20%] w-[500px] h-[500px] bg-yellow-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-20%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Main Content Area - Centered for Passenger */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 w-full max-w-lg mx-auto">
        
        {/* Logo Section */}
        <div className="mb-12 animate-in fade-in zoom-in duration-700">
           <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.3)] rotate-3 hover:rotate-6 transition-transform">
              <MapPin className="w-10 h-10 text-black fill-black/20" />
           </div>
           <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
             Gold<span className="text-yellow-500">Drive</span>
           </h1>
           <p className="text-lg md:text-xl text-zinc-400 font-light max-w-xs mx-auto leading-relaxed">
             Sua jornada premium começa aqui. Conforto e segurança em cada km.
           </p>
        </div>

        {/* Primary Action (Passenger) */}
        <div className="w-full space-y-4 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-100">
            <Button 
                onClick={() => navigate('/login')} 
                className="w-full h-16 text-lg rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all font-bold shadow-xl shadow-white/5 flex items-center justify-between px-8 group"
            >
                <span>Sou Passageiro</span>
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                </div>
            </Button>
            
            <p className="text-xs text-zinc-500 font-medium">
                Toque para solicitar sua primeira corrida
            </p>
        </div>

      </div>

      {/* Footer Area - Driver & Admin */}
      <div className="z-10 w-full p-6 pb-12 flex flex-col items-center gap-8 bg-gradient-to-t from-zinc-950 to-transparent">
         
         {/* Driver Card - Small & Elegant */}
         <div 
            onClick={() => navigate('/login/driver')}
            className="w-full max-w-sm bg-zinc-900/50 backdrop-blur-md border border-zinc-800 hover:border-yellow-500/50 p-4 rounded-2xl flex items-center justify-between cursor-pointer group transition-all active:scale-95"
         >
             <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
                     <Car className="w-5 h-5" />
                 </div>
                 <div className="text-left">
                     <p className="text-zinc-200 font-bold text-sm group-hover:text-yellow-500 transition-colors">Motorista Parceiro</p>
                     <p className="text-zinc-500 text-xs">Fature mais dirigindo</p>
                 </div>
             </div>
             <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
         </div>

         {/* Admin Link - Hidden/Subtle */}
         <div className="flex flex-col items-center gap-4">
             <div 
                onClick={() => navigate('/login/admin')} 
                className="opacity-10 hover:opacity-50 transition-opacity cursor-default hover:cursor-pointer flex items-center gap-1"
             >
                <ShieldCheck className="w-3 h-3 text-white" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Admin Access</span>
             </div>
             
             {/* Dyad Badge */}
             <div className="scale-75 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                <MadeWithDyad />
             </div>
         </div>

      </div>
    </div>
  );
};

export default Index;