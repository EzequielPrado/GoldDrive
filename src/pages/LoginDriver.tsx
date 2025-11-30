import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Loader2, Camera, FileText, Car, Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const LoginDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
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
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    setPhone(value);
  };

  const redirectUserByRole = (role: string, driverStatus?: string) => {
      switch(role) {
          case 'driver': 
              if (driverStatus === 'PENDING') navigate('/success', { replace: true });
              else navigate('/driver', { replace: true });
              break;
          case 'admin': navigate('/admin', { replace: true }); break;
          default: navigate('/client', { replace: true });
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (!email || !password) return showError("Preencha email e senha");
      
      setLoading(true);
      
      try {
          const { data, error } = await supabase.auth.signInWithPassword({ 
              email: email.trim(), 
              password: password.trim() 
          });
          
          if (error) throw error;
          if (!data.user) throw new Error("Usuário não encontrado.");

          const { data: profile } = await supabase
            .from('profiles')
            .select('role, driver_status')
            .eq('id', data.user.id)
            .maybeSingle();
            
          const role = profile?.role || 'client'; 
          redirectUserByRole(role, profile?.driver_status);

      } catch (e: any) {
          console.error("Erro login motorista:", e);
          let msg = e.message || "Erro no login";
          if (msg.includes("Invalid login")) msg = "Email ou senha incorretos.";
          showError(msg);
      } finally {
          setLoading(false);
      }
  };

  const uploadFileSafe = async (file: File, path: string) => {
      if (!file) return "";
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2,9)}.${fileExt}`;
          const filePath = `${path}/${fileName}`;
          
          await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
          const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
          return data.publicUrl;
      } catch {
          return "";
      }
  };

  const handleNextStep = async () => {
      let isValid = true;
      const newErrors: Record<string, boolean> = {};

      if (step === 1) {
          if (!name) newErrors.name = true;
          if (!email) newErrors.email = true;
          if (!password) newErrors.password = true;
          if (password !== confirmPassword) { showError("Senhas não conferem"); isValid = false; }
          if (cpf.length < 14) newErrors.cpf = true;
      } else if (step === 2) {
          if (!facePhoto) newErrors.facePhoto = true;
          if (!cnhFront) newErrors.cnhFront = true;
      } else if (step === 3) {
          if (!carModel) newErrors.carModel = true;
          if (!carPlate) newErrors.carPlate = true;
      }

      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          isValid = false;
          showError("Verifique os campos obrigatórios");
      }

      if (isValid) {
          if (step < 3) setStep(step + 1);
          else await submitRegistration();
      }
  };

  const submitRegistration = async () => {
      if (loading) return;
      setLoading(true);

      try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
              email: email.trim(),
              password: password.trim(),
              options: { 
                  data: { 
                      role: 'driver', 
                      first_name: name.split(' ')[0], 
                      last_name: name.split(' ').slice(1).join(' ') 
                  } 
              }
          });

          let userId = authData?.user?.id;

          if (authError) {
              if (authError.message.includes("already registered")) {
                   const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
                   if (loginData.user) userId = loginData.user.id;
                   else throw authError;
              } else {
                  throw authError;
              }
          }

          if (!userId) throw new Error("Erro ao criar usuário. Tente novamente.");

          const [faceUrl, cnhFrontUrl, cnhBackUrl] = await Promise.all([
             uploadFileSafe(facePhoto!, `face/${userId}`),
             uploadFileSafe(cnhFront!, `cnh/${userId}`),
             uploadFileSafe(cnhBack!, `cnh/${userId}`)
          ]);

          const { error: profileError } = await supabase.from('profiles').upsert({
              id: userId,
              role: 'driver',
              first_name: name.split(' ')[0],
              last_name: name.split(' ').slice(1).join(' '),
              cpf,
              phone,
              car_model: carModel,
              car_plate: carPlate.toUpperCase(),
              car_color: carColor,
              car_year: carYear,
              face_photo_url: faceUrl,
              cnh_front_url: cnhFrontUrl,
              cnh_back_url: cnhBackUrl,
              driver_status: 'PENDING',
              updated_at: new Date().toISOString()
          });

          if (profileError) {
              console.error("Erro ao salvar perfil:", profileError);
          }

          navigate('/success', { replace: true });

      } catch (e: any) {
          console.error(e);
          showError(e.message || "Erro no cadastro");
      } finally {
          setLoading(false);
      }
  };

  if (!isSignUp) {
      return (
        <div className="min-h-screen relative flex items-center justify-center font-sans overflow-hidden bg-slate-900">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070')] bg-cover bg-center opacity-40" />
            <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row h-full lg:h-auto min-h-screen lg:min-h-[600px] lg:rounded-[32px] lg:overflow-hidden lg:shadow-2xl lg:bg-white animate-in fade-in zoom-in-95 duration-500">
                <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center text-white lg:bg-slate-900/90 relative">
                     <div className="relative z-10 text-center lg:text-left">
                        <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mb-6 shadow-glow mx-auto lg:mx-0"><Car className="w-8 h-8 text-black" /></div>
                        <h1 className="text-4xl lg:text-5xl font-black mb-4">Gold<span className="text-yellow-500">Drive</span></h1>
                        <p className="text-lg text-gray-300">A plataforma definitiva para motoristas.</p>
                     </div>
                </div>
                <div className="flex-1 bg-white p-8 lg:p-12 flex flex-col justify-center">
                    <div className="mb-8">
                         <Button variant="ghost" onClick={() => navigate('/')} className="pl-0 hover:bg-transparent text-slate-500 mb-2"><ArrowLeft className="mr-2 w-4 h-4" /> Voltar</Button>
                         <h2 className="text-3xl font-black text-slate-900">Login Parceiro</h2>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12" placeholder="seu@email.com"/></div>
                        <div className="space-y-1"><Label>Senha</Label><div className="relative"><Input type={showPassword?"text":"password"} value={password} onChange={e => setPassword(e.target.value)} className="h-12 pr-10" placeholder="••••••"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400"><Eye className="w-5 h-5"/></button></div></div>
                        <Button type="submit" className="w-full h-14 font-bold bg-slate-900 text-white rounded-xl mt-4" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Acessar Painel"}</Button>
                    </form>
                    <div className="mt-8 text-center pt-6 border-t border-gray-100"><Button variant="outline" onClick={() => setIsSignUp(true)} className="w-full h-12 font-bold rounded-xl">Criar Cadastro Gratuito</Button></div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8 font-sans overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2583')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900/90 to-slate-900/80" />

        <Card className="w-full max-w-2xl bg-white/95 backdrop-blur-xl shadow-2xl rounded-[32px] overflow-hidden border-0 relative z-10 animate-in slide-in-from-bottom-10">
            <div className="bg-slate-900 p-8 text-white relative">
                <div className="flex justify-between items-center mb-6">
                    <Button variant="ghost" onClick={() => step === 1 ? setIsSignUp(false) : setStep(step - 1)} className="text-white hover:bg-white/10 p-0 w-8 h-8 rounded-full h-auto"><ArrowLeft className="w-6 h-6" /></Button>
                    <span className="font-bold text-yellow-500 tracking-widest text-xs uppercase bg-yellow-500/10 px-3 py-1 rounded-full">ETAPA {step} / 3</span>
                </div>
                <h2 className="text-3xl font-black mb-2">{step === 1 ? "Seus Dados" : step === 2 ? "Documentação" : "Seu Veículo"}</h2>
                <div className="h-1.5 w-full bg-slate-800 rounded-full mt-4"><div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}/></div>
            </div>

            <CardContent className="p-6 lg:p-10">
                {step === 1 && (
                    <div className="space-y-5 animate-in slide-in-from-right fade-in">
                        <div className="grid md:grid-cols-2 gap-4"><div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} className={errors.name ? "border-red-500" : ""} placeholder="Nome Completo"/></div><div className="space-y-1"><Label>CPF</Label><Input value={cpf} onChange={handleCpfChange} maxLength={14} className={errors.cpf ? "border-red-500" : ""} placeholder="000.000.000-00"/></div></div>
                        <div className="space-y-1"><Label>Celular</Label><Input value={phone} onChange={handlePhoneChange} maxLength={15} className={errors.phone ? "border-red-500" : ""} placeholder="(11) 99999-9999"/></div>
                        <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className={errors.email ? "border-red-500" : ""} placeholder="email@exemplo.com"/></div>
                        <div className="grid md:grid-cols-2 gap-4"><div className="space-y-1"><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className={errors.password ? "border-red-500" : ""} placeholder="Senha"/></div><div className="space-y-1"><Label>Confirmar</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={errors.confirmPassword ? "border-red-500" : ""} placeholder="Repita a senha"/></div></div>
                    </div>
                )}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right fade-in">
                        <div className="space-y-2"><Label>Selfie</Label><div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors ${facePhoto ? 'border-green-500 bg-green-50' : 'border-gray-200'}`} onClick={()=>document.getElementById('face')?.click()}><input type="file" accept="image/*" className="hidden" id="face" onChange={e => setFacePhoto(e.target.files?.[0]||null)} /><div className="flex flex-col items-center gap-2"><Camera className={facePhoto ? "text-green-500" : "text-gray-400"} /><span className="font-medium text-sm">{facePhoto ? "Foto Carregada!" : "Toque para tirar foto"}</span></div></div></div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>CNH Frente</Label><div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors ${cnhFront ? 'border-green-500 bg-green-50' : 'border-gray-200'}`} onClick={()=>document.getElementById('cnhf')?.click()}><input type="file" accept="image/*" className="hidden" id="cnhf" onChange={e => setCnhFront(e.target.files?.[0]||null)} /><div className="flex flex-col items-center gap-2"><FileText className={cnhFront ? "text-green-500" : "text-gray-400"} /><span className="font-medium text-sm">{cnhFront ? "Frente OK" : "Enviar Frente"}</span></div></div></div>
                            <div className="space-y-2"><Label>CNH Verso</Label><div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors ${cnhBack ? 'border-green-500 bg-green-50' : 'border-gray-200'}`} onClick={()=>document.getElementById('cnhb')?.click()}><input type="file" accept="image/*" className="hidden" id="cnhb" onChange={e => setCnhBack(e.target.files?.[0]||null)} /><div className="flex flex-col items-center gap-2"><FileText className={cnhBack ? "text-green-500" : "text-gray-400"} /><span className="font-medium text-sm">{cnhBack ? "Verso OK" : "Enviar Verso"}</span></div></div></div>
                        </div>
                    </div>
                )}
                {step === 3 && (
                    <div className="space-y-5 animate-in slide-in-from-right fade-in">
                        <div className="space-y-1"><Label>Modelo</Label><Input value={carModel} onChange={e => setCarModel(e.target.value)} className={errors.carModel ? "border-red-500" : ""} placeholder="Ex: Onix 2020"/></div>
                        <div className="space-y-1"><Label>Placa</Label><Input value={carPlate} onChange={e => setCarPlate(e.target.value.toUpperCase())} className={errors.carPlate ? "border-red-500 uppercase" : "uppercase"} placeholder="ABC-1234"/></div>
                        <div className="grid md:grid-cols-2 gap-4"><div className="space-y-1"><Label>Cor</Label><Input value={carColor} onChange={e => setCarColor(e.target.value)} className={errors.carColor ? "border-red-500" : ""} placeholder="Prata"/></div><div className="space-y-1"><Label>Ano</Label><Input type="number" value={carYear} onChange={e => setCarYear(e.target.value)} className={errors.carYear ? "border-red-500" : ""} placeholder="2020"/></div></div>
                    </div>
                )}
                <Button onClick={handleNextStep} disabled={loading} className="w-full h-16 mt-8 text-lg font-bold rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl transition-all active:scale-[0.98]">
                    {loading ? <Loader2 className="animate-spin" /> : (step === 3 ? "Finalizar Cadastro" : "Continuar")}
                </Button>
            </CardContent>
        </Card>
    </div>
  );
};

export default LoginDriver;