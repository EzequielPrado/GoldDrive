import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, User, Lock, Mail, Eye, EyeOff, Camera, ShieldCheck, ChevronLeft, KeyRound, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const LoginClient = () => {
  const navigate = useNavigate();
  const { loading, handleSignIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [showPwa, setShowPwa] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSignIn(email, password);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex font-sans">
       <PWAInstallPrompt openForce={showPwa} onCloseForce={() => setShowPwa(false)} />
       <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1496442226666-8d4a0e29f122?q=80&w=2576&auto=format&fit=crop')] bg-cover bg-center opacity-40" />
           <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 to-transparent" />
           <div className="relative z-10 p-12 text-center">
                <img src="/app-logo.jpg" alt="Gold Mobile" className="w-64 mx-auto mb-8 rounded-2xl" />
                <p className="text-gray-300 text-xl font-light max-w-md mx-auto">Sua experiência premium de mobilidade urbana começa aqui.</p>
           </div>
       </div>
       <div className="w-full lg:w-1/2 flex flex-col relative overflow-y-auto bg-zinc-950">
           <div className="p-6 flex items-center lg:absolute lg:top-0 lg:left-0 lg:z-20 lg:w-full">
               <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-zinc-800 text-white rounded-full w-12 h-12 p-0 shrink-0">
                   <ArrowLeft className="w-6 h-6" />
               </Button>
               <img src="/app-logo.jpg" alt="Gold Mobile" className="h-10 ml-4 lg:hidden rounded-lg" />
           </div>
           <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-10">
               <div className="bg-white rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-black via-zinc-800 to-yellow-500" />
                   <div className="mb-8 text-center">
                       <h2 className="text-3xl font-black text-slate-900">Login Passageiro</h2>
                       <p className="text-gray-500 mt-2 text-sm">Entre para solicitar sua corrida.</p>
                   </div>
                   <form onSubmit={handleLogin} className="space-y-4">
                        <Input type="email" placeholder="seu@email.com" className="h-14" value={email} onChange={e => setEmail(e.target.value)} />
                        <Input type="password" placeholder="••••••••" className="h-14" value={password} onChange={e => setPassword(e.target.value)} />
                        <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-black text-white" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
                        </Button>
                   </form>
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginClient;