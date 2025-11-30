import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car, Camera, ShieldCheck, Mail, Lock, Phone, CreditCard, ChevronLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { Label } from "@/components/ui/label";

// Tipos para o formulário
interface FormData {
  // Etapa 1
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword?: string; // Novo campo
  cpf: string;
  phone: string;
  // Etapa 2 (Arquivos)
  facePhoto: File | null;
  cnhFront: File | null;
  cnhBack: File | null;
  // Etapa 3
  carModel: string;
  carPlate: string;
  carYear: string;
  carColor: string;
}

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1);
  
  // Controle de visibilidade de senha
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "", cpf: "", phone: "",
    facePhoto: null, cnhFront: null, cnhBack: null,
    carModel: "", carPlate: "", carYear: "", carColor: ""
  });

  const [previews, setPreviews] = useState({ face: "", cnhFront: "", cnhBack: "" });

  useEffect(() => {
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/driver');
    };
    checkUser();
  }, [navigate]);

  // --- MÁSCARAS DE INPUT ---
  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const handleChange = (field: keyof FormData, value: string) => {
    let formattedValue = value;
    if (field === 'cpf') formattedValue = formatCPF(value);
    if (field === 'phone') formattedValue = formatPhone(value);
    
    setForm(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleFileChange = (field: 'facePhoto' | 'cnhFront' | 'cnhBack', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setForm(prev => ({ ...prev, [field]: file }));
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [field === 'facePhoto' ? 'face' : field]: url }));
    }
  };

  const validateStep1 = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.cpf || !form.phone || !form.confirmPassword) {
      showError("Preencha todos os campos obrigatórios.");
      return false;
    }
    if (form.password.length < 6) {
      showError("A senha deve ter pelo menos 6 caracteres.");
      return false;
    }
    if (form.password !== form.confirmPassword) {
      showError("As senhas não coincidem.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.facePhoto || !form.cnhFront || !form.cnhBack) {
      showError("Por favor, envie todas as fotos solicitadas.");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => setStep(prev => prev - 1);

  const uploadFile = async (file: File, path: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `driver_docs/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password
      });
      if (error) throw error;
      navigate('/driver');
    } catch (e: any) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!form.carModel || !form.carPlate || !form.carYear || !form.carColor) {
      showError("Preencha os dados do veículo.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            role: 'driver',
            first_name: form.firstName,
            last_name: form.lastName
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      const userId = authData.user.id;

      const faceUrl = await uploadFile(form.facePhoto!, `${userId}/face`);
      const cnhFrontUrl = await uploadFile(form.cnhFront!, `${userId}/cnh_front`);
      const cnhBackUrl = await uploadFile(form.cnhBack!, `${userId}/cnh_back`);

      const { error: profileError } = await supabase.from('profiles').update({
        phone: form.phone,
        cpf: form.cpf,
        face_photo_url: faceUrl,
        avatar_url: faceUrl,
        cnh_front_url: cnhFrontUrl,
        cnh_back_url: cnhBackUrl,
        car_model: form.carModel,
        car_plate: form.carPlate.toUpperCase(),
        car_year: form.carYear,
        car_color: form.carColor,
        driver_status: 'PENDING'
      }).eq('id', userId);

      if (profileError) throw profileError;

      showSuccess("Cadastro realizado! Aguarde aprovação.");
      navigate('/login/driver'); 
      setIsSignUp(false); // Volta pra tela de login
      
    } catch (e: any) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const UploadBox = ({ label, field, preview }: { label: string, field: 'facePhoto' | 'cnhFront' | 'cnhBack', preview: string }) => (
    <div className="space-y-2">
      <Label className="text-gray-500 text-xs font-bold uppercase tracking-wider">{label}</Label>
      <label className={`
        relative flex flex-col items-center justify-center w-full h-32 
        border-2 border-dashed rounded-2xl cursor-pointer transition-all overflow-hidden
        ${preview ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'}
      `}>
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Camera className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-xs text-gray-500 font-medium">Toque para enviar</p>
          </div>
        )}
        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(field, e)} />
        {preview && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <p className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">Alterar</p>
          </div>
        )}
      </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex font-sans">
       {/* Lado Esquerdo - Visual (Desktop) */}
       <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
           <div 
                className="absolute inset-0 opacity-40 bg-cover bg-center"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop')` }}
           />
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
           <div className="relative z-10 text-center px-12">
                <div className="w-20 h-20 bg-yellow-500 rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)]">
                    <Car className="w-10 h-10 text-black" />
                </div>
                <h2 className="text-5xl font-black text-white mb-6 tracking-tight">Dirija e<br/>Lucre Mais.</h2>
                <p className="text-gray-400 text-xl font-light leading-relaxed max-w-md mx-auto">
                    A plataforma que valoriza o motorista. Taxas justas, pagamentos rápidos e suporte 24h.
                </p>
                
                <div className="mt-12 grid grid-cols-2 gap-6 text-left">
                     <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                         <div className="text-yellow-500 font-bold text-2xl mb-1">95%</div>
                         <div className="text-gray-400 text-sm">Ficam com o valor da corrida</div>
                     </div>
                     <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                         <div className="text-yellow-500 font-bold text-2xl mb-1">24h</div>
                         <div className="text-gray-400 text-sm">Suporte humanizado real</div>
                     </div>
                </div>
           </div>
       </div>

       {/* Lado Direito - Form */}
       <div className="w-full lg:w-1/2 flex flex-col relative bg-white">
           <div className="p-6">
               <Button variant="ghost" onClick={() => isSignUp && step > 1 ? prevStep() : isSignUp ? setIsSignUp(false) : navigate('/')} className="hover:bg-gray-100 rounded-full w-12 h-12 p-0 -ml-2">
                   {isSignUp && step > 1 ? <ChevronLeft className="w-6 h-6 text-gray-800" /> : <ArrowLeft className="w-6 h-6 text-gray-800" />}
               </Button>
           </div>

           <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 max-w-xl mx-auto w-full pb-10">
               
               <div className="mb-8 animate-in slide-in-from-bottom-4 duration-700">
                   <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Gold<span className="text-yellow-500">Driver</span></h1>
                   {!isSignUp ? (
                       <>
                           <h2 className="text-2xl font-bold text-slate-800">Acesse seu painel</h2>
                           <p className="text-gray-500 mt-2">Gerencie suas corridas e acompanhe seus ganhos.</p>
                       </>
                   ) : (
                       <>
                           <h2 className="text-2xl font-bold text-slate-800">Cadastro de Parceiro</h2>
                           <p className="text-gray-500 mt-2">Junte-se à frota mais exclusiva da cidade.</p>
                       </>
                   )}
               </div>

               {!isSignUp ? (
                   // --- LOGIN FORM ---
                   <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                       <form onSubmit={handleLogin} className="space-y-5">
                           <div className="relative group">
                               <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                               <Input type="email" placeholder="Email cadastrado" className="h-14 pl-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                           </div>
                           
                           <div className="relative group">
                               <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-yellow-600 transition-colors" />
                               <Input 
                                  type={showPassword ? "text" : "password"} 
                                  placeholder="Sua senha" 
                                  className="h-14 pl-12 pr-12 bg-gray-50 border-gray-200 text-base rounded-2xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all" 
                                  value={form.password} 
                                  onChange={e => handleChange('password', e.target.value)} 
                               />
                               <button 
                                  type="button" 
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                               >
                                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                               </button>
                           </div>

                           <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] mt-4" disabled={loading}>
                               {loading ? <Loader2 className="animate-spin" /> : "Entrar no Painel"}
                               {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
                           </Button>
                       </form>
                       <div className="mt-8 text-center">
                           <p className="text-gray-500">Ainda não é parceiro? <button onClick={() => { setIsSignUp(true); setStep(1); }} className="font-bold text-yellow-600 hover:text-yellow-700 hover:underline">Cadastre-se agora</button></p>
                       </div>
                   </div>
               ) : (
                   // --- SIGNUP FLOW ---
                   <div className="flex flex-col h-full">
                       {/* Barra de Progresso */}
                       <div className="flex items-center gap-2 mb-8">
                           {[1, 2, 3].map(i => (
                               <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-yellow-500 shadow-md shadow-yellow-500/30' : 'bg-gray-100'}`} />
                           ))}
                       </div>

                       {step === 1 && (
                           <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                               <div className="flex items-center gap-3 mb-2">
                                   <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold">1</div>
                                   <h3 className="font-bold text-lg text-slate-800">Dados Pessoais</h3>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-4">
                                   <Input placeholder="Nome" className="h-14 bg-gray-50 border-gray-200 rounded-2xl" value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                                   <Input placeholder="Sobrenome" className="h-14 bg-gray-50 border-gray-200 rounded-2xl" value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                               </div>
                               
                               <div className="relative">
                                    <CreditCard className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                    <Input placeholder="CPF (000.000.000-00)" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl font-mono text-sm" value={form.cpf} onChange={e => handleChange('cpf', e.target.value)} maxLength={14} />
                               </div>

                               <div className="relative">
                                    <Phone className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                    <Input placeholder="WhatsApp (00) 00000-0000" className="h-14 pl-12 bg-gray-50 border-gray-200 rounded-2xl" value={form.phone} onChange={e => handleChange('phone', e.target.value)} maxLength={15} />
                               </div>

                               <Input type="email" placeholder="Email para login" className="h-14 bg-gray-50 border-gray-200 rounded-2xl" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                               
                               <div className="relative">
                                  <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                  <Input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="Crie uma senha forte" 
                                    className="h-14 pl-12 pr-12 bg-gray-50 border-gray-200 rounded-2xl" 
                                    value={form.password} 
                                    onChange={e => handleChange('password', e.target.value)} 
                                  />
                                  <button 
                                      type="button" 
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                                  >
                                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                  </button>
                               </div>

                               <div className="relative">
                                  <KeyRound className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                  <Input 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    placeholder="Confirme sua senha" 
                                    className="h-14 pl-12 pr-12 bg-gray-50 border-gray-200 rounded-2xl" 
                                    value={form.confirmPassword} 
                                    onChange={e => handleChange('confirmPassword', e.target.value)} 
                                  />
                                  <button 
                                      type="button" 
                                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                      className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                                  >
                                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                  </button>
                               </div>
                               
                               <Button onClick={nextStep} className="w-full h-14 bg-slate-900 text-white hover:bg-black font-bold rounded-2xl mt-4 shadow-xl">
                                   Continuar <ArrowRight className="ml-2 w-4 h-4" />
                               </Button>
                           </div>
                       )}

                       {step === 2 && (
                           <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                               <div className="flex items-center gap-3 mb-2">
                                   <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold">2</div>
                                   <h3 className="font-bold text-lg text-slate-800">Documentação</h3>
                               </div>

                               <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
                                   <p className="text-sm text-blue-700 flex items-start gap-2">
                                       <ShieldCheck className="w-5 h-5 shrink-0" />
                                       Seus dados estão seguros e serão usados apenas para validação cadastral.
                                   </p>
                               </div>

                               <UploadBox label="Foto de Perfil (Rosto visível)" field="facePhoto" preview={previews.face} />
                               
                               <div className="grid grid-cols-2 gap-4">
                                   <UploadBox label="CNH Frente" field="cnhFront" preview={previews.cnhFront} />
                                   <UploadBox label="CNH Verso" field="cnhBack" preview={previews.cnhBack} />
                               </div>

                               <Button onClick={nextStep} className="w-full h-14 bg-slate-900 text-white hover:bg-black font-bold rounded-2xl mt-4 shadow-xl">
                                   Continuar <ArrowRight className="ml-2 w-4 h-4" />
                               </Button>
                           </div>
                       )}

                       {step === 3 && (
                           <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                               <div className="flex items-center gap-3 mb-2">
                                   <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold">3</div>
                                   <h3 className="font-bold text-lg text-slate-800">Seu Veículo</h3>
                               </div>
                               
                               <Input placeholder="Modelo (ex: Honda Civic)" className="h-14 bg-gray-50 border-gray-200 rounded-2xl" value={form.carModel} onChange={e => handleChange('carModel', e.target.value)} />
                               <Input placeholder="Placa (ex: ABC-1234)" className="h-14 bg-gray-50 border-gray-200 rounded-2xl uppercase font-mono" value={form.carPlate} onChange={e => handleChange('carPlate', e.target.value.toUpperCase())} maxLength={7} />
                               
                               <div className="grid grid-cols-2 gap-4">
                                   <Input type="number" placeholder="Ano (ex: 2020)" className="h-14 bg-gray-50 border-gray-200 rounded-2xl" value={form.carYear} onChange={e => handleChange('carYear', e.target.value)} />
                                   <Input placeholder="Cor (ex: Prata)" className="h-14 bg-gray-50 border-gray-200 rounded-2xl" value={form.carColor} onChange={e => handleChange('carColor', e.target.value)} />
                               </div>

                               <Button onClick={handleSignUp} disabled={loading} className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl mt-6 shadow-xl shadow-yellow-500/20 text-lg">
                                   {loading ? <Loader2 className="animate-spin" /> : "FINALIZAR CADASTRO"}
                               </Button>
                           </div>
                       )}
                   </div>
               )}
           </div>
           
           <div className="p-6 text-center lg:hidden"><p className="text-xs text-gray-400 font-medium">GoldDrive Driver &copy; 2024</p></div>
       </div>
    </div>
  );
};

export default LoginDriver;