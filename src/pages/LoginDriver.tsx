import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, User, Mail, Lock, Phone, Car, FileText, Calendar, Camera, UploadCloud, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

const LoginDriver = () => {
  const navigate = useNavigate();
  const { loading: authLoading, handleSignIn, handleSignUp, handleResetPassword } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Dados de texto
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carYear, setCarYear] = useState("");
  
  // Documentos
  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);
  const [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [showPwa, setShowPwa] = useState(false);

  const uploadDocument = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars') // Usando o bucket existente
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        if (isSignUp) {
            if (!cnhFront || !cnhBack || !facePhoto) {
                throw new Error("Por favor, envie todos os documentos obrigatórios.");
            }

            // Upload dos arquivos primeiro
            const cnhFrontUrl = await uploadDocument(cnhFront, 'cnh');
            const cnhBackUrl = await uploadDocument(cnhBack, 'cnh');
            const facePhotoUrl = await uploadDocument(facePhoto, 'selfies');

            const success = await handleSignUp(email, password, name, phone, 'driver', {
                car_model: carModel,
                car_plate: carPlate,
                car_year: carYear,
                cnh_front_url: cnhFrontUrl,
                cnh_back_url: cnhBackUrl,
                face_photo_url: facePhotoUrl,
                driver_status: 'PENDING'
            });
            
            if (success) setIsSignUp(false);
        } else {
            await handleSignIn(email, password);
        }
    } catch (err: any) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const FileInput = ({ label, id, onChange, file, icon: Icon }: any) => (
    <div className="space-y-1.5">
        <Label htmlFor={id} className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{label}</Label>
        <div className="relative">
            <input 
                type="file" 
                id={id} 
                accept="image/*" 
                onChange={(e) => onChange(e.target.files?.[0] || null)} 
                className="hidden" 
            />
            <label 
                htmlFor={id} 
                className={`flex items-center gap-3 px-4 h-14 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                    file ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                }`}
            >
                {file ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Icon className="w-5 h-5 text-slate-400" />}
                <span className={`text-sm font-bold truncate ${file ? 'text-green-700' : 'text-slate-500'}`}>
                    {file ? 'Documento Carregado' : 'Selecionar Foto'}
                </span>
                {!file && <UploadCloud className="w-4 h-4 text-slate-300 ml-auto" />}
            </label>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex font-sans">
       <PWAInstallPrompt openForce={showPwa} onCloseForce={() => setShowPwa(false)} />
       
       <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40" />
           <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/80 to-transparent" />
           <div className="relative z-10 px-12 text-center">
                <img src="/app-logo.png" alt="Gold" className="w-64 mb-8 mx-auto rounded-2xl" />
                <h2 className="text-6xl font-black text-white tracking-tighter mb-4">SEJA <span className="text-yellow-500">GOLD</span>.</h2>
                <p className="text-xl text-gray-300 font-light">Taxas justas. Pagamento rápido. Respeito real.</p>
           </div>
       </div>

       <div className="w-full lg:w-1/2 flex flex-col bg-zinc-950 relative overflow-y-auto">
           <div className="p-6 flex items-center lg:absolute lg:top-0 lg:left-0 lg:z-20 lg:w-full">
               <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-zinc-800 text-white rounded-full w-12 h-12 p-0 shrink-0">
                   <ArrowLeft className="w-6 h-6" />
               </Button>
               <img src="/app-logo.png" alt="Gold" className="h-10 ml-4 lg:hidden rounded-lg" />
           </div>

           <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-10">
               <div className="bg-white rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-500 via-zinc-800 to-black" />
                   
                   <div className="mb-8 text-center">
                       <h2 className="text-3xl font-black text-slate-900">{isSignUp ? "Cadastro Motorista" : "Login Motorista"}</h2>
                       <p className="text-gray-500 mt-2 text-sm">{isSignUp ? "Junte-se à nossa frota premium." : "Bem-vindo de volta, parceiro."}</p>
                   </div>

                   <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <>
                                <div className="space-y-4 mb-6">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[2px] flex items-center gap-2">
                                        <User className="w-4 h-4 text-yellow-500" /> Dados Pessoais
                                    </h3>
                                    <div className="relative">
                                        <User className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                        <Input placeholder="Nome Completo" className="h-14 pl-12" value={name} onChange={e => setName(e.target.value)} required />
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                        <Input placeholder="Celular (DDD)" className="h-14 pl-12" value={phone} onChange={e => setPhone(e.target.value)} required />
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[2px] flex items-center gap-2">
                                        <Car className="w-4 h-4 text-yellow-500" /> Dados do Veículo
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative col-span-2">
                                            <Car className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                            <Input placeholder="Modelo Carro (Ex: Onix)" className="h-14 pl-12" value={carModel} onChange={e => setCarModel(e.target.value)} required />
                                        </div>
                                        <div className="relative">
                                            <FileText className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                            <Input placeholder="Placa" className="h-14 pl-12 uppercase" value={carPlate} onChange={e => setCarPlate(e.target.value)} required />
                                        </div>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                            <Input type="number" placeholder="Ano" className="h-14 pl-12" value={carYear} onChange={e => setCarYear(e.target.value)} required />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[2px] flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-yellow-500" /> Documentação
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FileInput label="CNH (Frente)" id="cnh-front" file={cnhFront} onChange={setCnhFront} icon={FileText} />
                                        <FileInput label="CNH (Verso)" id="cnh-back" file={cnhBack} onChange={setCnhBack} icon={FileText} />
                                        <div className="md:col-span-2">
                                            <FileInput label="Foto de Rosto (Selfie)" id="face-photo" file={facePhoto} onChange={setFacePhoto} icon={Camera} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div className="space-y-4">
                            {!isSignUp && <h3 className="text-xs font-black text-slate-900 uppercase tracking-[2px] mb-2">Acesso</h3>}
                            <div className="relative">
                                <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                <Input type="email" placeholder="seu@email.com" className="h-14 pl-12" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            
                            <div className="space-y-2">
                                <div className="relative">
                                    <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                    <Input type="password" placeholder="Sua senha" className="h-14 pl-12" value={password} onChange={e => setPassword(e.target.value)} required />
                                </div>
                                {!isSignUp && (
                                    <div className="text-right mt-1">
                                        <button 
                                            type="button" 
                                            onClick={() => handleResetPassword(email)} 
                                            className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-slate-900 text-white hover:bg-black transition-all mt-4" disabled={loading || authLoading}>
                            {(loading || authLoading) ? <Loader2 className="animate-spin" /> : (isSignUp ? "Enviar Cadastro" : "Acessar Painel")}
                        </Button>
                   </form>

                   <div className="mt-8 text-center">
                        <button 
                            type="button" 
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm font-bold text-slate-900 hover:underline"
                        >
                            {isSignUp ? "Já tenho conta? Entrar" : "Quero ser motorista parceiro"}
                        </button>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginDriver;