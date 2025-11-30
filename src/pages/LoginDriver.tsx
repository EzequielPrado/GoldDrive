import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car, Upload, CheckCircle2, User, FileText, Camera, ShieldCheck, Mail, Lock, Phone, CreditCard } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Login/Dados, 2: Docs, 3: Carro
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Dados Pessoais
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  // Docs (Files)
  const [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);

  // Carro
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carColor, setCarColor] = useState("");
  const [carYear, setCarYear] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return showError("Preencha email e senha");
      setLoading(true);
      try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          const { data: profile } = await supabase.from('profiles').select('role, driver_status').eq('id', data.user.id).single();
          
          if (profile?.role !== 'driver') {
              await supabase.auth.signOut();
              throw new Error("Esta conta não é de motorista.");
          }
          
          navigate('/driver');
      } catch (e: any) {
          showError(e.message);
      } finally {
          setLoading(false);
      }
  };

  const uploadFile = async (file: File, path: string) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${path}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      return data.publicUrl;
  };

  const handleNextStep = async () => {
      if (step === 1) {
          if (!name || !email || !password || !cpf || !phone) return showError("Preencha todos os campos pessoais");
          setStep(2);
      } else if (step === 2) {
          if (!facePhoto || !cnhFront || !cnhBack) return showError("Faça upload de todos os documentos");
          setStep(3);
      } else if (step === 3) {
          if (!carModel || !carPlate || !carColor || !carYear) return showError("Preencha os dados do veículo");
          await submitRegistration();
      }
  };

  const submitRegistration = async () => {
      setLoading(true);
      try {
          // 1. Criar Usuário Auth
          const { data: authData, error: authError } = await supabase.auth.signUp({
              email, password,
              options: { 
                  data: { 
                      role: 'driver', 
                      first_name: name.split(' ')[0], 
                      last_name: name.split(' ').slice(1).join(' ') 
                  } 
              }
          });
          if (authError) throw authError;
          if (!authData.user) throw new Error("Erro ao criar usuário");

          const userId = authData.user.id;

          // 2. Upload Docs
          const faceUrl = await uploadFile(facePhoto!, `face/${userId}`);
          const cnhFrontUrl = await uploadFile(cnhFront!, `cnh/${userId}`);
          const cnhBackUrl = await uploadFile(cnhBack!, `cnh/${userId}`);

          // 3. Atualizar Profile
          const { error: updateError } = await supabase.from('profiles').update({
              cpf,
              phone,
              face_photo_url: faceUrl,
              cnh_front_url: cnhFrontUrl,
              cnh_back_url: cnhBackUrl,
              car_model: carModel,
              car_plate: carPlate.toUpperCase(),
              car_color: carColor,
              car_year: carYear,
              driver_status: 'PENDING'
          }).eq('id', userId);

          if (updateError) throw updateError;

          showSuccess("Cadastro enviado para análise!");
          navigate('/driver'); 

      } catch (e: any) {
          showError("Erro no cadastro: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  // --- RENDER LOGIN VIEW (Split Screen) ---
  if (!isSignUp) {
      return (
        <div className="min-h-screen bg-white flex">
            {/* Esquerda: Imagem e Branding (Desktop) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-black items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070')] bg-cover bg-center opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
                <div className="relative z-10 p-12 text-white max-w-lg">
                    <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mb-6 shadow-glow">
                        <Car className="w-8 h-8 text-black" />
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight">Dirija com a <br/><span className="text-yellow-500">GoldDrive</span></h1>
                    <ul className="space-y-4 text-lg text-gray-300">
                        <li className="flex items-center gap-3"><CheckCircle2 className="text-yellow-500 w-5 h-5"/> Ganhos superiores ao mercado</li>
                        <li className="flex items-center gap-3"><CheckCircle2 className="text-yellow-500 w-5 h-5"/> Pagamento rápido e seguro</li>
                        <li className="flex items-center gap-3"><CheckCircle2 className="text-yellow-500 w-5 h-5"/> Suporte 24 horas</li>
                    </ul>
                </div>
            </div>

            {/* Direita: Formulário */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center p-6 sm:p-12 lg:p-24 bg-gray-50">
                <div className="mb-8">
                     <Button variant="ghost" onClick={() => navigate('/')} className="pl-0 hover:bg-transparent hover:text-yellow-600 mb-4">
                        <ArrowLeft className="mr-2 w-4 h-4" /> Voltar ao início
                     </Button>
                     <h2 className="text-3xl font-black text-slate-900 mb-2">Login Parceiro</h2>
                     <p className="text-slate-500">Digite suas credenciais para acessar o painel.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5 max-w-md w-full">
                    <div className="space-y-1">
                        <Label className="text-slate-900 font-bold">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                            <Input 
                                type="email" 
                                placeholder="motorista@email.com" 
                                className="h-12 pl-12 bg-white border-gray-200 text-slate-900 focus:ring-2 focus:ring-yellow-500 rounded-xl" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                disabled={loading} 
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-slate-900 font-bold">Senha</Label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="h-12 pl-12 bg-white border-gray-200 text-slate-900 focus:ring-2 focus:ring-yellow-500 rounded-xl" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                disabled={loading} 
                            />
                        </div>
                    </div>

                    <Button className="w-full h-14 text-lg font-bold rounded-xl bg-slate-900 hover:bg-black text-white mt-4 shadow-lg transition-transform active:scale-[0.98]" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : "Entrar no Painel"}
                    </Button>
                </form>

                <div className="mt-8 max-w-md w-full text-center border-t border-gray-200 pt-6">
                    <p className="text-slate-600">Ainda não é parceiro?</p>
                    <Button variant="link" onClick={() => setIsSignUp(true)} className="text-yellow-600 font-bold text-base p-0 hover:text-yellow-700">
                        Fazer Cadastro Gratuito
                    </Button>
                </div>
            </div>
        </div>
      );
  }

  // --- RENDER SIGNUP VIEW (Centered Card Step-by-Step) ---
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 lg:p-8 font-sans">
        <Card className="w-full max-w-2xl bg-white shadow-2xl rounded-[32px] overflow-hidden border-0">
            {/* Header com Progresso */}
            <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="ghost" onClick={() => step === 1 ? setIsSignUp(false) : setStep(step - 1)} className="text-white hover:bg-white/10 p-0 w-8 h-8 rounded-full h-auto">
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <span className="font-bold text-yellow-500 tracking-widest text-xs uppercase">ETAPA {step} DE 3</span>
                    </div>
                    
                    <h2 className="text-3xl font-black mb-2">
                        {step === 1 && "Vamos começar"}
                        {step === 2 && "Envio de Documentos"}
                        {step === 3 && "Dados do Veículo"}
                    </h2>
                    <p className="text-slate-400 mb-6">
                        {step === 1 && "Preencha seus dados básicos para criar o acesso."}
                        {step === 2 && "Precisamos validar sua identidade e habilitação."}
                        {step === 3 && "Cadastre o carro que você usará para trabalhar."}
                    </p>

                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-yellow-500 transition-all duration-500 ease-out" 
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            <CardContent className="p-8">
                {/* ETAPA 1: DADOS PESSOAIS */}
                {step === 1 && (
                    <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold">Nome Completo</Label>
                                <div className="relative"><User className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="Ex: João Silva" value={name} onChange={e => setName(e.target.value)} className="h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" /></div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold">CPF</Label>
                                <div className="relative"><ShieldCheck className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} className="h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" /></div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold">Celular / WhatsApp</Label>
                            <div className="relative"><Phone className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} className="h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" /></div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold">Email de Acesso</Label>
                            <div className="relative"><Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" /></div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold">Crie uma Senha</Label>
                            <div className="relative"><Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" /></div>
                        </div>
                    </div>
                )}

                {/* ETAPA 2: DOCUMENTOS */}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
                        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3 text-yellow-800 text-sm">
                            <ShieldCheck className="w-5 h-5 shrink-0" />
                            <p>Suas fotos são armazenadas de forma segura e usadas apenas para validação cadastral.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-slate-800">Foto do Rosto (Selfie)</Label>
                            <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all group ${facePhoto ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-yellow-500 hover:bg-slate-50'}`}>
                                <input type="file" accept="image/*" className="hidden" id="face" onChange={e => setFacePhoto(e.target.files?.[0] || null)} />
                                <label htmlFor="face" className="cursor-pointer w-full h-full block">
                                    {facePhoto ? (
                                        <div className="flex flex-col items-center text-green-700">
                                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2"><CheckCircle2 className="w-6 h-6"/></div>
                                            <span className="font-bold">Foto Carregada</span>
                                            <span className="text-xs opacity-75">{facePhoto.name}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-500 group-hover:text-yellow-600">
                                            <div className="w-12 h-12 bg-slate-100 group-hover:bg-yellow-100 rounded-full flex items-center justify-center mb-2 transition-colors"><Camera className="w-6 h-6"/></div>
                                            <span className="font-medium">Toque para tirar uma selfie</span>
                                            <span className="text-xs opacity-60 mt-1">Sem óculos ou boné</span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-800">CNH Frente</Label>
                                <div className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all h-32 flex items-center justify-center ${cnhFront ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-yellow-500 hover:bg-slate-50'}`}>
                                    <input type="file" accept="image/*" className="hidden" id="cnhf" onChange={e => setCnhFront(e.target.files?.[0] || null)} />
                                    <label htmlFor="cnhf" className="cursor-pointer w-full block">
                                        {cnhFront ? <div className="text-green-700 font-bold flex flex-col items-center"><CheckCircle2 className="mb-1"/> Carregado</div> : <div className="text-slate-400 flex flex-col items-center"><FileText className="mb-1 w-6 h-6"/> Frente</div>}
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-800">CNH Verso</Label>
                                <div className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all h-32 flex items-center justify-center ${cnhBack ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-yellow-500 hover:bg-slate-50'}`}>
                                    <input type="file" accept="image/*" className="hidden" id="cnhb" onChange={e => setCnhBack(e.target.files?.[0] || null)} />
                                    <label htmlFor="cnhb" className="cursor-pointer w-full block">
                                        {cnhBack ? <div className="text-green-700 font-bold flex flex-col items-center"><CheckCircle2 className="mb-1"/> Carregado</div> : <div className="text-slate-400 flex flex-col items-center"><FileText className="mb-1 w-6 h-6"/> Verso</div>}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ETAPA 3: VEÍCULO */}
                {step === 3 && (
                    <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold">Modelo do Carro</Label>
                            <Input placeholder="Ex: Hyundai HB20, Fiat Argo" value={carModel} onChange={e => setCarModel(e.target.value)} className="h-14 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" />
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold">Placa</Label>
                            <div className="relative"><CreditCard className="absolute left-4 top-4 w-5 h-5 text-gray-400"/><Input placeholder="ABC-1234" value={carPlate} onChange={e => setCarPlate(e.target.value.toUpperCase())} className="h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500 uppercase font-mono" /></div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold">Cor</Label>
                                <Input placeholder="Prata, Preto..." value={carColor} onChange={e => setCarColor(e.target.value)} className="h-14 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold">Ano</Label>
                                <Input type="number" placeholder="2020" value={carYear} onChange={e => setCarYear(e.target.value)} className="h-14 bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-yellow-500" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Botão de Ação */}
                <Button 
                    onClick={handleNextStep} 
                    className="w-full h-16 mt-8 text-lg font-bold rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-900/10 transition-transform active:scale-[0.98]" 
                    disabled={loading}
                >
                    {loading ? <Loader2 className="animate-spin w-6 h-6" /> : (
                        <span className="flex items-center gap-2">
                            {step === 3 ? "Finalizar e Enviar" : "Continuar"} <ArrowRight className="w-5 h-5"/>
                        </span>
                    )}
                </Button>
            </CardContent>
        </Card>
    </div>
  );
};

export default LoginDriver;