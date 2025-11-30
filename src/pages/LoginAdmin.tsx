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

  // Redireciona se já estiver logado como admin
  useEffect(() => {
    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
             if (data?.role === 'admin') {
                 navigate('/admin', { replace: true });
             }
        }
    };
    checkSession();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
        console.log("Iniciando login...");
        
        // 1. Login Simples e Direto
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim()
        });
        
        if (error) throw error;
        
        console.log("Login Auth sucesso:", data);

        // 2. Verificação Rápida de Perfil
        // Se falhar aqui, não vamos travar o login, deixamos o ProtectedRoute lidar ou mostramos erro depois
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();
        
        console.log("Perfil carregado:", profile, "Erro:", profileError);

        if (profileError) {
             console.error("Erro RLS/Banco:", profileError);
             // Não bloqueia, tenta ir pro admin e se falhar o router devolve
        }

        if (profile && profile.role !== 'admin') {
            await supabase.auth.signOut();
            throw new Error("Este usuário não tem permissão de Administrador.");
        }
        
        showSuccess("Login realizado com sucesso!");
        
        // Pequeno delay para garantir que o cookie de sessão foi gravado
        setTimeout(() => {
            navigate('/admin', { replace: true });
        }, 500);

    } catch (e: any) {
        console.error("Erro no fluxo de login:", e);
        
        let msg = e.message || "Erro ao conectar.";
        if (msg.includes("Invalid login")) msg = "Credenciais inválidas.";
        
        showError(msg);
        setLoading(false); // Destrava o botão
    }
    // Nota: Não coloco setLoading(false) no sucesso para evitar que o botão
    // "pisque" antes da página mudar.
  };

  const handleForceClear = async () => {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

       <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="mb-8 text-center">
               <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/10 ring-4 ring-white/5">
                   <Shield className="w-8 h-8 text-yellow-500" />
               </div>
               <h1 className="text-3xl font-black text-white tracking-tight mb-2">Gold<span className="text-yellow-500">Admin</span></h1>
               <p className="text-slate-400">Acesso Restrito</p>
           </div>

           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px] overflow-hidden">
               <CardContent className="p-8">
                   <form onSubmit={handleAuth} className="space-y-6">
                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 tracking-wider ml-1">Email</label>
                           <div className="relative group">
                               <div className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-yellow-500 transition-colors"><Shield className="w-5 h-5" /></div>
                               <Input 
                                   type="email" 
                                   placeholder="admin@golddrive.com" 
                                   className="bg-slate-900/50 border-white/10 pl-12 h-12 rounded-xl text-white placeholder:text-slate-600 focus:border-yellow-500/50 focus:ring-yellow-500/20 transition-all" 
                                   value={email} 
                                   onChange={e => setEmail(e.target.value)} 
                                   autoComplete="email" 
                               />
                           </div>
                       </div>
                       
                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 tracking-wider ml-1">Senha</label>
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
                                   className="absolute right-4 top-3.5 text-slate-500 hover:text-white transition-colors focus:outline-none z-10 p-1"
                               >
                                   {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                               </button>
                           </div>
                       </div>

                       <Button 
                           className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black h-12 rounded-xl shadow-lg shadow-yellow-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                           disabled={loading}
                       >
                           {loading ? <Loader2 className="animate-spin mr-2" /> : "ENTRAR"}
                       </Button>
                   </form>
               </CardContent>
           </Card>

           <div className="mt-8 text-center space-y-2">
               <Button variant="ghost" className="text-slate-500 hover:text-white hover:bg-white/5 rounded-xl gap-2 transition-colors" onClick={() => navigate('/')}>
                   <ArrowLeft className="w-4 h-4" /> Voltar ao Início
               </Button>
               
               <div onClick={handleForceClear} className="text-[10px] text-slate-700 hover:text-red-500 cursor-pointer pt-4 uppercase font-bold tracking-widest flex items-center justify-center gap-1">
                   <LogOut className="w-3 h-3" /> Limpar Sessão (Debug)
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginAdmin;