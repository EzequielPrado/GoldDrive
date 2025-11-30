import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, MapPin, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";

const LoginClient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const clearSession = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(`sb-${new URL(supabase.supabaseUrl).hostname.split('.')[0]}-auth-token`);
    };
    clearSession();
  }, []);

  const ensureProfileExists = async (userId: string, fullName: string) => {
      try {
          const { data } = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();
          if (data) return data.role;

          console.warn("Perfil não encontrado, criando manualmente...");
          const firstName = fullName.split(' ')[0] || "Usuário";
          const lastName = fullName.split(' ').slice(1).join(' ') || "";
          
          const { error: insertError } = await supabase.from('profiles').insert({
              id: userId,
              first_name: firstName,
              last_name: lastName,
              role: 'client',
              driver_status: 'APPROVED',
              updated_at: new Date().toISOString()
          });

          if (insertError) throw insertError;
          return 'client';

      } catch (err: any) {
          console.error("Erro ao garantir perfil:", err);
          throw new Error("Erro de sincronização de perfil: " + err.message);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if(!email || !password) return showError("Preencha todos os campos");
    if(isSignUp && !name) return showError("Digite seu nome");

    setLoading(true);

    try {
        await supabase.auth.signOut();

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("O servidor demorou para responder.")), 15000)
        );

        let authData;

        if(isSignUp) {
            const signUpPromise = supabase.auth.signUp({
                email: email.trim(), 
                password: password.trim(),
                options: { 
                    data: { 
                        role: 'client', 
                        first_name: name.split(' ')[0], 
                        last_name: name.split(' ').slice(1).join(' ') 
                    } 
                }
            });

            const { data, error: signUpError } = await Promise.race([signUpPromise, timeoutPromise]) as any;
            if(signUpError) throw signUpError;
            authData = data;
            
            if (authData.user) {
                // Correção: REMOVIDO EMAIL DO UPSERT MANUAL
                await ensureProfileExists(authData.user.id, name);
            }

            if (data.session) {
                navigate('/client', { replace: true });
            } else {
                showSuccess("Conta criada! Faça login.");
                setIsSignUp(false);
            }

        } else {
            const loginPromise = supabase.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password.trim() 
            });

            const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;
            if(error) throw error;
            authData = data;

            if (!authData.user) throw new Error("Erro na autenticação.");
            const role = await ensureProfileExists(authData.user.id, name || "Usuário");

            if (role === 'driver') navigate('/driver', { replace: true });
            else if (role === 'admin') navigate('/admin', { replace: true });
            else navigate('/client', { replace: true });
        }

    } catch (e: any) {
        console.error(e);
        let msg = e.message || "Erro ao conectar.";
        if (msg.includes("Invalid login")) msg = "Email ou senha incorretos.";
        if (msg.includes("already registered")) msg = "Este email já está cadastrado.";
        showError(msg);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center font-sans overflow-hidden bg-white">
       <div className="absolute inset-0 bg-gradient-to-br from-black to-slate-900 lg:hidden" />
       
       <div className="relative z-10 w-full max-w-4xl flex flex-col lg:flex-row h-screen lg:h-auto lg:rounded-[32px] lg:shadow-2xl overflow-hidden bg-white">
           
           <div className="lg:w-1/2 p-8 lg:p-12 bg-slate-900 text-white flex flex-col justify-center">
                <div className="mb-6"><MapPin className="w-12 h-12 text-yellow-500" /></div>
                <h1 className="text-4xl font-black mb-4">Gold<span className="text-yellow-500">Drive</span></h1>
                <p className="text-gray-400">Viaje com segurança e conforto.</p>
           </div>

           <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center bg-white">
               <Button variant="ghost" onClick={() => navigate('/')} className="self-start pl-0 mb-6"><ArrowLeft className="mr-2 w-4 h-4" /> Voltar</Button>
               
               <h2 className="text-2xl font-black text-slate-900 mb-6">{isSignUp ? "Criar Conta" : "Login Passageiro"}</h2>

               <form onSubmit={handleAuth} className="space-y-4">
                   {isSignUp && (
                       <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-12 bg-gray-50"/></div>
                   )}
                   <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-gray-50"/></div>
                   <div className="space-y-1"><Label>Senha</Label>
                        <div className="relative">
                            <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-12 bg-gray-50 pr-10"/>
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400">
                                {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                            </button>
                        </div>
                   </div>

                   <Button className="w-full h-14 text-lg font-bold bg-slate-900 text-white rounded-xl mt-4" disabled={loading}>
                       {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Cadastrar" : "Entrar")}
                   </Button>
               </form>

               <div className="mt-6 text-center">
                   <Button variant="link" onClick={() => setIsSignUp(!isSignUp)} className="text-slate-900 font-bold">
                       {isSignUp ? "Já tenho conta" : "Criar conta grátis"}
                   </Button>
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginClient;