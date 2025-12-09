import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2, Edit2, Save, X, Smartphone, MapPin, Calendar, Star, History, LogOut, Car, Mail, Phone } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPWA, setShowPWA] = useState(false);
  
  const [profile, setProfile] = useState<any>({
    id: "", first_name: "", last_name: "", email: "", phone: "", bio: "", avatar_url: "", role: "", created_at: "", car_model: "", car_plate: "", car_color: "", total_rides: 0, rating: 5.0
  });

  // Backup para cancelar edição e reverter dados
  const [originalProfile, setOriginalProfile] = useState<any>(null);

  useEffect(() => { getProfile(); }, []);

  const getProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
          navigate('/login');
          return;
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      
      // Calcular rating se for motorista
      let avgRating = 5.0;
      if (data.role === 'driver') {
          const { data: rides } = await supabase.from('rides').select('customer_rating').eq('driver_id', user.id).not('customer_rating', 'is', null);
          if (rides && rides.length > 0) {
              avgRating = rides.reduce((a, b) => a + b.customer_rating, 0) / rides.length;
          }
      }

      const finalData = { 
          ...data, 
          email: user.email || "",
          rating: avgRating 
      };
      
      setProfile(finalData);
      setOriginalProfile(finalData);
    } catch (error: any) { 
        showError(error.message); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
          first_name: profile.first_name, 
          last_name: profile.last_name, 
          phone: profile.phone, 
          bio: profile.bio,
          car_model: profile.car_model, // Caso motorista edite
          car_plate: profile.car_plate,
          car_color: profile.car_color,
          updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      
      if (error) throw error;
      
      showSuccess("Perfil atualizado!");
      setOriginalProfile(profile);
      setIsEditing(false);
    } catch (error: any) { 
        showError(error.message); 
    } finally { 
        setSaving(false); 
    }
  };

  const handleCancel = () => {
      // Reverte para os dados originais
      setProfile(originalProfile);
      setIsEditing(false);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      setUploading(true);
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      
      setProfile({ ...profile, avatar_url: data.publicUrl });
      setOriginalProfile({ ...originalProfile, avatar_url: data.publicUrl });
      showSuccess("Foto atualizada!");
      
    } catch (error: any) {
      showError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const goToHistory = () => {
      if (profile.role === 'driver') navigate('/driver?tab=history');
      else navigate('/client?tab=history');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin w-10 h-10 text-yellow-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 relative overflow-x-hidden">
      <PWAInstallPrompt openForce={showPWA} onCloseForce={() => setShowPWA(false)} />

      {/* Header com Capa Estilo Rede Social */}
      <div className="h-64 bg-slate-900 w-full relative">
         <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black" />
         {/* Padrão decorativo */}
         <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#ffffff_1px,transparent_0)] bg-[length:20px_20px]" />
         
         <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
             <Button variant="secondary" size="icon" className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md h-10 w-10" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
             </Button>
             
             {!isEditing ? (
                 <Button onClick={() => setIsEditing(true)} className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md gap-2 h-10 px-4 font-semibold">
                     <Edit2 className="w-4 h-4" /> Editar Perfil
                 </Button>
             ) : (
                 <div className="flex gap-2">
                     <Button onClick={handleCancel} className="rounded-full bg-red-500/80 hover:bg-red-600 text-white border-0 backdrop-blur-md h-10 w-10 p-0" size="icon">
                         <X className="w-5 h-5" />
                     </Button>
                     <Button onClick={handleUpdate} disabled={saving} className="rounded-full bg-green-500 hover:bg-green-600 text-white border-0 backdrop-blur-md gap-2 h-10 px-4 font-bold">
                         {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <><Save className="w-4 h-4" /> Salvar</>}
                     </Button>
                 </div>
             )}
         </div>
      </div>

      <div className="px-4 -mt-24 relative z-10 max-w-xl mx-auto pb-10">
        {/* Card Principal */}
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden">
            
            {/* Seção do Avatar e Infos Principais */}
            <div className="pt-0 pb-6 px-6 text-center border-b border-gray-100">
                <div className="relative inline-block -mt-16 mb-4">
                    <Avatar className="w-32 h-32 border-[6px] border-white shadow-xl bg-white">
                        <AvatarImage src={profile.avatar_url} className="object-cover" />
                        <AvatarFallback className="text-4xl bg-yellow-500 text-black font-black">{profile.first_name[0]}</AvatarFallback>
                    </Avatar>
                    {isEditing && (
                        <>
                            <Label htmlFor="avatar-upload" className="absolute bottom-1 right-1 bg-blue-600 text-white p-2.5 rounded-full shadow-lg border-4 border-white cursor-pointer hover:bg-blue-700 transition-all active:scale-95">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            </Label>
                            <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                        </>
                    )}
                </div>

                <h1 className="text-3xl font-black text-slate-900 leading-tight mb-1">{profile.first_name} {profile.last_name}</h1>
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${profile.role === 'driver' ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                        {profile.role === 'driver' ? 'Motorista Parceiro' : 'Passageiro VIP'}
                    </Badge>
                    {profile.role === 'driver' && (
                        <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            <span className="text-xs font-bold text-slate-900">{profile.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                    <div className="bg-gray-50 p-3 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</p>
                        <p className="font-bold text-slate-900 flex items-center justify-center gap-1"><Calendar className="w-3 h-3 text-slate-400"/> {new Date(profile.created_at).getFullYear()}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors" onClick={goToHistory}>
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Viagens</p>
                        <p className="font-bold text-slate-900 flex items-center justify-center gap-1"><History className="w-3 h-3 text-slate-400"/> {profile.total_rides || 0}</p>
                    </div>
                </div>
            </div>

            {/* Conteúdo / Formulário */}
            <div className="p-6 space-y-6">
                
                {/* Inputs Pessoais */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-6 bg-yellow-500 rounded-full"/>
                        <h3 className="font-bold text-lg text-slate-900">Dados Pessoais</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Nome</Label>
                            <Input 
                                value={profile.first_name} 
                                onChange={(e) => setProfile({...profile, first_name: e.target.value})} 
                                disabled={!isEditing}
                                className={`h-12 rounded-xl transition-all ${isEditing ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-gray-50 border-transparent text-slate-600'}`} 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Sobrenome</Label>
                            <Input 
                                value={profile.last_name} 
                                onChange={(e) => setProfile({...profile, last_name: e.target.value})} 
                                disabled={!isEditing}
                                className={`h-12 rounded-xl transition-all ${isEditing ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-gray-50 border-transparent text-slate-600'}`} 
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-400 uppercase ml-1 flex items-center gap-1"><Phone className="w-3 h-3"/> Telefone / WhatsApp</Label>
                        <Input 
                            value={profile.phone} 
                            onChange={(e) => setProfile({...profile, phone: e.target.value})} 
                            disabled={!isEditing}
                            className={`h-12 rounded-xl transition-all ${isEditing ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-gray-50 border-transparent text-slate-600'}`} 
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-400 uppercase ml-1 flex items-center gap-1"><Mail className="w-3 h-3"/> Email</Label>
                        <Input 
                            value={profile.email} 
                            disabled
                            className="h-12 bg-gray-100 border-transparent text-gray-400 rounded-xl cursor-not-allowed font-medium" 
                        />
                    </div>
                </div>

                {/* Seção Veículo (Só para motorista) */}
                {profile.role === 'driver' && (
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-6 bg-slate-900 rounded-full"/>
                            <h3 className="font-bold text-lg text-slate-900">Veículo</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Modelo</Label>
                                <Input 
                                    value={profile.car_model} 
                                    onChange={(e) => setProfile({...profile, car_model: e.target.value})} 
                                    disabled={!isEditing}
                                    className={`h-12 rounded-xl transition-all ${isEditing ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'bg-gray-50 border-transparent text-slate-600 font-medium'}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Cor</Label>
                                <Input 
                                    value={profile.car_color} 
                                    onChange={(e) => setProfile({...profile, car_color: e.target.value})} 
                                    disabled={!isEditing}
                                    className={`h-12 rounded-xl transition-all ${isEditing ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'bg-gray-50 border-transparent text-slate-600 font-medium'}`}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-400 uppercase ml-1">Placa</Label>
                            <Input 
                                value={profile.car_plate} 
                                onChange={(e) => setProfile({...profile, car_plate: e.target.value})} 
                                disabled={!isEditing}
                                className={`h-12 rounded-xl uppercase font-mono tracking-wider transition-all ${isEditing ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'bg-gray-50 border-transparent text-slate-600 font-bold'}`}
                            />
                        </div>
                    </div>
                )}

                {/* Botões de Ação */}
                <div className="pt-6 space-y-3">
                    <Button 
                        onClick={goToHistory} 
                        className="w-full h-14 rounded-2xl bg-white border-2 border-gray-100 hover:bg-gray-50 text-slate-900 font-bold shadow-sm"
                    >
                        <History className="mr-2 w-5 h-5 text-slate-400" /> Ver Minhas Corridas
                    </Button>

                    <Button 
                        onClick={() => setShowPWA(true)} 
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-black shadow-lg shadow-yellow-500/20"
                    >
                        <Smartphone className="mr-2 w-5 h-5" /> BAIXAR APLICATIVO
                    </Button>

                    <Button 
                        onClick={handleLogout} 
                        variant="ghost"
                        className="w-full h-12 rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-700 font-bold mt-4"
                    >
                        <LogOut className="mr-2 w-4 h-4" /> Sair da Conta
                    </Button>
                </div>
            </div>
        </div>
        
        <p className="text-center text-xs text-gray-400 mt-8 font-medium">Gold Mobile v1.0.0</p>
      </div>
    </div>
  );
};

export default Profile;