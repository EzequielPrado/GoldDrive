import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Shield, Loader2, ArrowLeft, KeyRound, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const LoginAdmin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkExistingSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
             if (data?.role === 'admin') {
                 navigate('/admin', { replace: true });
             }
        }
    };
    checkExistingSession();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('🔐 Tentando login...');
    
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if(error) throw error;
        
        console.log('✅ Login bem-sucedido, verificando role...');
        
        const { data: { user } } = await supabase.auth.getUser();
        if(user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if(data?.role !== 'admin') {
                await supabase.auth.signOut({ scope: 'global' });
                throw new Error("Acesso negado: Este usuário não é um administrador.");
            }
            
            console.log('🚀 Redirecionando para admin dashboard...');
            // REPLACE: TRUE é crucial para evitar que o usuário volte para o login com o botão "Voltar"
            navigate('/admin', { replace: true });
        }
    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
       <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
       <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />
       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

       <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="mb-8 text-center flex flex-col items-center">
               <img src="/logo-goldmobile-2.png" alt="Gold Mobile" className="w-48 h-auto mb-6" />
               <p className="text-slate-400">Credenciais de alta segurança necessárias.</p>
           </div>

           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px] overflow-hidden">
               <CardContent className="p-8">
                   <form onSubmit={handleAuth} className="space-y-6">
                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 tracking-wider ml-1">ID Corporativo</label>
                           <div className="relative group">
                               <div className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-yellow-500 transition-colors"><Shield className="w-5 h-5" /></div>
                               <Input type="email" placeholder="admin@goldmobile.com" className="bg-slate-900/50 border-white/10 pl-12 h-12 rounded-xl text-white placeholder:text-slate-600 focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                           </div>
                       </div>
                       
                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 tracking-wider ml-1">Chave de Acesso</label>
                           <div className="relative group">
                               <div className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-yellow-500 transition-colors"><KeyRound className="w-5 h-5" /></div>
                               <Input 
                                   type={showPassword ? "text" : "password"} 
                                   placeholder="••••••••••••" 
                                   className="bg-slate-900/50 border-white/10 pl-12 pr-12 h-12 rounded-xl text-white placeholder:text-slate-600 focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all" 
                                   value={password} 
                                   onChange={e => setPassword(e.target.value)} 
                                   autoComplete="current-password" 
                               />
                               <button 
                                   type="button" 
                                   onClick={() => setShowPassword(!showPassword)}
                                   className="absolute right-4 top-3.5 text-slate-400 hover:text-white focus:outline-none"
                               >
                                   {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                               </button>
                           </div>
                       </div>

                       <Button className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black h-12 rounded-xl shadow-lg shadow-yellow-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin mr-2" /> : "AUTENTICAR SISTEMA"}
                       </Button>
                   </form>
               </CardContent>
           </Card>

           <div className="mt-8 text-center">
               <Button variant="ghost" className="text-slate-500 hover:text-white hover:bg-white/5 rounded-xl gap-2 transition-colors" onClick={() => navigate('/')}>
                   <ArrowLeft className="w-4 h-4" /> Voltar ao Início
               </Button>
           </div>
       </div>
    </div>
  );
};

export default LoginAdmin;