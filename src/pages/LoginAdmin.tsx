import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Shield, Loader2, KeyRound, LogOut, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const LoginAdmin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Limpeza forçada ao entrar
    const clearSession = async () => {
        await supabase.auth.signOut();
        try {
            // @ts-ignore
            localStorage.removeItem(`sb-${new URL((supabase as any).supabaseUrl).hostname.split('.')[0]}-auth-token`);
        } catch (e) { console.error(e); }
    };
    clearSession();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim()
        });
        
        if (error) throw error;
        
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
        const role = profile?.role || 'admin';
        
        if (role === 'admin') navigate('/admin', { replace: true });
        else if (role === 'driver') navigate('/driver', { replace: true });
        else navigate('/client', { replace: true });

    } catch (e: any) {
        let msg = e.message || "Erro ao conectar.";
        if (msg.includes("Invalid login")) msg = "Credenciais inválidas.";
        showError(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
       <div className="w-full max-w-md">
           <div className="mb-8 text-center">
               <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/10 ring-4 ring-white/5">
                   <Shield className="w-8 h-8 text-yellow-500" />
               </div>
               <h1 className="text-3xl font-black text-white mb-2">Gold<span className="text-yellow-500">Admin</span></h1>
           </div>

           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px] overflow-hidden">
               <CardContent className="p-8">
                   <form onSubmit={handleAuth} className="space-y-6">
                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 ml-1">Email</label>
                           <Input 
                               type="email" 
                               className="bg-slate-900/50 border-white/10 h-12 rounded-xl text-white" 
                               value={email} 
                               onChange={e => setEmail(e.target.value)} 
                               disabled={loading}
                           />
                       </div>
                       
                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 ml-1">Senha</label>
                           <Input 
                               type="password" 
                               className="bg-slate-900/50 border-white/10 h-12 rounded-xl text-white" 
                               value={password} 
                               onChange={e => setPassword(e.target.value)} 
                               disabled={loading}
                           />
                       </div>

                       <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12 rounded-xl" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin mr-2" /> : "ENTRAR"}
                       </Button>
                   </form>
               </CardContent>
           </Card>
           <div className="mt-8 text-center">
               <Button variant="ghost" className="text-slate-500 hover:text-white" onClick={() => navigate('/')}>
                   <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
               </Button>
           </div>
       </div>
    </div>
  );
};

export default LoginAdmin;