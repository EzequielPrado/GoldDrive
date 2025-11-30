import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, MapPin, User, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";

const LoginClient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if(!email || !password) return showError("Preencha todos os campos");
    if(isSignUp && !name) return showError("Digite seu nome");

    setLoading(true);

    // Timeout de segurança: Evita travamento infinito
    const timeoutId = setTimeout(() => {
        setLoading((current) => {
            if (current) {
                showError("O servidor demorou para responder. Verifique sua conexão.");
                return false;
            }
            return false;
        });
    }, 15000);

    try {
        if(isSignUp) {
            // CADASTRO DIRETO
            const { error, data } = await supabase.auth.signUp({
                email: email.trim(), 
                password: password.trim(),
                options: { data: { role: 'client', first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') } }
            });

            if(error) throw error;
            
            clearTimeout(timeoutId);

            // Se cadastro deu certo e já tem sessão (sem confirmação de email), entra direto
            if (data.session) {
                navigate('/client', { replace: true });
            } else {
                showSuccess("Conta criada com sucesso!");
                // Em alguns casos o supabase não loga direto se precisar de email confirm, 
                // mas aqui assumimos que pode logar ou pede login
                if (!data.user) {
                     // Fallback raro
                     setIsSignUp(false);
                } else {
                     // Tenta login automatico se a sessão não veio mas o user sim (raro em config padrao)
                     const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
                     if (loginData.session) navigate('/client', { replace: true });
                     else setIsSignUp(false); // Volta pra tela de login
                }
            }
        } else {
            // LOGIN DIRETO
            const { data, error } = await supabase.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password.trim() 
            });
            
            if(error) throw error;

            // Tenta ler o perfil, mas se falhar, assume 'client' se estiver nesta tela
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
            
            clearTimeout(timeoutId);
            setLoading(false);

            const role = profile?.role || 'client';

            if (role === 'driver') navigate('/driver', { replace: true });
            else if (role === 'admin') navigate('/admin', { replace: true });
            else navigate('/client', { replace: true });
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        setLoading(false);
        console.error(e);
        let msg = e.message || "Erro ao conectar.";
        if (msg.includes("Invalid login")) msg = "Email ou senha incorretos.";
        if (msg.includes("already registered")) msg = "Este email já está cadastrado.";
        showError(msg);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center font-sans overflow-hidden">
       {/* Background Image Full Screen with Overlay */}
       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1496442226666-8d4a0e29f122?q=80&w=2576&auto=format&fit=crop')] bg-cover bg-center" />
       <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

       {/* Content Container - Igual ao Motorista */}
       <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row h-full lg:h-auto min-h-screen lg:min-h-[600px] lg:rounded-[32px] lg:overflow-hidden lg:shadow-2xl lg:bg-white animate-in fade-in zoom-in-95 duration-500">
           
           {/* Esquerda: Branding */}
           <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center text-white lg:bg-slate-900 relative">
                {/* Gradiente Mobile para leitura sobre imagem */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent lg:hidden" />
                
                <div className="relative z-10 text-center lg:text-left mt-10 lg:mt-0">
                   <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mb-6 shadow-glow mx-auto lg:mx-0">
                       <MapPin className="w-8 h-8 text-black" />
                   </div>
                   <h1 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight drop-shadow-lg lg:drop-shadow-none">Gold<span className="text-yellow-500">Drive</span></h1>
                   <p className="text-lg text-gray-200 lg:text-gray-400 max-w-sm mx-auto lg:mx-0 drop-shadow-md lg:drop-shadow-none">Sua cidade, suas regras. Conecte-se com conforto e segurança.</p>
                </div>
           </div>

           {/* Direita: Formulário */}
           <div className="flex-1 bg-white rounded-t-[32px] lg:rounded-none p-8 lg:p-12 flex flex-col justify-center mt-auto lg:mt-0 shadow-2xl lg:shadow-none">
               <div className="mb-8">
                    <Button variant="ghost" onClick={() => navigate('/')} className="pl-0 hover:bg-transparent text-slate-500 hover:text-yellow-600 mb-2">
                       <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
                    </Button>
                    <h2 className="text-3xl font-black text-slate-900">{isSignUp ? "Criar Conta" : "Bem-vindo"}</h2>
                    <p className="text-gray-500 mt-1">{isSignUp ? "Preencha seus dados abaixo" : "Faça login para continuar"}</p>
               </div>

               <form onSubmit={handleAuth} className="space-y-5">
                   {isSignUp && (
                       <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in">
                           <Label className="text-slate-900 font-bold ml-1">Nome Completo</Label>
                           <div className="relative group">
                               <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                               <Input 
                                   placeholder="Seu nome" 
                                   className="h-12 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500 transition-all" 
                                   value={name} 
                                   onChange={e => setName(e.target.value)} 
                                   disabled={loading} 
                               />
                           </div>
                       </div>
                   )}

                   <div className="space-y-1.5">
                       <Label className="text-slate-900 font-bold ml-1">Email</Label>
                       <div className="relative group">
                           <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                           <Input 
                               type="email" 
                               placeholder="seu@email.com" 
                               className="h-12 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500 transition-all" 
                               value={email} 
                               onChange={e => setEmail(e.target.value)} 
                               disabled={loading} 
                           />
                       </div>
                   </div>

                   <div className="space-y-1.5">
                       <div className="flex justify-between">
                           <Label className="text-slate-900 font-bold ml-1">Senha</Label>
                           {!isSignUp && <span className="text-xs font-bold text-gray-400 hover:text-yellow-600 cursor-pointer">Esqueceu?</span>}
                       </div>
                       <div className="relative group">
                           <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                           <Input 
                               type={showPassword ? "text" : "password"}
                               placeholder="Sua senha" 
                               className="h-12 pl-12 pr-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500 transition-all" 
                               value={password} 
                               onChange={e => setPassword(e.target.value)} 
                               disabled={loading} 
                           />
                           <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-slate-900">
                               {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                           </button>
                       </div>
                   </div>

                   <Button className="w-full h-14 text-lg font-bold rounded-xl bg-slate-900 hover:bg-black text-white mt-4 shadow-xl transition-transform active:scale-[0.98]" disabled={loading}>
                       {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Cadastrar Gratuitamente" : "Entrar")}
                       {!loading && !isSignUp && <ArrowRight className="ml-2 w-5 h-5" />}
                   </Button>
               </form>

               <div className="mt-8 text-center pt-6 border-t border-gray-100">
                   <p className="text-slate-500 mb-2">{isSignUp ? "Já possui conta?" : "Novo por aqui?"}</p>
                   <Button variant="outline" onClick={() => setIsSignUp(!isSignUp)} className="w-full h-12 rounded-xl border-slate-200 hover:border-yellow-500 hover:text-yellow-600 font-bold">
                       {isSignUp ? "Fazer Login" : "Criar Conta de Passageiro"}
                   </Button>
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginClient;