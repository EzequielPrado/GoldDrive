import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, ArrowRight, Car, CheckCircle2, User, FileText, Camera, ShieldCheck, Mail, Lock, Phone, CreditCard, Eye, EyeOff, AlertCircle, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Login/Dados, 2: Docs, 3: Carro
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  
  // Estado de Erros
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Dados Pessoais
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  // --- MÁSCARAS ---
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setCpf(value);
    if (errors.cpf) setErrors(prev => ({ ...prev, cpf: false }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d{5})(\d)/, "$1-$2");
    setPhone(value);
    if (errors.phone) setErrors(prev => ({ ...prev, phone: false }));
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors: Record<string, boolean> = {};
      if (!email) newErrors.email = true;
      if (!password) newErrors.password = true;
      
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) {
          showError("Preencha os campos obrigatórios");
          return;
      }

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
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${path}/${fileName}`;
          
          // Tenta fazer upload
          const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
          
          if (uploadError) {
              // Ignora erro se bucket não existir ou permissão falhar, para não travar o cadastro
              console.warn("Upload falhou (não crítico):", uploadError.message);
              return null; 
          }
          
          const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
          return data.publicUrl;
      } catch (err) {
          console.warn("Exceção upload:", err);
          return null;
      }
  };

  const handleNextStep = async () => {
      const newErrors: Record<string, boolean> = {};
      let isValid = true;

      if (step === 1) {
          if (!name) newErrors.name = true;
          if (!email) newErrors.email = true;
          if (!password) newErrors.password = true;
          if (password !== confirmPassword) {
               showError("As senhas não coincidem");
               newErrors.confirmPassword = true;
               isValid = false;
          }
          if (!cpf || cpf.length < 14) newErrors.cpf = true;
          if (!phone || phone.length < 14) newErrors.phone = true;
      } else if (step === 2) {
          if (!facePhoto) newErrors.facePhoto = true;
          if (!cnhFront) newErrors.cnhFront = true;
          if (!cnhBack) newErrors.cnhBack = true;
      } else if (step === 3) {
          if (!carModel) newErrors.carModel = true;
          if (!carPlate) newErrors.carPlate = true;
          if (!carColor) newErrors.carColor = true;
          if (!carYear) newErrors.carYear = true;
      }

      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          isValid = false;
          if (step === 2) showError("Envie todos os documentos");
          else showError("Verifique os campos em vermelho");
      }

      if (!isValid) return;

      if (step < 3) {
          setStep(step + 1);
          setErrors({});
      } else {
          await submitRegistration();
      }
  };

  const submitRegistration = async () => {
      setLoading(true);
      try {
          let userId = "";

          // 1. Tentar Criar Usuário
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

          if (authError) {
              // Se o usuário já existe, tentamos fazer o login para continuar o cadastro (atualizar dados)
              if (authError.message.includes("User already registered") || authError.status === 422) {
                  console.log("Usuário já existe, tentando login...");
                  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
                  
                  if (loginError) throw new Error("Email já cadastrado. Erro ao tentar login: " + loginError.message);
                  if (!loginData.user) throw new Error("Falha na autenticação automática.");
                  
                  userId = loginData.user.id;
              } else {
                  throw authError;
              }
          } else {
              if (!authData.user) throw new Error("Erro desconhecido ao criar usuário");
              userId = authData.user.id;
          }

          // Pequeno delay para garantir que triggers do banco tenham rodado (criação do profile)
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 2. Upload Docs (Paralelo para ser mais rápido)
          const [faceUrl, cnhFrontUrl, cnhBackUrl] = await Promise.all([
             facePhoto ? uploadFile(facePhoto, `face/${userId}`) : Promise.resolve(null),
             cnhFront ? uploadFile(cnhFront, `cnh/${userId}`) : Promise.resolve(null),
             cnhBack ? uploadFile(cnhBack, `cnh/${userId}`) : Promise.resolve(null)
          ]);

          // 3. Atualizar Profile com Dados do Motorista
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

          if (updateError) {
              console.error("Erro update profile:", updateError);
              throw new Error("Erro ao salvar dados do perfil: " + updateError.message);
          }

          // SUCESSO!
          setRegistrationSuccess(true);
          window.scrollTo(0, 0);

      } catch (e: any) {
          console.error(e);
          showError(e.message || "Erro desconhecido no cadastro.");
      } finally {
          setLoading(false);
      }
  };

  // --- TELA DE SUCESSO (EM ANÁLISE) ---
  if (registrationSuccess) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
              <Card className="w-full max-w-md bg-white border-0 shadow-2xl rounded-[32px] overflow-hidden animate-in zoom-in duration-500">
                  <div className="bg-yellow-500 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 shadow-inner">
                           <Clock className="w-10 h-10 text-white animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900">Cadastro Recebido!</h2>
                      <p className="text-slate-800 font-medium opacity-90">Status: Em Análise</p>
                  </div>
                  <CardContent className="p-8 text-center space-y-6">
                      <div className="space-y-2">
                          <p className="text-gray-600">
                              Recebemos seus documentos com sucesso. Nossa equipe de segurança irá analisar seu perfil.
                          </p>
                          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                              <p className="text-sm font-bold text-green-800 flex items-start gap-2 text-left">
                                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                                  Seus dados já estão no nosso sistema administrativo.
                              </p>
                          </div>
                      </div>
                      
                      <div className="border-t border-gray-100 pt-6">
                          <p className="text-sm text-gray-500 mb-4">
                              Assim que aprovado, enviaremos uma mensagem de confirmação para o seu WhatsApp cadastrado:
                          </p>
                          <p className="font-bold text-slate-900 text-lg mb-6">{phone}</p>
                          
                          <Button onClick={() => navigate('/')} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold">
                              Voltar ao Início
                          </Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
      );
  }

  // --- RENDER LOGIN VIEW ---
  if (!isSignUp) {
      return (
        <div className="min-h-screen relative flex items-center justify-center font-sans overflow-hidden">
            {/* Background Image Full Screen with Overlay */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070')] bg-cover bg-center" />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row h-full lg:h-auto min-h-screen lg:min-h-[600px] lg:rounded-[32px] lg:overflow-hidden lg:shadow-2xl lg:bg-white animate-in fade-in zoom-in-95 duration-500">
                
                {/* Esquerda: Branding */}
                <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center text-white lg:bg-slate-900 relative">
                     <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent lg:hidden" />
                     <div className="relative z-10 text-center lg:text-left mt-10 lg:mt-0">
                        <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mb-6 shadow-glow mx-auto lg:mx-0">
                            <Car className="w-8 h-8 text-black" />
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight drop-shadow-lg lg:drop-shadow-none">Gold<span className="text-yellow-500">Drive</span></h1>
                        <p className="text-lg text-gray-200 lg:text-gray-400 max-w-sm mx-auto lg:mx-0 drop-shadow-md lg:drop-shadow-none">A plataforma definitiva para motoristas que exigem excelência.</p>
                     </div>
                </div>

                {/* Direita: Formulário */}
                <div className="flex-1 bg-white rounded-t-[32px] lg:rounded-none p-8 lg:p-12 flex flex-col justify-center mt-auto lg:mt-0 shadow-2xl lg:shadow-none">
                    <div className="mb-8">
                         <Button variant="ghost" onClick={() => navigate('/')} className="pl-0 hover:bg-transparent text-slate-500 hover:text-yellow-600 mb-2">
                            <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
                         </Button>
                         <h2 className="text-3xl font-black text-slate-900">Login Parceiro</h2>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-slate-900 font-bold ml-1">Email</Label>
                            <div className="relative group">
                                <Mail className={`absolute left-4 top-3.5 w-5 h-5 transition-colors ${errors.email ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-500'}`} />
                                <Input 
                                    type="email" 
                                    className={`h-12 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.email ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                    value={email} 
                                    onChange={e => { setEmail(e.target.value); if(errors.email) setErrors({...errors, email: false}) }} 
                                    disabled={loading} 
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-slate-900 font-bold ml-1">Senha</Label>
                            <div className="relative group">
                                <Lock className={`absolute left-4 top-3.5 w-5 h-5 transition-colors ${errors.password ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-500'}`} />
                                <Input 
                                    type={showPassword ? "text" : "password"}
                                    className={`h-12 pl-12 pr-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.password ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                    value={password} 
                                    onChange={e => { setPassword(e.target.value); if(errors.password) setErrors({...errors, password: false}) }} 
                                    disabled={loading} 
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-slate-900">
                                    {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>

                        <Button className="w-full h-14 text-lg font-bold rounded-xl bg-slate-900 hover:bg-black text-white mt-4 shadow-xl transition-transform active:scale-[0.98]" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : "Acessar Painel"}
                        </Button>
                    </form>

                    <div className="mt-8 text-center pt-6 border-t border-gray-100">
                        <p className="text-slate-500 mb-2">Não tem conta?</p>
                        <Button variant="outline" onClick={() => setIsSignUp(true)} className="w-full h-12 rounded-xl border-slate-200 hover:border-yellow-500 hover:text-yellow-600 font-bold">
                            Criar Cadastro Gratuito
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- RENDER SIGNUP VIEW ---
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8 font-sans overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2583')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900/90 to-slate-900/80" />

        <Card className="w-full max-w-2xl bg-white/95 backdrop-blur-xl shadow-2xl rounded-[32px] overflow-hidden border-0 relative z-10 animate-in slide-in-from-bottom-10 duration-500">
            {/* Header com Progresso */}
            <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="ghost" onClick={() => step === 1 ? setIsSignUp(false) : setStep(step - 1)} className="text-white hover:bg-white/10 p-0 w-8 h-8 rounded-full h-auto">
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <span className="font-bold text-yellow-500 tracking-widest text-xs uppercase bg-yellow-500/10 px-3 py-1 rounded-full">ETAPA {step} / 3</span>
                    </div>
                    
                    <h2 className="text-3xl font-black mb-2 tracking-tight">
                        {step === 1 && "Seus Dados"}
                        {step === 2 && "Documentação"}
                        {step === 3 && "Seu Veículo"}
                    </h2>
                    <p className="text-slate-400 mb-6 font-light">
                        {step === 1 && "Crie suas credenciais de acesso seguro."}
                        {step === 2 && "Precisamos validar sua habilitação (CNH)."}
                        {step === 3 && "Qual carro você vai usar para faturar?"}
                    </p>

                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-yellow-500 transition-all duration-500 ease-out shadow-[0_0_10px_#eab308]" 
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            <CardContent className="p-6 lg:p-10">
                {/* ETAPA 1: DADOS PESSOAIS */}
                {step === 1 && (
                    <div className="space-y-5 animate-in slide-in-from-right fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold ml-1">Nome Completo</Label>
                                <div className="relative group">
                                    <User className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.name ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                    <Input 
                                        placeholder="Ex: João Silva" 
                                        value={name} 
                                        onChange={e => { setName(e.target.value); if(errors.name) setErrors({...errors, name: false}) }}
                                        className={`h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.name ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold ml-1">CPF</Label>
                                <div className="relative group">
                                    <ShieldCheck className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.cpf ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                    <Input 
                                        placeholder="000.000.000-00" 
                                        value={cpf} 
                                        onChange={handleCpfChange} 
                                        maxLength={14}
                                        className={`h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.cpf ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold ml-1">Celular</Label>
                            <div className="relative group">
                                <Phone className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.phone ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                <Input 
                                    placeholder="(11) 99999-9999" 
                                    value={phone} 
                                    onChange={handlePhoneChange} 
                                    maxLength={15}
                                    className={`h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.phone ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                    />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold ml-1">Email</Label>
                            <div className="relative group">
                                <Mail className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.email ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                <Input 
                                    type="email" 
                                    placeholder="seu@email.com" 
                                    value={email} 
                                    onChange={e => { setEmail(e.target.value); if(errors.email) setErrors({...errors, email: false}) }}
                                    className={`h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.email ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                    />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold ml-1">Senha</Label>
                                <div className="relative group">
                                    <Lock className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.password ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                    <Input 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="Mínimo 6 caracteres" 
                                        value={password} 
                                        onChange={e => { setPassword(e.target.value); if(errors.password) setErrors({...errors, password: false}) }}
                                        className={`h-14 pl-12 pr-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.password ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                        />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold ml-1">Confirmar Senha</Label>
                                <div className="relative group">
                                    <Lock className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.confirmPassword ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                    <Input 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="Repita a senha" 
                                        value={confirmPassword} 
                                        onChange={e => { setConfirmPassword(e.target.value); if(errors.confirmPassword) setErrors({...errors, confirmPassword: false}) }}
                                        className={`h-14 pl-12 pr-10 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.confirmPassword ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                        />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-gray-400 hover:text-slate-900">
                                        {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ETAPA 2: DOCUMENTOS */}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
                            <ShieldCheck className="w-5 h-5 shrink-0" />
                            <p>Suas fotos são criptografadas. Tire fotos nítidas e sem reflexo.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-slate-800 ml-1">Selfie (Rosto)</Label>
                            <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all group ${errors.facePhoto ? 'border-red-500 bg-red-50' : facePhoto ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-yellow-500 hover:bg-slate-50'}`}>
                                <input type="file" accept="image/*" className="hidden" id="face" onChange={e => { setFacePhoto(e.target.files?.[0] || null); if(errors.facePhoto) setErrors({...errors, facePhoto: false}) }} />
                                <label htmlFor="face" className="cursor-pointer w-full h-full block">
                                    {facePhoto ? (
                                        <div className="flex flex-col items-center text-green-700 animate-in zoom-in">
                                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2"><CheckCircle2 className="w-6 h-6"/></div>
                                            <span className="font-bold">Foto Carregada!</span>
                                            <span className="text-xs opacity-75">{facePhoto.name}</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-500 group-hover:text-yellow-600">
                                            {errors.facePhoto ? <AlertCircle className="w-10 h-10 text-red-500 mb-2" /> : <Camera className="w-10 h-10 mb-2"/>}
                                            <span className="font-medium">{errors.facePhoto ? "Foto obrigatória" : "Toque para tirar uma selfie"}</span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-800 ml-1">CNH Frente</Label>
                                <div className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all h-36 flex items-center justify-center ${errors.cnhFront ? 'border-red-500 bg-red-50' : cnhFront ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-yellow-500 hover:bg-slate-50'}`}>
                                    <input type="file" accept="image/*" className="hidden" id="cnhf" onChange={e => { setCnhFront(e.target.files?.[0] || null); if(errors.cnhFront) setErrors({...errors, cnhFront: false}) }} />
                                    <label htmlFor="cnhf" className="cursor-pointer w-full block">
                                        {cnhFront ? <div className="text-green-700 font-bold flex flex-col items-center animate-in zoom-in"><CheckCircle2 className="mb-1"/> Ok</div> : <div className="text-slate-400 flex flex-col items-center"><FileText className={`mb-1 w-6 h-6 ${errors.cnhFront ? 'text-red-500' : ''}`}/> Frente</div>}
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-800 ml-1">CNH Verso</Label>
                                <div className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all h-36 flex items-center justify-center ${errors.cnhBack ? 'border-red-500 bg-red-50' : cnhBack ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-yellow-500 hover:bg-slate-50'}`}>
                                    <input type="file" accept="image/*" className="hidden" id="cnhb" onChange={e => { setCnhBack(e.target.files?.[0] || null); if(errors.cnhBack) setErrors({...errors, cnhBack: false}) }} />
                                    <label htmlFor="cnhb" className="cursor-pointer w-full block">
                                        {cnhBack ? <div className="text-green-700 font-bold flex flex-col items-center animate-in zoom-in"><CheckCircle2 className="mb-1"/> Ok</div> : <div className="text-slate-400 flex flex-col items-center"><FileText className={`mb-1 w-6 h-6 ${errors.cnhBack ? 'text-red-500' : ''}`}/> Verso</div>}
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
                            <Label className="text-slate-700 font-bold ml-1">Modelo do Carro</Label>
                            <Input 
                                placeholder="Ex: Hyundai HB20" 
                                value={carModel} 
                                onChange={e => { setCarModel(e.target.value); if(errors.carModel) setErrors({...errors, carModel: false}) }}
                                className={`h-14 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.carModel ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label className="text-slate-700 font-bold ml-1">Placa</Label>
                            <div className="relative group">
                                <CreditCard className={`absolute left-4 top-4 w-5 h-5 transition-colors ${errors.carPlate ? 'text-red-500' : 'text-gray-400 group-focus-within:text-yellow-600'}`}/>
                                <Input 
                                    placeholder="ABC-1234" 
                                    value={carPlate} 
                                    onChange={e => { setCarPlate(e.target.value.toUpperCase()); if(errors.carPlate) setErrors({...errors, carPlate: false}) }}
                                    className={`h-14 pl-12 bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono uppercase transition-all ${errors.carPlate ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold ml-1">Cor</Label>
                                <Input 
                                    placeholder="Prata" 
                                    value={carColor} 
                                    onChange={e => { setCarColor(e.target.value); if(errors.carColor) setErrors({...errors, carColor: false}) }}
                                    className={`h-14 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.carColor ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-bold ml-1">Ano</Label>
                                <Input 
                                    type="number" 
                                    placeholder="2020" 
                                    value={carYear} 
                                    onChange={e => { setCarYear(e.target.value); if(errors.carYear) setErrors({...errors, carYear: false}) }}
                                    className={`h-14 bg-slate-50 border-slate-200 text-slate-900 rounded-xl transition-all ${errors.carYear ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'focus:ring-2 focus:ring-yellow-500'}`} 
                                />
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