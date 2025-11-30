import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car, Upload, Camera, CheckCircle2, User, FileText, ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

// Tipos para o formulário
interface FormData {
  // Etapa 1
  firstName: string;
  lastName: string;
  email: string;
  password: string;
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
  
  // Controle de Etapas (1, 2, 3)
  const [step, setStep] = useState(1);

  // Estado Unificado
  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", email: "", password: "", cpf: "", phone: "",
    facePhoto: null, cnhFront: null, cnhBack: null,
    carModel: "", carPlate: "", carYear: "", carColor: ""
  });

  // Previews de Imagem
  const [previews, setPreviews] = useState({ face: "", cnhFront: "", cnhBack: "" });

  // Verificação de sessão
  useEffect(() => {
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/driver');
    };
    checkUser();
  }, [navigate]);

  const handleChange = (field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: 'facePhoto' | 'cnhFront' | 'cnhBack', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setForm(prev => ({ ...prev, [field]: file }));
      // Criar preview
      const url = URL.createObjectURL(file);
      setPreviews(prev => ({ ...prev, [field === 'facePhoto' ? 'face' : field]: url }));
    }
  };

  const validateStep1 = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.cpf || !form.phone) {
      showError("Preencha todos os campos obrigatórios.");
      return false;
    }
    if (form.password.length < 6) {
      showError("A senha deve ter pelo menos 6 caracteres.");
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
      .from('avatars') // Usando bucket existente para garantir funcionamento
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Limpeza preventiva de sessão
      await supabase.auth.signOut({ scope: 'global' });
      
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
      // 1. Criar Usuário Auth
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

      // 2. Upload Arquivos
      const faceUrl = await uploadFile(form.facePhoto!, `${userId}/face`);
      const cnhFrontUrl = await uploadFile(form.cnhFront!, `${userId}/cnh_front`);
      const cnhBackUrl = await uploadFile(form.cnhBack!, `${userId}/cnh_back`);

      // 3. Atualizar Profile com TUDO
      const { error: profileError } = await supabase.from('profiles').update({
        phone: form.phone,
        cpf: form.cpf,
        face_photo_url: faceUrl,
        avatar_url: faceUrl, // Usa a foto do rosto como avatar inicial
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
      // Redireciona para login ou dashboard (dependendo se o email confirm é obrigatório)
      // Como a maioria dos setups pede confirm, avisamos:
      navigate('/login/driver'); 
      
    } catch (e: any) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Componente de Upload Visual
  const UploadBox = ({ label, field, preview }: { label: string, field: 'facePhoto' | 'cnhFront' | 'cnhBack', preview: string }) => (
    <div className="space-y-2">
      <Label className="text-gray-300 text-xs font-bold uppercase">{label}</Label>
      <label className={`
        relative flex flex-col items-center justify-center w-full h-32 
        border-2 border-dashed rounded-2xl cursor-pointer transition-all overflow-hidden
        ${preview ? 'border-yellow-500 bg-black' : 'border-gray-700 bg-gray-900/50 hover:bg-gray-800 hover:border-gray-500'}
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
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-yellow-500 selection:text-black">
       {/* Header Simplificado */}
       <div className="p-6 flex items-center justify-between z-10">
           <Button variant="ghost" onClick={() => isSignUp && step > 1 ? prevStep() : isSignUp ? setIsSignUp(false) : navigate('/')} className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0">
               {isSignUp && step > 1 ? <ChevronLeft className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
           </Button>
           <div className="flex items-center gap-2">
               <Car className="w-5 h-5 text-yellow-500" />
               <span className="font-bold tracking-tight">GoldDrive Driver</span>
           </div>
       </div>

       {/* Conteúdo Principal */}
       <div className="flex-1 flex flex-col px-6 pb-10 max-w-lg mx-auto w-full z-10">
           
           {!isSignUp ? (
               // --- LOGIN FORM ---
               <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-8 duration-500">
                   <div className="mb-8">
                       <h1 className="text-4xl font-black text-white mb-2">Bem-vindo<br/>de volta.</h1>
                       <p className="text-gray-400">Faça login para gerenciar suas corridas e ganhos.</p>
                   </div>
                   <form onSubmit={handleLogin} className="space-y-4">
                       <Input type="email" placeholder="Email" className="h-14 bg-gray-900 border-gray-800 text-white rounded-xl focus:border-yellow-500 focus:ring-yellow-500" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                       <Input type="password" placeholder="Senha" className="h-14 bg-gray-900 border-gray-800 text-white rounded-xl focus:border-yellow-500 focus:ring-yellow-500" value={form.password} onChange={e => handleChange('password', e.target.value)} />
                       <Button type="submit" className="w-full h-14 text-lg font-bold rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black mt-4" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
                       </Button>
                   </form>
                   <div className="mt-8 text-center">
                       <p className="text-gray-500">Novo motorista? <button onClick={() => { setIsSignUp(true); setStep(1); }} className="text-yellow-500 font-bold hover:underline">Cadastre-se</button></p>
                   </div>
               </div>
           ) : (
               // --- SIGNUP FLOW ---
               <div className="flex-1 flex flex-col">
                   {/* Progress Bar */}
                   <div className="flex gap-2 mb-8">
                       {[1, 2, 3].map(i => (
                           <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-yellow-500' : 'bg-gray-800'}`} />
                       ))}
                   </div>

                   <div className="flex-1">
                       {step === 1 && (
                           <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                               <div className="mb-6">
                                   <h2 className="text-2xl font-bold flex items-center gap-2"><User className="w-6 h-6 text-yellow-500"/> Dados Pessoais</h2>
                                   <p className="text-gray-400 text-sm">Precisamos saber quem é você.</p>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                   <Input placeholder="Nome" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                                   <Input placeholder="Sobrenome" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                               </div>
                               <Input placeholder="CPF (Apenas números)" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.cpf} onChange={e => handleChange('cpf', e.target.value)} maxLength={14} />
                               <Input placeholder="Telefone / WhatsApp" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
                               <Input type="email" placeholder="Seu melhor email" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                               <Input type="password" placeholder="Crie uma senha forte" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.password} onChange={e => handleChange('password', e.target.value)} />
                               
                               <Button onClick={nextStep} className="w-full h-14 bg-white text-black hover:bg-gray-200 font-bold rounded-xl mt-4">
                                   Próximo <ArrowRight className="ml-2 w-4 h-4" />
                               </Button>
                           </div>
                       )}

                       {step === 2 && (
                           <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                               <div className="mb-6">
                                   <h2 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-yellow-500"/> Documentação</h2>
                                   <p className="text-gray-400 text-sm">Envie fotos claras dos seus documentos.</p>
                               </div>
                               
                               <UploadBox label="Sua Foto de Rosto (Selfie)" field="facePhoto" preview={previews.face} />
                               <div className="grid grid-cols-2 gap-4">
                                   <UploadBox label="CNH (Frente)" field="cnhFront" preview={previews.cnhFront} />
                                   <UploadBox label="CNH (Verso)" field="cnhBack" preview={previews.cnhBack} />
                               </div>

                               <Button onClick={nextStep} className="w-full h-14 bg-white text-black hover:bg-gray-200 font-bold rounded-xl mt-4">
                                   Próximo <ArrowRight className="ml-2 w-4 h-4" />
                               </Button>
                           </div>
                       )}

                       {step === 3 && (
                           <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                               <div className="mb-6">
                                   <h2 className="text-2xl font-bold flex items-center gap-2"><Car className="w-6 h-6 text-yellow-500"/> Seu Veículo</h2>
                                   <p className="text-gray-400 text-sm">Qual carro você vai utilizar?</p>
                               </div>
                               
                               <Input placeholder="Modelo (ex: Honda Civic)" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.carModel} onChange={e => handleChange('carModel', e.target.value)} />
                               <Input placeholder="Placa (ex: ABC-1234)" className="h-12 bg-gray-900 border-gray-800 rounded-xl uppercase" value={form.carPlate} onChange={e => handleChange('carPlate', e.target.value.toUpperCase())} />
                               <div className="grid grid-cols-2 gap-4">
                                   <Input type="number" placeholder="Ano" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.carYear} onChange={e => handleChange('carYear', e.target.value)} />
                                   <Input placeholder="Cor" className="h-12 bg-gray-900 border-gray-800 rounded-xl" value={form.carColor} onChange={e => handleChange('carColor', e.target.value)} />
                               </div>

                               <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20 text-yellow-200 text-xs mt-4">
                                   Ao finalizar, seus dados serão enviados para análise. Você será notificado por email.
                               </div>

                               <Button onClick={handleSignUp} disabled={loading} className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl mt-4 shadow-lg shadow-yellow-500/20">
                                   {loading ? <Loader2 className="animate-spin" /> : "FINALIZAR CADASTRO"}
                               </Button>
                           </div>
                       )}
                   </div>
               </div>
           )}
       </div>
    </div>
  );
};

export default LoginDriver;