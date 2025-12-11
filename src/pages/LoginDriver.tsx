import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car, Camera, ShieldCheck, Mail, Lock, Phone, CreditCard, ChevronLeft, Eye, EyeOff, KeyRound, Ban, User, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Tipos para o formulário
interface FormData {
  firstName: string; lastName: string; email: string; password: string; confirmPassword?: string; cpf: string; phone: string;
  facePhoto: File | null; cnhFront: File | null; cnhBack: File | null;
  carModel: string; carPlate: string; carYear: string; carColor: string;
}

const LoginDriver = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "", cpf: "", phone: "",
    facePhoto: null, cnhFront: null, cnhBack: null, carModel: "", carPlate: "", carYear: "", carColor: ""
  });
  const [previews, setPreviews] = useState({ face: "", cnhFront: "", cnhBack: "" });

  useEffect(() => {
    if (searchParams.get('blocked') === 'true') setIsBlockedModalOpen(true);
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase.from('profiles').select('driver_status, role, is_blocked').eq('id', session.user.id).single();
            if (profile?.is_blocked) { await supabase.auth.signOut(); setIsBlockedModalOpen(true); return; }
            if (profile?.role === 'driver') navigate(profile.driver_status === 'PENDING' ? '/driver-pending' : '/driver');
        }
    };
    checkUser();
  }, [navigate, searchParams]);

  const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
  const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
  const handleChange = (f: keyof FormData, v: string) => setForm(p => ({ ...p, [f]: f === 'cpf' ? formatCPF(v) : f === 'phone' ? formatPhone(v) : v }));
  
  const handleFileChange = (field: 'facePhoto' | 'cnhFront' | 'cnhBack', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setForm(prev => ({ ...prev, [field]: file }));
      setPreviews(prev => ({ ...prev, [field === 'facePhoto' ? 'face' : field]: URL.createObjectURL(file) }));
    }
  };

  const validateStep1 = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.cpf || !form.phone || !form.confirmPassword) { showError("Preencha todos os campos."); return false; }
    if (form.password.length < 6) { showError("Senha curta."); return false; }
    if (form.password !== form.confirmPassword) { showError("Senhas não coincidem."); return false; }
    return true;
  };
  const validateStep2 = () => {
    if (!form.facePhoto || !form.cnhFront || !form.cnhBack) { showError("Envie todas as fotos."); return false; }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const uploadFile = async (file: File, path: string) => {
    const fileName = `${path}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('avatars').upload(`driver_docs/${fileName}`, file);
    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(`driver_docs/${fileName}`).data.publicUrl;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;
      // Otimização: Seleciona apenas campos necessários para decisão de roteamento
      const { data: profile } = await supabase.from('profiles').select('role, driver_status, is_blocked').eq('id', data.user.id).single();
      
      if (profile?.is_blocked) { await supabase.auth.signOut(); setIsBlockedModalOpen(true); return; }
      
      navigate(profile?.role === 'driver' ? (profile.driver_status === 'PENDING' ? '/driver-pending' : '/driver') : '/client');
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!form.carModel || !form.carPlate || !form.carYear || !form.carColor) { showError("Preencha o veículo."); return; }
    setLoading(true);
    try {
      const { data: auth, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { role: 'driver', first_name: form.firstName, last_name: form.lastName } } });
      if (error || !auth.user) throw error || new Error("Erro auth");
      const [face, cnhF, cnhB] = await Promise.all([uploadFile(form.facePhoto!, `${auth.user.id}/face`), uploadFile(form.cnhFront!, `${auth.user.id}/cnhF`), uploadFile(form.cnhBack!, `${auth.user.id}/cnhB`)]);
      await supabase.from('profiles').update({ phone: form.phone, cpf: form.cpf, face_photo_url: face, avatar_url: face, cnh_front_url: cnhF, cnh_back_url: cnhB, car_model: form.carModel, car_plate: form.carPlate.toUpperCase(), car_year: form.carYear, car_color: form.carColor, driver_status: 'PENDING' }).eq('id', auth.user.id);
      navigate('/driver-pending');
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const UploadBox = ({ label, field, preview }: any) => (
    <div className="space-y-1 w-full">
      <Label className="text-xs font-bold uppercase ml-2 text-slate-500">{label}</Label>
      <label className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer overflow-hidden transition-all ${preview ? 'border-yellow-500 bg-black' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
        {preview ? <img src={preview} className="w-full h-full object-cover opacity-80" /> : <div className="text-center"><Camera className="w-8 h-8 text-gray-400 mx-auto mb-1" /><span className="text-xs font-bold text-gray-500">Enviar Foto</span></div>}
        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(field, e)} />
      </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex font-sans">
       <Dialog open={isBlockedModalOpen} onOpenChange={setIsBlockedModalOpen}><DialogContent className="rounded-2xl border-0"><div className="text-center p-6"><Ban className="w-16 h-16 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-black">Bloqueado</h2><p className="text-gray-500 mt-2">Sua conta possui pendências.</p></div></DialogContent></Dialog>

       {/* Lado Esquerdo - Visual */}
       <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40" />
           <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/80 to-transparent" />
           <div className="relative z-10 px-12 text-center">
                <img src="/logo-goldmobile-2.png" alt="Gold" className="w-64 mb-8 mx-auto" />
                <h2 className="text-6xl font-black text-white tracking-tighter mb-4">SEJA <span className="text-yellow-500">GOLD</span>.</h2>
                <p className="text-xl text-gray-300 font-light">Taxas justas. Pagamento rápido. Respeito real.</p>
           </div>
       </div>

       {/* Lado Direito - Form */}
       <div className="w-full lg:w-1/2 flex flex-col bg-zinc-950 relative overflow-y-auto">
           {/* Header Mobile */}
           <div className="p-6 flex items-center lg:absolute lg:top-0 lg:left-0 lg:z-20 lg:w-full">
               <Button variant="ghost" onClick={() => isSignUp && step > 1 ? setStep(s => s - 1) : isSignUp ? setIsSignUp(false) : navigate('/')} className="hover:bg-zinc-800 text-white rounded-full w-12 h-12 p-0 shrink-0">
                   {isSignUp && step > 1 ? <ChevronLeft className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
               </Button>
               
               {/* Logo Mobile Header (Fora do Card) */}
               <img src="/logo-goldmobile-2.png" alt="Gold" className="h-8 ml-4 lg:hidden" />
           </div>

           <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-10">
               <div className="bg-white rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-500 via-zinc-800 to-black" />
                   
                   <div className="mb-8 text-center">
                       <h2 className="text-3xl font-black text-slate-900">{isSignUp ? "Cadastro Motorista" : "Login Motorista"}</h2>
                       <p className="text-gray-500 mt-2 text-sm">{isSignUp ? "Junte-se à elite do transporte." : "Bem-vindo de volta, parceiro."}</p>
                   </div>

                   {!isSignUp ? (
                       <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                           <form onSubmit={handleLogin} className="space-y-5">
                               <div className="relative group">
                                   <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                                   <Input type="email" placeholder="Email cadastrado" className="h-14 pl-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all text-slate-900" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                               </div>
                               <div className="relative group">
                                   <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                                   <Input type={showPassword ? "text" : "password"} placeholder="Sua senha" className="h-14 pl-12 pr-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all text-slate-900" value={form.password} onChange={e => handleChange('password', e.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><Eye className="w-5 h-5" /></button>
                               </div>
                               <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl mt-4" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Acessar Painel"}</Button>
                           </form>
                           
                           {/* DESTAQUE DE CADASTRO */}
                            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-3xl p-6 text-center space-y-3">
                                <p className="text-slate-800 font-bold text-sm">
                                    Ainda não tem conta? <br/>
                                    <span className="font-normal text-slate-600">Clique no botão abaixo e crie em menos de 1 minuto.</span>
                                </p>
                                <Button onClick={() => { setIsSignUp(true); setStep(1); }} className="w-full h-12 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl shadow-lg shadow-yellow-500/20 text-base uppercase tracking-wide">
                                    QUERO SER MOTORISTA
                                </Button>
                            </div>
                       </div>
                   ) : (
                       <div className="animate-in slide-in-from-right fade-in duration-300">
                           {/* STEPPER VISUAL */}
                           <div className="flex items-center justify-between px-6 mb-8 relative">
                               <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-100 -z-10 mx-10"></div>
                               <div className={`absolute left-0 top-1/2 h-1 bg-yellow-500 -z-10 mx-10 transition-all duration-500 ${step === 1 ? 'w-[0%]' : step === 2 ? 'w-[50%]' : 'w-[100%]'}`}></div>

                               {[
                                   { num: 1, label: 'Dados', icon: User },
                                   { num: 2, label: 'Docs', icon: FileText },
                                   { num: 3, label: 'Veículo', icon: Car }
                               ].map((s) => (
                                   <div key={s.num} className="flex flex-col items-center gap-1 bg-white px-2">
                                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${step >= s.num ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 scale-110' : 'bg-gray-200 text-gray-500'}`}>
                                           {s.num}
                                       </div>
                                       <span className={`text-[10px] font-bold uppercase ${step >= s.num ? 'text-black' : 'text-gray-400'}`}>{s.label}</span>
                                   </div>
                               ))}
                           </div>

                           {step === 1 && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                                   <div className="grid grid-cols-2 gap-4">
                                       <Input placeholder="Nome" className="h-14 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                                       <Input placeholder="Sobrenome" className="h-14 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div className="relative group"><CreditCard className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="CPF" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl font-mono text-slate-900" value={form.cpf} onChange={e => handleChange('cpf', e.target.value)} /></div>
                                       <div className="relative group"><Phone className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="WhatsApp" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.phone} onChange={e => handleChange('phone', e.target.value)} /></div>
                                   </div>
                                   <div className="space-y-1"><div className="relative"><Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="Email" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.email} onChange={e => handleChange('email', e.target.value)} /></div></div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div className="relative"><Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input type={showPassword ? "text" : "password"} placeholder="Senha" className="h-14 pl-12 pr-10 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.password} onChange={e => handleChange('password', e.target.value)} /><button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-4 text-gray-400"><Eye className="w-5 h-5"/></button></div>
                                       <div className="relative"><KeyRound className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirmar" className="h-14 pl-12 pr-10 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} /><button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-4 text-gray-400"><Eye className="w-5 h-5"/></button></div>
                                   </div>
                                   <Button onClick={() => validateStep1() && setStep(2)} className="w-full h-14 bg-black text-white hover:bg-zinc-800 rounded-2xl mt-4">Continuar</Button>
                               </div>
                           )}

                           {step === 2 && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                                   <UploadBox label="Sua Foto (Selfie)" field="facePhoto" preview={previews.face} />
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <UploadBox label="CNH Frente" field="cnhFront" preview={previews.cnhFront} />
                                       <UploadBox label="CNH Verso" field="cnhBack" preview={previews.cnhBack} />
                                   </div>
                                   <Button onClick={() => validateStep2() && setStep(3)} className="w-full h-14 bg-black text-white hover:bg-zinc-800 rounded-2xl mt-4">Continuar</Button>
                               </div>
                           )}

                           {step === 3 && (
                               <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <Input placeholder="Modelo (ex: Civic)" className="h-14 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.carModel} onChange={e => handleChange('carModel', e.target.value)} />
                                       <Input placeholder="Placa" className="h-14 bg-gray-50 border-gray-200 rounded-2xl uppercase text-slate-900" value={form.carPlate} onChange={e => handleChange('carPlate', e.target.value.toUpperCase())} maxLength={7} />
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <Input type="number" placeholder="Ano" className="h-14 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.carYear} onChange={e => handleChange('carYear', e.target.value)} />
                                       <Input placeholder="Cor" className="h-14 bg-gray-50 border-gray-200 rounded-2xl text-slate-900" value={form.carColor} onChange={e => handleChange('carColor', e.target.value)} />
                                   </div>
                                   <Button onClick={handleSignUp} disabled={loading} className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl mt-6 shadow-xl">{loading ? <Loader2 className="animate-spin"/> : "FINALIZAR CADASTRO"}</Button>
                               </div>
                           )}
                       </div>
                   )}
               </div>
               <p className="text-center text-xs text-zinc-500 mt-8 font-medium">Gold Mobile Driver &copy; 2025</p>
           </div>
       </div>
    </div>
  );
};

export default LoginDriver;