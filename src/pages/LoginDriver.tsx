import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, Car, Upload, Check, ChevronRight, FileText, User, CreditCard } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1); // 1: Info, 2: Docs, 3: Car

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  
  // Car States
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carYear, setCarYear] = useState("");
  const [carColor, setCarColor] = useState("");

  // Files
  const [files, setFiles] = useState<{
      face: File | null,
      cnhFront: File | null,
      cnhBack: File | null
  }>({ face: null, cnhFront: null, cnhBack: null });

  useEffect(() => {
    // Se já estiver logado, vai pro painel
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) navigate('/driver');
    };
    checkUser();
  }, [navigate]);

  // LOGIN SIMPLES
  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if(error) throw error;
          navigate('/driver');
      } catch(e: any) { showError(e.message); }
      finally { setLoading(false); }
  };

  // CADASTRO MULTI-STEP
  const handleNextStep = () => {
      if(step === 1) {
          if(!fullName || !email || !password || !phone) return showError("Preencha todos os campos básicos.");
          setStep(2);
      } else if (step === 2) {
          if(!cpf) return showError("Digite seu CPF.");
          if(!files.face || !files.cnhFront || !files.cnhBack) return showError("Faça upload de todos os documentos.");
          setStep(3);
      }
  };

  const uploadFile = async (userId: string, file: File, folder: string) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${folder}-${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('driver-documents').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('driver-documents').getPublicUrl(fileName);
      return publicUrl;
  };

  const handleRegister = async () => {
      if(!carModel || !carPlate || !carYear || !carColor) return showError("Preencha os dados do veículo.");
      
      setLoading(true);
      try {
          // 1. Criar Usuário
          const { data: authData, error: authError } = await supabase.auth.signUp({
              email, password,
              options: { 
                  data: { 
                      role: 'driver', 
                      first_name: fullName.split(' ')[0], 
                      last_name: fullName.split(' ').slice(1).join(' ') 
                  } 
              }
          });
          if(authError) throw authError;
          if(!authData.user) throw new Error("Erro ao criar usuário.");

          const uid = authData.user.id;

          // 2. Upload Arquivos
          // Nota: O bucket 'driver-documents' precisa existir e ser público (ou ter policy correta)
          const faceUrl = await uploadFile(uid, files.face!, 'face');
          const cnhFrontUrl = await uploadFile(uid, files.cnhFront!, 'cnh-front');
          const cnhBackUrl = await uploadFile(uid, files.cnhBack!, 'cnh-back');

          // 3. Atualizar Profile
          const { error: profileError } = await supabase.from('profiles').update({
              phone,
              cpf,
              face_photo_url: faceUrl,
              cnh_front_url: cnhFrontUrl,
              cnh_back_url: cnhBackUrl,
              car_model: carModel,
              car_plate: carPlate.toUpperCase(),
              car_year: carYear,
              car_color: carColor,
              driver_status: 'PENDING' // Importante para KYC
          }).eq('id', uid);

          if(profileError) throw profileError;

          showSuccess("Cadastro enviado! Aguarde aprovação.");
          navigate('/driver'); // O dashboard vai mostrar "Pendente" se status for PENDING
          
      } catch(e: any) {
          showError(e.message);
      } finally {
          setLoading(false);
      }
  };

  const FileInput = ({ label, onChange, file }: any) => (
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
              if(e.target.files?.[0]) onChange(e.target.files[0]);
          }} />
          {file ? (
              <div className="flex flex-col items-center text-green-600">
                  <Check className="w-8 h-8 mb-2" />
                  <span className="text-xs font-bold truncate w-full">{file.name}</span>
              </div>
          ) : (
              <div className="flex flex-col items-center text-gray-400">
                  <Upload className="w-8 h-8 mb-2" />
                  <span className="text-xs font-bold uppercase">{label}</span>
              </div>
          )}
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-y-auto">
       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070')] bg-cover bg-center opacity-10" />
       
       <div className="w-full max-w-lg relative z-10 py-10">
           {!isSignUp ? (
               // TELA DE LOGIN (Manteve simples)
               <div className="space-y-6">
                   <div className="text-center">
                       <div className="w-16 h-16 bg-yellow-500 rounded-2xl mx-auto mb-4 flex items-center justify-center text-black">
                           <Car className="w-8 h-8" />
                       </div>
                       <h1 className="text-3xl font-black">Área do Parceiro</h1>
                       <p className="text-gray-400">Entre para gerenciar suas corridas.</p>
                   </div>
                   <form onSubmit={handleLogin} className="space-y-4">
                       <Input type="email" placeholder="Email" className="h-14 bg-white/5 border-white/10 text-white rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
                       <Input type="password" placeholder="Senha" className="h-14 bg-white/5 border-white/10 text-white rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
                       <Button className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
                       </Button>
                   </form>
                   <div className="text-center">
                       <button onClick={() => setIsSignUp(true)} className="text-sm font-bold text-yellow-500 hover:underline">Quero ser motorista</button>
                       <div className="mt-4"><button onClick={() => navigate('/')} className="text-xs text-gray-500 hover:text-white flex items-center justify-center gap-1 mx-auto"><ArrowLeft className="w-3 h-3"/> Voltar</button></div>
                   </div>
               </div>
           ) : (
               // TELA DE CADASTRO (3 Etapas)
               <div className="animate-in slide-in-from-right duration-500">
                   <div className="flex items-center gap-2 mb-6">
                       <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step-1) : setIsSignUp(false)} className="text-gray-400 hover:text-white"><ArrowLeft /></Button>
                       <div className="flex-1">
                           <h2 className="text-xl font-bold">Cadastro de Parceiro</h2>
                           <p className="text-xs text-yellow-500 font-bold uppercase tracking-wider">Etapa {step} de 3</p>
                       </div>
                   </div>

                   {/* Progress Bar */}
                   <div className="flex gap-2 mb-8">
                       <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-yellow-500' : 'bg-gray-800'}`} />
                       <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-yellow-500' : 'bg-gray-800'}`} />
                       <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-yellow-500' : 'bg-gray-800'}`} />
                   </div>

                   <Card className="bg-white/5 border-white/10 p-6 backdrop-blur-md rounded-3xl">
                       {step === 1 && (
                           <div className="space-y-4 animate-in fade-in">
                               <h3 className="flex items-center gap-2 font-bold text-lg"><User className="w-5 h-5 text-yellow-500"/> Dados Pessoais</h3>
                               <Input placeholder="Nome Completo" value={fullName} onChange={e=>setFullName(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               <Input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               <Input placeholder="Telefone (WhatsApp)" value={phone} onChange={e=>setPhone(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               <Input placeholder="Criar Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               <Button onClick={handleNextStep} className="w-full h-12 bg-white text-black font-bold rounded-xl mt-4">Próximo <ChevronRight className="w-4 h-4 ml-1"/></Button>
                           </div>
                       )}

                       {step === 2 && (
                           <div className="space-y-4 animate-in fade-in">
                               <h3 className="flex items-center gap-2 font-bold text-lg"><FileText className="w-5 h-5 text-yellow-500"/> Documentação</h3>
                               <Input placeholder="CPF (Somente números)" value={cpf} onChange={e=>setCpf(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               
                               <div className="grid grid-cols-2 gap-3 mt-2">
                                   <div className="col-span-2">
                                       <Label className="text-xs text-gray-400 mb-1 block">Foto do Rosto (Selfie)</Label>
                                       <FileInput label="Carregar Selfie" file={files.face} onChange={(f: File) => setFiles({...files, face: f})} />
                                   </div>
                                   <div>
                                       <Label className="text-xs text-gray-400 mb-1 block">CNH Frente</Label>
                                       <FileInput label="Frente" file={files.cnhFront} onChange={(f: File) => setFiles({...files, cnhFront: f})} />
                                   </div>
                                   <div>
                                       <Label className="text-xs text-gray-400 mb-1 block">CNH Verso</Label>
                                       <FileInput label="Verso" file={files.cnhBack} onChange={(f: File) => setFiles({...files, cnhBack: f})} />
                                   </div>
                               </div>

                               <Button onClick={handleNextStep} className="w-full h-12 bg-white text-black font-bold rounded-xl mt-4">Próximo <ChevronRight className="w-4 h-4 ml-1"/></Button>
                           </div>
                       )}

                       {step === 3 && (
                           <div className="space-y-4 animate-in fade-in">
                               <h3 className="flex items-center gap-2 font-bold text-lg"><Car className="w-5 h-5 text-yellow-500"/> Dados do Veículo</h3>
                               <Input placeholder="Modelo (ex: Onix, HB20)" value={carModel} onChange={e=>setCarModel(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               <Input placeholder="Placa (ex: ABC-1234)" value={carPlate} onChange={e=>setCarPlate(e.target.value.toUpperCase())} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               <div className="grid grid-cols-2 gap-4">
                                   <Input placeholder="Ano" type="number" value={carYear} onChange={e=>setCarYear(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                                   <Input placeholder="Cor" value={carColor} onChange={e=>setCarColor(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl text-white" />
                               </div>

                               <Button onClick={handleRegister} className="w-full h-14 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl mt-6 shadow-lg shadow-yellow-500/20" disabled={loading}>
                                   {loading ? <Loader2 className="animate-spin" /> : "Finalizar Cadastro"}
                               </Button>
                           </div>
                       )}
                   </Card>
               </div>
           )}
       </div>
    </div>
  );
};

export default LoginDriver;