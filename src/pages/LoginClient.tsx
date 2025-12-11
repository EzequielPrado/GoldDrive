import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, User, Lock, Mail, Eye, EyeOff, Camera, ShieldCheck, ChevronLeft, KeyRound } from "lucide-react";

const LoginClient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1); 
  const [name, setName] = useState("");
  
  // Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para foto
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  useEffect(() => {
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/client');
    };
    checkUser();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const nextStep = () => {
      if (!name || !email || !password || !confirmPassword) {
          showError("Preencha todos os campos.");
          return;
      }
      if (password.length < 6) {
          showError("A senha deve ter no mínimo 6 caracteres.");
          return;
      }
      if (password !== confirmPassword) {
          showError("As senhas não coincidem.");
          return;
      }
      setStep(2);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!email || !password) return showError("Preencha todos os campos");
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if(error) throw error;
        navigate('/client');
    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if(!avatarFile) {
        showError("A foto de perfil é obrigatória para sua segurança.");
        return;
    }

    setLoading(true);
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password,
            options: { data: { role: 'client', first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') } }
        });
        if(authError) throw authError;

        if (authData.user && avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const filePath = `${authData.user.id}/avatar-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
                await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', authData.user.id);
            }
        }
        showSuccess("Conta criada! Verifique seu email.");
    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex font-sans">
       {/* Esquerda - Imagem (Desktop) */}
       <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1496442226666-8d4a0e29f122?q=80&w=2576&auto=format&fit=crop')] bg-cover bg-center opacity-40" />
           <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 to-transparent" />
           <div className="relative z-10 p-12 text-center">
                <img src="/logo-goldmobile-2.png" alt="Gold Mobile" className="w-64 mx-auto mb-8" />
                <p className="text-gray-300 text-xl font-light max-w-md mx-auto">Sua experiência premium de mobilidade urbana começa aqui.</p>
           </div>
       </div>

       {/* Direita - Formulário */}
       <div className="w-full lg:w-1/2 flex flex-col relative overflow-y-auto bg-zinc-950">
           {/* Header Mobile */}
           <div className="p-6 flex items-center lg:absolute lg:top-0 lg:left-0 lg:z-20 lg:w-full">
               <Button variant="ghost" onClick={() => isSignUp && step > 1 ? setStep(1) : isSignUp ? setIsSignUp(false) : navigate('/')} className="hover:bg-zinc-800 text-white rounded-full w-12 h-12 p-0 shrink-0">
                   {isSignUp && step === 2 ? <ChevronLeft className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
               </Button>
               
               {/* Logo Mobile Header (Fora do Card) */}
               <img src="/logo-goldmobile-2.png" alt="Gold Mobile" className="h-8 ml-4 lg:hidden" />
           </div>

           <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-10">
               {/* Container Branco */}
               <div className="bg-white rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
                   {/* Barra Decorativa Superior */}
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-black via-zinc-800 to-yellow-500" />

                   <div className="mb-8 text-center">
                       <h2 className="text-3xl font-black text-slate-900">{isSignUp ? "Criar Conta" : "Login Passageiro"}</h2>
                       <p className="text-gray-500 mt-2 text-sm">{isSignUp ? "Siga as etapas para começar." : "Entre para solicitar sua corrida."}</p>
                   </div>

                   {/* LOGIN FORM */}
                   {!isSignUp && (
                       <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-3">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                                        <Input type="email" placeholder="seu@email.com" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl focus:border-black focus:ring-0 text-slate-900 font-medium" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-3 mr-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
                                        <span className="text-xs font-bold text-yellow-600 cursor-pointer hover:underline">Esqueceu?</span>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                                        <Input 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="••••••••" 
                                            className="h-14 pl-12 pr-12 bg-gray-50 border-gray-200 rounded-2xl focus:border-black focus:ring-0 text-slate-900 font-medium" 
                                            value={password} 
                                            onChange={e => setPassword(e.target.value)} 
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-gray-400 hover:text-black focus:outline-none">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800 shadow-xl mt-4" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
                                </Button>
                            </form>

                            {/* DESTAQUE DE CADASTRO */}
                            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-3xl p-6 text-center space-y-3">
                                <p className="text-slate-800 font-bold text-sm">
                                    Ainda não tem conta? <br/>
                                    <span className="font-normal text-slate-600">Clique no botão abaixo e crie em menos de 1 minuto.</span>
                                </p>
                                <Button onClick={() => { setIsSignUp(true); setStep(1); }} className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl shadow-lg shadow-yellow-500/20 text-base uppercase tracking-wide">
                                    CRIAR CONTA GRÁTIS
                                </Button>
                            </div>
                       </div>
                   )}

                   {/* SIGNUP FLOW */}
                   {isSignUp && (
                       <div className="animate-in slide-in-from-right fade-in duration-300">
                           
                           {/* Stepper Visual */}
                           <div className="flex items-center justify-between px-8 mb-8 relative">
                               {/* Linha de fundo */}
                               <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-100 -z-10 mx-12"></div>
                               {/* Progresso Ativo */}
                               <div className={`absolute left-0 top-1/2 h-1 bg-yellow-500 -z-10 mx-12 transition-all duration-500 ${step === 2 ? 'right-0' : 'right-1/2'}`}></div>

                               <div className="flex flex-col items-center gap-1">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${step >= 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 scale-110' : 'bg-gray-200 text-gray-500'}`}>
                                       1
                                   </div>
                                   <span className={`text-[10px] font-bold uppercase ${step >= 1 ? 'text-black' : 'text-gray-400'}`}>Dados</span>
                               </div>

                               <div className="flex flex-col items-center gap-1">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${step >= 2 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 scale-110' : 'bg-gray-200 text-gray-500'}`}>
                                       2
                                   </div>
                                   <span className={`text-[10px] font-bold uppercase ${step >= 2 ? 'text-black' : 'text-gray-400'}`}>Foto</span>
                               </div>
                           </div>

                           {step === 1 && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                                   <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-3">Nome Completo</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                                            <Input placeholder="Seu nome" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl focus:border-black focus:ring-0 text-slate-900 font-medium" value={name} onChange={e => setName(e.target.value)} />
                                        </div>
                                   </div>

                                   <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-3">Email</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                                            <Input type="email" placeholder="seu@email.com" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl focus:border-black focus:ring-0 text-slate-900 font-medium" value={email} onChange={e => setEmail(e.target.value)} />
                                        </div>
                                   </div>

                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase ml-3">Senha</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                                                <Input type={showPassword ? "text" : "password"} placeholder="******" className="h-14 pl-12 pr-10 bg-gray-50 border-gray-200 rounded-2xl focus:border-black focus:ring-0 text-slate-900 font-medium" value={password} onChange={e => setPassword(e.target.value)} />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-4 text-gray-400 hover:text-black"><Eye className="w-5 h-5" /></button>
                                            </div>
                                       </div>
                                       <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase ml-3">Confirmar</label>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                                                <Input type={showConfirmPassword ? "text" : "password"} placeholder="******" className="h-14 pl-12 pr-10 bg-gray-50 border-gray-200 rounded-2xl focus:border-black focus:ring-0 text-slate-900 font-medium" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-4 text-gray-400 hover:text-black"><Eye className="w-5 h-5" /></button>
                                            </div>
                                       </div>
                                   </div>
                                   
                                   <Button onClick={nextStep} className="w-full h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800 mt-4">Continuar <ArrowRight className="ml-2 w-5 h-5" /></Button>
                               </div>
                           )}

                           {step === 2 && (
                               <div className="space-y-6 text-center animate-in fade-in slide-in-from-right duration-300">
                                   <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl text-left flex gap-3">
                                       <ShieldCheck className="w-6 h-6 text-yellow-700 shrink-0" />
                                       <p className="text-sm text-yellow-800 font-medium">Para sua segurança e dos motoristas, precisamos de uma foto real do seu rosto.</p>
                                   </div>

                                   <div className="flex justify-center">
                                       <label className="relative group cursor-pointer">
                                           <div className={`w-40 h-40 rounded-[32px] border-4 border-dashed flex items-center justify-center overflow-hidden transition-all ${avatarPreview ? 'border-yellow-500 bg-black' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                                               {avatarPreview ? (
                                                   <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                               ) : (
                                                   <div className="flex flex-col items-center p-4">
                                                       <Camera className="w-10 h-10 text-gray-400 mb-2" />
                                                       <span className="text-sm font-bold text-gray-500">Enviar Selfie</span>
                                                   </div>
                                               )}
                                           </div>
                                           <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                           <div className="absolute -bottom-3 -right-3 bg-black text-white p-3 rounded-full shadow-lg border-4 border-white">
                                               <Camera className="w-5 h-5" />
                                           </div>
                                       </label>
                                   </div>

                                   <Button onClick={handleSignUp} disabled={loading} className="w-full h-14 text-lg font-black rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black shadow-xl shadow-yellow-500/20">
                                       {loading ? <Loader2 className="animate-spin" /> : "FINALIZAR CADASTRO"}
                                   </Button>
                               </div>
                           )}
                       </div>
                   )}
               </div>
               <p className="text-center text-xs text-zinc-500 mt-8 font-medium">Gold Mobile &copy; 2025</p>
           </div>
       </div>
    </div>
  );
};

export default LoginClient;