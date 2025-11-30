import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Shield, Loader2, User, ArrowLeft, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const LoginAdmin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const redirectUserByRole = (role: string) => {
      if (role === 'admin') navigate('/admin', { replace: true });
      else if (role === 'driver') navigate('/driver', { replace: true });
      else navigate('/client', { replace: true });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email || !password) return showError("Preencha todos os campos.");
    if (isSignUp && !name) return showError("Digite o nome do administrador.");

    setLoading(true);
    
    try {
        await supabase.auth.signOut(); // Limpa sessão anterior

        if (isSignUp) {
            // --- CADASTRO ---
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password.trim(),
                options: {
                    data: {
                        role: 'admin',
                        first_name: name.split(' ')[0],
                        last_name: name.split(' ').slice(1).join(' ') || '',
                        is_admin_created: true
                    }
                }
            });

            if (error) throw error;
            
            showSuccess("Administrador criado! Verifique o email se necessário ou faça login.");
            setIsSignUp(false); // Volta para login

        } else {
            // --- LOGIN ---
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim()
            });
            
            if (error) throw error;
            
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
            const role = profile?.role || 'admin';
            
            if (role !== 'admin') {
                showError("Este usuário não tem permissão de administrador.");
                await supabase.auth.signOut();
            } else {
                redirectUserByRole(role);
            }
        }

    } catch (e: any) {
        let msg = e.message || "Erro ao conectar.";
        if (msg.includes("Invalid login")) msg = "Credenciais inválidas.";
        if (msg.includes("already registered")) msg = "Este email já está cadastrado.";
        showError(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
       <div className="w-full max-w-md">
           <div className="mb-8 text-center animate-in slide-in-from-top fade-in duration-500">
               <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/10 ring-4 ring-white/5">
                   <Shield className="w-8 h-8 text-yellow-500" />
               </div>
               <h1 className="text-3xl font-black text-white mb-2">Gold<span className="text-yellow-500">Admin</span></h1>
               <p className="text-slate-400 text-sm">{isSignUp ? "Criar novo acesso administrativo" : "Acesso Restrito"}</p>
           </div>

           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px] overflow-hidden animate-in zoom-in-95 duration-300">
               <CardContent className="p-8">
                   <form onSubmit={handleAuth} className="space-y-5">
                       
                       {isSignUp && (
                           <div className="space-y-2 animate-in slide-in-from-left fade-in">
                               <label className="text-xs font-bold uppercase text-slate-500 ml-1">Nome Completo</label>
                               <div className="relative">
                                   <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                                   <Input 
                                       className="bg-slate-900/50 border-white/10 h-12 rounded-xl text-white pl-10" 
                                       value={name} 
                                       onChange={e => setName(e.target.value)} 
                                       disabled={loading}
                                       placeholder="Ex: João Admin"
                                   />
                               </div>
                           </div>
                       )}

                       <div className="space-y-2">
                           <label className="text-xs font-bold uppercase text-slate-500 ml-1">Email</label>
                           <Input 
                               type="email" 
                               className="bg-slate-900/50 border-white/10 h-12 rounded-xl text-white" 
                               value={email} 
                               onChange={e => setEmail(e.target.value)} 
                               disabled={loading}
                               placeholder="admin@golddrive.com"
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
                               placeholder="••••••••"
                           />
                       </div>

                       <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black h-12 rounded-xl shadow-lg shadow-yellow-500/10 mt-2" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin mr-2" /> : (isSignUp ? "CADASTRAR ADMIN" : "ENTRAR")}
                       </Button>
                   </form>

                   <div className="mt-6 pt-6 border-t border-white/5 flex flex-col gap-3">
                        <Button 
                            type="button"
                            variant="outline" 
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="w-full h-10 border-white/10 bg-transparent text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/20"
                        >
                            {isSignUp ? "Voltar para Login" : "Criar Novo Admin"} <UserPlus className="ml-2 w-4 h-4" />
                        </Button>
                   </div>
               </CardContent>
           </Card>
           
           <div className="mt-8 text-center">
               <Button variant="ghost" className="text-slate-500 hover:text-white" onClick={() => navigate('/')}>
                   <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Início
               </Button>
           </div>
       </div>
    </div>
  );
};

export default LoginAdmin;