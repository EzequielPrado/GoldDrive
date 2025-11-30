import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car } from "lucide-react";

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");

  // Verificação em segundo plano
  useEffect(() => {
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/driver');
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
                options: { data: { role: 'driver', first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') } }
            });
            if(error) throw error;
            showSuccess("Cadastro realizado! Verifique seu email.");
        } else {
            // REMOVIDO: await supabase.auth.signOut({ scope: 'global' });

            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if(error) throw error;
            navigate('/driver');
        }
    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
       {/* Background Effect */}
       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-transparent" />

       <div className="p-6 z-10">
           <Button variant="ghost" onClick={() => navigate('/')} className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0">
               <ArrowLeft className="w-6 h-6" />
           </Button>
       </div>

       <div className="flex-1 flex flex-col justify-end sm:justify-center px-8 sm:max-w-md mx-auto w-full z-10 pb-12">
           <div className="mb-8 animate-in slide-in-from-bottom-10 fade-in duration-700">
               <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center mb-4 text-black shadow-lg shadow-yellow-500/20">
                   <Car className="w-6 h-6" />
               </div>
               <h1 className="text-4xl font-bold tracking-tight mb-2">Área do <span className="text-yellow-500">Parceiro</span></h1>
               <p className="text-gray-400 text-lg">{isSignUp ? "Junte-se à frota GoldDrive." : "Gerencie seus ganhos e corridas."}</p>
           </div>

           <form onSubmit={handleAuth} className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-1000 delay-100">
               {isSignUp && (
                   <Input placeholder="Nome Completo" className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-lg rounded-xl focus:border-yellow-500 focus:ring-yellow-500" value={name} onChange={e => setName(e.target.value)} />
               )}
               <Input type="email" placeholder="Email cadastrado" className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-lg rounded-xl focus:border-yellow-500 focus:ring-yellow-500" value={email} onChange={e => setEmail(e.target.value)} />
               <Input type="password" placeholder="Sua senha" className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-lg rounded-xl focus:border-yellow-500 focus:ring-yellow-500" value={password} onChange={e => setPassword(e.target.value)} />
               <Button className="w-full h-14 text-lg font-bold rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black mt-4" disabled={loading}>
                   {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Cadastrar Veículo" : "Acessar Painel")}
                   {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
               </Button>
           </form>

           <div className="mt-8 text-center z-20">
               <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">{isSignUp ? "Já sou parceiro, fazer login" : "Quero ser motorista parceiro"}</button>
           </div>
       </div>
    </div>
  );
};

export default LoginDriver;