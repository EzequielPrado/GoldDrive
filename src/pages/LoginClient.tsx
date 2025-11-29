import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, MapPin, User, Lock, Mail } from "lucide-react";

const LoginClient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");

  // Auto-Redirect Inteligente
  useEffect(() => {
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            navigate('/client', { replace: true });
        } else {
            setCheckingSession(false);
        }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!email || !password) return showError("Preencha todos os campos");
    if(isSignUp && !name) return showError("Digite seu nome");

    setLoading(true);
    try {
        if(isSignUp) {
            const { error } = await supabase.auth.signUp({
                email, password,
                options: { data: { role: 'client', first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') } }
            });
            if(error) throw error;
            showSuccess("Conta criada! Verifique seu email.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if(error) throw error;
            // O redirecionamento será feito automaticamente pelo listener do auth state ou pelo ProtectedRoute
            navigate('/client');
        }
    } catch (e: any) {
        showError(e.message);
        setLoading(false);
    }
  };

  if (checkingSession) {
      return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-yellow-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-white flex">
       {/* Lado Esquerdo - Visual (Desktop) */}
       <div className="hidden lg:flex lg:w-1/2 bg-black relative items-center justify-center overflow-hidden">
           <div 
                className="absolute inset-0 opacity-60 bg-cover bg-center"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1496442226666-8d4a0e29f122?q=80&w=2576&auto=format&fit=crop')` }}
           />
           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
           <div className="relative z-10 text-center px-12">
                <div className="w-20 h-20 bg-yellow-500 rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)]">
                    <MapPin className="w-10 h-10 text-black" />
                </div>
                <h2 className="text-5xl font-black text-white mb-6 tracking-tight">Sua cidade, <br/>suas regras.</h2>
                <p className="text-gray-400 text-xl font-light leading-relaxed max-w-md mx-auto">
                    Conecte-se aos melhores motoristas da região com a segurança e o conforto que você merece.
                </p>
           </div>
       </div>

       {/* Lado Direito - Form */}
       <div className="w-full lg:w-1/2 flex flex-col relative">
           <div className="p-6">
               <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-gray-100 rounded-full w-12 h-12 p-0 -ml-2">
                   <ArrowLeft className="w-6 h-6 text-gray-800" />
               </Button>
           </div>

           <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 max-w-xl mx-auto w-full">
               <div className="mb-10 animate-in slide-in-from-bottom-4 duration-700">
                   <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Gold<span className="text-yellow-500">Drive</span></h1>
                   <div className="h-1.5 w-16 bg-yellow-500 rounded-full mb-6" />
                   <h2 className="text-2xl font-bold text-slate-800">{isSignUp ? "Comece sua jornada" : "Bem-vindo de volta"}</h2>
                   <p className="text-gray-500 mt-2">{isSignUp ? "Preencha seus dados para criar uma conta gratuita." : "Faça login para solicitar sua próxima corrida."}</p>
               </div>

               <form onSubmit={handleAuth} className="space-y-5 animate-in slide-in-from-bottom-8 duration-700 delay-150">
                   {isSignUp && (
                       <div className="relative group">
                           <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                           <Input placeholder="Nome Completo" className="h-14 pl-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all" value={name} onChange={e => setName(e.target.value)} />
                       </div>
                   )}
                   <div className="relative group">
                       <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                       <Input type="email" placeholder="Endereço de Email" className="h-14 pl-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all" value={email} onChange={e => setEmail(e.target.value)} />
                   </div>
                   <div className="relative group">
                       <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                       <Input type="password" placeholder="Sua Senha" className="h-14 pl-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all" value={password} onChange={e => setPassword(e.target.value)} />
                   </div>
                   {!isSignUp && <div className="flex justify-end"><span className="text-sm font-semibold text-gray-400 hover:text-yellow-600 cursor-pointer transition-colors">Esqueceu a senha?</span></div>}
                   <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                       {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Criar Conta Grátis" : "Entrar na Plataforma")}
                       {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
                   </Button>
               </form>

               <div className="mt-10 pt-6 border-t border-gray-100 text-center animate-in fade-in duration-1000 delay-300">
                   <p className="text-gray-500">{isSignUp ? "Já possui cadastro?" : "Ainda não tem conta?"}<button onClick={() => setIsSignUp(!isSignUp)} className="ml-2 font-bold text-yellow-600 hover:text-yellow-700 hover:underline">{isSignUp ? "Fazer Login" : "Cadastre-se agora"}</button></p>
               </div>
           </div>
           
           <div className="p-6 text-center lg:hidden"><p className="text-xs text-gray-300 font-medium">GoldDrive &copy; 2024</p></div>
       </div>
    </div>
  );
};

export default LoginClient;