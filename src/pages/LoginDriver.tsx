import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car, Upload, CheckCircle2, User, FileText, Camera } from "lucide-react";

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // SignUp Wizard State
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
      firstName: "", lastName: "", email: "", password: "",
      cpf: "", carModel: "", carPlate: "", carYear: "", carColor: ""
  });
  const [files, setFiles] = useState<{face: File|null, cnhFront: File|null, cnhBack: File|null}>({
      face: null, cnhFront: null, cnhBack: null
  });

  useEffect(() => {
    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
            if (data?.role === 'driver') navigate('/driver');
            else if (data) {
                await supabase.auth.signOut();
                showError("Área exclusiva para motoristas.");
            }
        }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!email || !password) return showError("Preencha todos os campos");
      setLoading(true);
      try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if(error) throw error;
          
          const { data: { user } } = await supabase.auth.getUser();
          if(user) {
              const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
              if(data?.role !== 'driver') {
                  await supabase.auth.signOut();
                  throw new Error("Você não tem perfil de motorista.");
              }
              navigate('/driver');
          }
      } catch(e: any) { showError(e.message); } 
      finally { setLoading(false); }
  };

  const handleSignUp = async () => {
      setLoading(true);
      try {
          // 1. Criar Usuário
          const { data: authData, error: authError } = await supabase.auth.signUp({
              email: formData.email,
              password: formData.password,
              options: {
                  data: {
                      role: 'driver',
                      first_name: formData.firstName,
                      last_name: formData.lastName,
                      driver_status: 'PENDING' // Importante para KYC
                  }
              }
          });

          if(authError) throw authError;
          if(!authData.user) throw new Error("Erro ao criar usuário");

          const userId = authData.user.id;

          // 2. Upload Arquivos
          const uploadFile = async (file: File, path: string) => {
              const ext = file.name.split('.').pop();
              const filePath = `${userId}/${path}.${ext}`;
              const { error } = await supabase.storage.from('driver-docs').upload(filePath, file);
              if(error) { console.error("Upload error", error); return null; }
              const { data } = supabase.storage.from('driver-docs').getPublicUrl(filePath);
              return data.publicUrl;
          };

          const faceUrl = files.face ? await uploadFile(files.face, 'face') : null;
          const cnhFrontUrl = files.cnhFront ? await uploadFile(files.cnhFront, 'cnh_front') : null;
          const cnhBackUrl = files.cnhBack ? await uploadFile(files.cnhBack, 'cnh_back') : null;

          // 3. Atualizar Perfil com Dados do Carro e Docs
          const { error: profileError } = await supabase.from('profiles').update({
              cpf: formData.cpf,
              car_model: formData.carModel,
              car_plate: formData.carPlate,
              car_year: formData.carYear,
              car_color: formData.carColor,
              face_photo_url: faceUrl,
              cnh_front_url: cnhFrontUrl,
              cnh_back_url: cnhBackUrl,
              driver_status: 'PENDING'
          }).eq('id', userId);

          if(profileError) throw profileError;

          showSuccess("Cadastro recebido! Aguarde aprovação.");
          // Opcional: fazer login automático ou pedir para logar
          setIsSignUp(false);
          setEmail(formData.email);
      } catch(e: any) { showError(e.message); }
      finally { setLoading(false); }
  };

  // Render Functions
  const renderStep1 = () => (
      <div className="space-y-4 animate-in slide-in-from-right">
          <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Nome" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
              <Input placeholder="Sobrenome" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
          </div>
          <Input placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
          <Input placeholder="Senha" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
          <Button className="w-full h-12 bg-yellow-500 text-black hover:bg-yellow-400 font-bold" onClick={() => {
              if(!formData.firstName || !formData.email || !formData.password) return showError("Preencha tudo");
              setStep(2);
          }}>Próximo <ArrowRight className="ml-2 w-4 h-4" /></Button>
      </div>
  );

  const renderStep2 = () => (
      <div className="space-y-4 animate-in slide-in-from-right">
          <Input placeholder="CPF (apenas números)" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800 mb-4" />
          
          <div className="space-y-3">
              <Label>Foto do Rosto (Selfie)</Label>
              <div className="border border-dashed border-zinc-700 rounded-xl p-4 text-center cursor-pointer hover:bg-zinc-900 relative">
                  <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles({...files, face: e.target.files?.[0] || null})} />
                  {files.face ? <span className="text-green-500 flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> Foto carregada</span> : <span className="text-zinc-500 flex items-center justify-center gap-2"><Camera className="w-4 h-4"/> Tirar foto</span>}
              </div>
          </div>
          <div className="space-y-3">
              <Label>CNH (Frente)</Label>
              <div className="border border-dashed border-zinc-700 rounded-xl p-4 text-center cursor-pointer hover:bg-zinc-900 relative">
                   <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles({...files, cnhFront: e.target.files?.[0] || null})} />
                   {files.cnhFront ? <span className="text-green-500 flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> CNH Frente OK</span> : <span className="text-zinc-500 flex items-center justify-center gap-2"><FileText className="w-4 h-4"/> Carregar imagem</span>}
              </div>
          </div>
          <div className="space-y-3">
              <Label>CNH (Verso)</Label>
              <div className="border border-dashed border-zinc-700 rounded-xl p-4 text-center cursor-pointer hover:bg-zinc-900 relative">
                   <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFiles({...files, cnhBack: e.target.files?.[0] || null})} />
                   {files.cnhBack ? <span className="text-green-500 flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> CNH Verso OK</span> : <span className="text-zinc-500 flex items-center justify-center gap-2"><FileText className="w-4 h-4"/> Carregar imagem</span>}
              </div>
          </div>

          <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1 bg-yellow-500 text-black hover:bg-yellow-400 font-bold" onClick={() => {
                  if(!formData.cpf || !files.face || !files.cnhFront) return showError("Documentos obrigatórios");
                  setStep(3);
              }}>Próximo <ArrowRight className="ml-2 w-4 h-4" /></Button>
          </div>
      </div>
  );

  const renderStep3 = () => (
      <div className="space-y-4 animate-in slide-in-from-right">
          <Input placeholder="Modelo do Carro (ex: Onix)" value={formData.carModel} onChange={e => setFormData({...formData, carModel: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
          <Input placeholder="Placa (ex: ABC-1234)" value={formData.carPlate} onChange={e => setFormData({...formData, carPlate: e.target.value.toUpperCase()})} className="h-12 bg-zinc-900 border-zinc-800" />
          <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Ano" type="number" value={formData.carYear} onChange={e => setFormData({...formData, carYear: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
              <Input placeholder="Cor" value={formData.carColor} onChange={e => setFormData({...formData, carColor: e.target.value})} className="h-12 bg-zinc-900 border-zinc-800" />
          </div>
          <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={() => setStep(2)}>Voltar</Button>
              <Button className="flex-[2] bg-green-600 text-white hover:bg-green-500 font-bold" onClick={handleSignUp} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Finalizar Cadastro"}
              </Button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden font-sans">
       <div className="p-6 z-10 flex justify-between items-center">
           <Button variant="ghost" onClick={() => navigate('/')} className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0">
               <ArrowLeft className="w-6 h-6" />
           </Button>
           {isSignUp && (
               <div className="flex gap-1">
                   <div className={`h-2 w-8 rounded-full ${step >= 1 ? 'bg-yellow-500' : 'bg-zinc-800'}`} />
                   <div className={`h-2 w-8 rounded-full ${step >= 2 ? 'bg-yellow-500' : 'bg-zinc-800'}`} />
                   <div className={`h-2 w-8 rounded-full ${step >= 3 ? 'bg-yellow-500' : 'bg-zinc-800'}`} />
               </div>
           )}
       </div>

       <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full z-10 pb-20">
           <div className="mb-8">
               <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center mb-4 text-black shadow-lg shadow-yellow-500/20">
                   <Car className="w-6 h-6" />
               </div>
               <h1 className="text-3xl font-bold tracking-tight mb-2">
                   {isSignUp ? 
                     (step === 1 ? "Dados Pessoais" : step === 2 ? "Documentação" : "Seu Veículo") 
                     : "Portal do Motorista"}
               </h1>
               <p className="text-zinc-400">
                   {isSignUp ? "Etapa " + step + " de 3" : "Gerencie seus ganhos e corridas."}
               </p>
           </div>

           {!isSignUp ? (
               <div className="space-y-4 animate-in fade-in">
                   <Input type="email" placeholder="Email" className="h-12 bg-zinc-900 border-zinc-800 text-white" value={email} onChange={e => setEmail(e.target.value)} />
                   <Input type="password" placeholder="Senha" className="h-12 bg-zinc-900 border-zinc-800 text-white" value={password} onChange={e => setPassword(e.target.value)} />
                   <Button className="w-full h-12 text-lg font-bold rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black mt-2" onClick={handleLogin} disabled={loading}>
                       {loading ? <Loader2 className="animate-spin" /> : "Acessar Painel"}
                   </Button>
                   <div className="text-center mt-6">
                       <button onClick={() => setIsSignUp(true)} className="text-yellow-500 hover:text-yellow-400 font-bold text-sm">Quero me cadastrar</button>
                   </div>
               </div>
           ) : (
               <>
                   {step === 1 && renderStep1()}
                   {step === 2 && renderStep2()}
                   {step === 3 && renderStep3()}
                   <div className="text-center mt-6">
                       <button onClick={() => {setIsSignUp(false); setStep(1);}} className="text-zinc-500 hover:text-white text-sm">Já tenho conta</button>
                   </div>
               </>
           )}
       </div>
    </div>
  );
};

export default LoginDriver;