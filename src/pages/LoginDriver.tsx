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
  const [step, setStep] = useState(1);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Dados
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  
  // Arquivos
  const [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);

  // Carro
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carColor, setCarColor] = useState("");
  const [carYear, setCarYear] = useState("");

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setCpf(value);
    setErrors(prev => ({ ...prev, cpf: false }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    setPhone(value);
    setErrors(prev => ({ ...prev, phone: false }));
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return showError("Preencha email e senha");
      setLoading(true);
      try {
          const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
          if (error) throw error;
          
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
          if (profile?.role === 'driver') navigate('/driver');
          else if (profile?.role === 'admin') navigate('/admin');
          else navigate('/client');
      } catch (e: any) {
          showError(e.message || "Erro no login");
      } finally {
          setLoading(false);
      }
  };

  const uploadFileSafe = async (file: File, path: string) => {
      if (!file) return null;
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2,9)}.${fileExt}`;
          const filePath = `${path}/${fileName}`;
          
          const { error } = await supabase.storage.from('documents').upload(filePath, file);
          if (error) return null; // Falha silenciosa para não travar cadastro
          
          const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
          return data.publicUrl;
      } catch {
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
          if (password !== confirmPassword) { showError("As senhas não coincidem"); isValid = false; }
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
          showError("Verifique os campos obrigatórios");
      }

      if (!isValid) return;
      if (step < 3) setStep(step + 1);
      else await submitRegistration();
  };

  const submitRegistration = async () => {
      if (loading) return;
      setLoading(true);

      // Timeout de segurança: Se travar por 15s, libera erro
      const timeoutId = setTimeout(() => {
          if (loading) {
              setLoading(false);
              showError("Tempo limite excedido. Tente novamente.");
          }
      }, 15000);

      try {
          // 1. TENTA CRIAR USUÁRIO (METADADOS SÃO A GARANTIA PRINCIPAL)
          const metaData = {
              role: 'driver',
              first_name: name.split(' ')[0],
              last_name: name.split(' ').slice(1).join(' '),
              phone,
              cpf,
              car_model: carModel,
              car_plate: carPlate.toUpperCase(),
              car_color: carColor,
              car_year: carYear
          };

          const { data: authData, error: authError } = await supabase.auth.signUp({
              email: email.trim(),
              password: password.trim(),
              options: { data: metaData }
          });

          let userId = authData?.user?.id;

          // Se deu erro de "já existe", tenta logar para atualizar dados
          if (authError) {
              if (authError.message.includes("already registered") || authError.status === 422) {
                  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ 
                      email: email.trim(), 
                      password: password.trim() 
                  });
                  if (loginError) throw new Error("Email já cadastrado. Tente fazer login.");
                  userId = loginData.user?.id;
              } else {
                  throw authError;
              }
          }

          if (!userId) {
              clearTimeout(timeoutId);
              setLoading(false);
              showSuccess("Verifique seu email para confirmar.");
              return;
          }

          // 2. UPLOAD EM BACKGROUND (Não trava a UI se falhar)
          // Tenta subir arquivos. Se falhar, salva string vazia.
          const [faceUrl, cnhFrontUrl, cnhBackUrl] = await Promise.all([
             uploadFileSafe(facePhoto!, `face/${userId}`),
             uploadFileSafe(cnhFront!, `cnh/${userId}`),
             uploadFileSafe(cnhBack!, `cnh/${userId}`)
          ]);

          // 3. UPSERT FINAL (Garante persistência mesmo se trigger falhar)
          await supabase.from('profiles').upsert({
              id: userId,
              role: 'driver',
              email: email.trim(),
              first_name: metaData.first_name,
              last_name: metaData.last_name,
              cpf: metaData.cpf,
              phone: metaData.phone,
              car_model: metaData.car_model,
              car_plate: metaData.car_plate,
              car_color: metaData.car_color,
              car_year: metaData.car_year,
              face_photo_url: faceUrl || "",
              cnh_front_url: cnhFrontUrl || "",
              cnh_back_url: cnhBackUrl || "",
              driver_status: 'PENDING',
              updated_at: new Date().toISOString()
          });

          clearTimeout(timeoutId);
          setRegistrationSuccess(true);
          window.scrollTo(0, 0);

      } catch (e: any) {
          clearTimeout(timeoutId);
          console.error(e);
          showError(e.message || "Erro ao salvar.");
      } finally {
          setLoading(false);
      }
  };

  if (registrationSuccess) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
              <Card className="w-full max-w-md bg-white border-0 shadow-2xl rounded-[32px] overflow-hidden animate-in zoom-in">
                  <div className="bg-yellow-500 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                           <Clock className="w-10 h-10 text-white animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900">Cadastro Enviado!</h2>
                      <p className="text-slate-800 font-medium opacity-90">Em Análise</p>
                  </div>
                  <CardContent className="p-8 text-center space-y-6">
                      <p className="text-gray-600">Seus dados foram salvos com sucesso. Nossa equipe irá analisar sua documentação.</p>
                      <Button onClick={() => navigate('/')} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold">Voltar ao Início</Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8 font-sans overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2583')] bg-cover bg-center opacity-20" />
        
        <Card className="w-full max-w-2xl bg-white/95 backdrop-blur-xl shadow-2xl rounded-[32px] overflow-hidden border-0 relative z-10 animate-in slide-in-from-bottom-5">
            <div className="bg-slate-900 p-8 text-white relative">
                <div className="flex justify-between items-center mb-6">
                    <Button variant="ghost" onClick={() => step === 1 ? setIsSignUp(false) : setStep(step - 1)} className="text-white hover:bg-white/10 p-0 w-8 h-8 rounded-full h-auto"><ArrowLeft className="w-6 h-6" /></Button>
                    <span className="font-bold text-yellow-500 tracking-widest text-xs uppercase bg-yellow-500/10 px-3 py-1 rounded-full">ETAPA {step} / 3</span>
                </div>
                <h2 className="text-3xl font-black mb-2">{step === 1 ? "Seus Dados" : step === 2 ? "Documentação" : "Seu Veículo"}</h2>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-4"><div className="h-full bg-yellow-500 transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }}/></div>
            </div>

            <CardContent className="p-6 lg:p-10">
                {!isSignUp ? (
                    <div className="space-y-6">
                         <h2 className="text-2xl font-black text-center mb-4">Bem-vindo Motorista</h2>
                         <div className="space-y-4">
                            <div className="space-y-1"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="h-12" placeholder="seu@email.com"/></div>
                            <div className="space-y-1"><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-12" placeholder="••••••"/></div>
                         </div>
                         <Button onClick={handleLogin} disabled={loading} className="w-full h-14 text-lg font-bold bg-slate-900 text-white rounded-xl mt-4">{loading ? <Loader2 className="animate-spin"/> : "Entrar"}</Button>
                         <Button variant="outline" onClick={() => setIsSignUp(true)} className="w-full h-14 font-bold rounded-xl mt-2">Criar Cadastro</Button>
                    </div>
                ) : (
                    <>
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="space-y-1"><Label>Nome Completo</Label><Input value={name} onChange={e => setName(e.target.value)} className={errors.name ? "border-red-500" : ""} placeholder="Nome Sobrenome"/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>CPF</Label><Input value={cpf} onChange={handleCpfChange} maxLength={14} className={errors.cpf ? "border-red-500" : ""} placeholder="000.000.000-00"/></div>
                                    <div className="space-y-1"><Label>Celular</Label><Input value={phone} onChange={handlePhoneChange} maxLength={15} className={errors.phone ? "border-red-500" : ""} placeholder="(11) 99999-9999"/></div>
                                </div>
                                <div className="space-y-1"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} className={errors.email ? "border-red-500" : ""} type="email" placeholder="email@exemplo.com"/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Senha</Label><Input value={password} onChange={e => setPassword(e.target.value)} className={errors.password ? "border-red-500" : ""} type="password" placeholder="Min 6 caracteres"/></div>
                                    <div className="space-y-1"><Label>Confirmar</Label><Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={errors.confirmPassword ? "border-red-500" : ""} type="password" placeholder="Repita a senha"/></div>
                                </div>
                            </div>
                        )}
                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="space-y-2"><Label>Selfie</Label><div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer ${facePhoto ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}><input type="file" onChange={e => setFacePhoto(e.target.files?.[0]||null)} className="hidden" id="face"/><label htmlFor="face" className="block w-full cursor-pointer">{facePhoto ? "Foto OK" : "Tirar Foto"}</label></div></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>CNH Frente</Label><div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer ${cnhFront ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}><input type="file" onChange={e => setCnhFront(e.target.files?.[0]||null)} className="hidden" id="cnhf"/><label htmlFor="cnhf" className="block w-full cursor-pointer">{cnhFront ? "Frente OK" : "Enviar"}</label></div></div>
                                    <div className="space-y-2"><Label>CNH Verso</Label><div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer ${cnhBack ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}><input type="file" onChange={e => setCnhBack(e.target.files?.[0]||null)} className="hidden" id="cnhb"/><label htmlFor="cnhb" className="block w-full cursor-pointer">{cnhBack ? "Verso OK" : "Enviar"}</label></div></div>
                                </div>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="space-y-1"><Label>Modelo do Carro</Label><Input value={carModel} onChange={e => setCarModel(e.target.value)} className={errors.carModel ? "border-red-500" : ""} placeholder="Ex: Onix 2020"/></div>
                                <div className="space-y-1"><Label>Placa</Label><Input value={carPlate} onChange={e => setCarPlate(e.target.value.toUpperCase())} className={errors.carPlate ? "border-red-500 uppercase" : "uppercase"} placeholder="ABC-1234"/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Cor</Label><Input value={carColor} onChange={e => setCarColor(e.target.value)} className={errors.carColor ? "border-red-500" : ""} placeholder="Prata"/></div>
                                    <div className="space-y-1"><Label>Ano</Label><Input type="number" value={carYear} onChange={e => setCarYear(e.target.value)} className={errors.carYear ? "border-red-500" : ""} placeholder="2020"/></div>
                                </div>
                            </div>
                        )}
                        <Button onClick={handleNextStep} disabled={loading} className="w-full h-14 text-lg font-bold bg-slate-900 text-white rounded-xl mt-6">
                            {loading ? <Loader2 className="animate-spin" /> : (step === 3 ? "Finalizar Cadastro" : "Continuar")}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    </div>
  );
};

export default LoginDriver;