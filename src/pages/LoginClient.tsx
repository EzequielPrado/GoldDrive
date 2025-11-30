import React, { useState } from "react";
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

  const redirectUserByRole = (role: string) => {
      switch(role) {
          case 'driver': navigate('/driver', { replace: true }); break;
          case 'admin': navigate('/admin', { replace: true }); break;
          default: navigate('/client', { replace: true });
      }
  };

  const ensureProfileExists = async (userId: string, fullName: string) => {
      try {
          const { data } = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();
          if (data) return data.role;

          const firstName = fullName.split(' ')[0] || "Usuário";
          const lastName = fullName.split(' ').slice(1).join(' ') || "";
          
          const { error } = await supabase.from('profiles').insert({
              id: userId,
              first_name: firstName,
              last_name: lastName,
              role: 'client',
              driver_status: 'APPROVED'
          });

          if (error && !error.message.includes('duplicate')) throw error;
          return 'client';
      } catch (err: any) {
          console.error("Erro perfil:", err);
          return 'client';
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if(!email || !password) return showError("Preencha todos os campos");
    if(isSignUp && !name) return showError("Digite seu nome");

    setLoading(true);

    try {
        let authData;

        if(isSignUp) {
            const { data, error } = await supabase.auth.signUp({
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

            if(error) throw error;
            authData = data;
            
            if (authData.user) await ensureProfileExists(authData.user.id, name);

            if (data.session) {
                redirectUserByRole('client');
            } else {
                showSuccess("Conta criada! Faça login.");
                setIsSignUp(false);
            }

        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password.trim() 
            });

            if(error) throw error;
            authData = data;

            if (!authData.user) throw new Error("Erro na autenticação.");
            const role = await ensureProfileExists(authData.user.id, name || "Usuário");

            redirectUserByRole(role);
        }

    } catch (e: any) {
        console.error(e);
        let msg = e.message || "Erro ao conectar.";
        if (msg.includes("Invalid login")) msg = "Email ou senha incorretos.";
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

                   <Button type="submit" className="w-full h-14 text-lg font-bold bg-slate-900 text-white rounded-xl mt-4" disabled={loading}>
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