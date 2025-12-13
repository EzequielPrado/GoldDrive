import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2, LogOut, Smartphone, Calendar, Star, History, Car, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showPWA, setShowPWA] = useState(false);
  
  const [profile, setProfile] = useState<any>({
    id: "", first_name: "", last_name: "", email: "", phone: "", bio: "", avatar_url: "", role: "", created_at: "", car_model: "", car_plate: "", car_color: "", total_rides: 0, rating: 5.0
  });

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
      
      // Contagem real de viagens finalizadas
      const queryField = data.role === 'driver' ? 'driver_id' : 'customer_id';
      const { count } = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq(queryField, user.id)
        .eq('status', 'COMPLETED');

      let avgRating = 5.0;
      if (data.role === 'driver') {
          const { data: rides } = await supabase.from('rides').select('customer_rating').eq('driver_id', user.id).not('customer_rating', 'is', null);
          if (rides && rides.length > 0) {
              avgRating = rides.reduce((a, b) => a + b.customer_rating, 0) / rides.length;
          }
      }

      setProfile({ 
          ...data, 
          email: user.email || "",
          total_rides: count || 0, // Usando a contagem real
          rating: avgRating 
      });
    } catch (error: any) { 
        showError(error.message); 
    } finally { 
        setLoading(false); 
    }
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
    <div className="min-h-screen bg-gray-100 font-sans pb-20 overflow-x-hidden">
      <PWAInstallPrompt openForce={showPWA} onCloseForce={() => setShowPWA(false)} />

      {/* Header / Cover */}
      <div className="h-60 bg-slate-900 w-full relative">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90" />
         
         {/* Top Bar */}
         <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
             <Button variant="ghost" size="icon" className="rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-6 h-6" />
             </Button>
             <div className="text-white font-bold tracking-widest text-xs uppercase opacity-80">Meu Perfil</div>
             <div className="w-10" /> {/* Spacer */}
         </div>
      </div>

      <div className="px-4 -mt-20 relative z-10 max-w-lg mx-auto pb-10">
        
        {/* Card de Identidade */}
        <div className="bg-white rounded-[32px] shadow-xl p-6 pb-8 border border-white/50 relative overflow-visible mb-6">
            
            {/* Avatar Centralizado e Sobreposto */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-full p-1 bg-white shadow-2xl">
                        <Avatar className="w-full h-full rounded-full">
                            <AvatarImage src={profile.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-4xl bg-slate-100 text-slate-400 font-bold">{profile.first_name?.[0]}</AvatarFallback>
                        </Avatar>
                    </div>
                    
                    {/* Botão de Câmera Flutuante */}
                    <Label 
                        htmlFor="avatar-upload" 
                        className="absolute bottom-1 right-1 bg-yellow-500 text-black p-2.5 rounded-full shadow-lg border-[3px] border-white cursor-pointer hover:bg-yellow-400 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center z-20"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    </Label>
                    <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </div>
            </div>

            {/* Nome e Role */}
            <div className="mt-16 text-center">
                <h1 className="text-2xl font-black text-slate-900 leading-tight mb-1">{profile.first_name} {profile.last_name}</h1>
                <div className="flex items-center justify-center gap-2 mb-6">
                    <Badge className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${profile.role === 'driver' ? 'bg-black text-white' : 'bg-blue-600 text-white'}`}>
                        {profile.role === 'driver' ? 'Motorista' : 'Passageiro'}
                    </Badge>
                    {profile.role === 'driver' && (
                        <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-md border border-yellow-200">
                            <Star className="w-3 h-3 fill-yellow-600 text-yellow-600" />
                            <span className="text-xs font-bold text-yellow-800">{profile.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 border-t border-b border-gray-100 py-4">
                    <div className="text-center">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Viagens</p>
                        <p className="font-black text-slate-900 text-lg">{profile.total_rides || 0}</p>
                    </div>
                    <div className="text-center border-l border-r border-gray-100">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Entrou em</p>
                        <p className="font-black text-slate-900 text-lg">{new Date(profile.created_at).getFullYear()}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Status</p>
                        <p className="font-black text-green-600 text-lg flex items-center justify-center gap-1">
                            <ShieldCheck className="w-4 h-4" /> Ativo
                        </p>
                    </div>
                </div>
            </div>

            {/* Informações de Contato (Lista Limpa) */}
            <div className="mt-6 space-y-5">
                <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Nome Completo</p>
                        <p className="font-bold text-slate-900 text-sm">{profile.first_name} {profile.last_name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                        <Phone className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Celular</p>
                        <p className="font-bold text-slate-900 text-sm">{profile.phone || 'Não informado'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                        <Mail className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Email</p>
                        <p className="font-bold text-slate-900 text-sm">{profile.email}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Card do Veículo (Apenas Motorista) */}
        {profile.role === 'driver' && (
            <div className="bg-white rounded-[32px] shadow-lg p-6 mb-6 border border-gray-100">
                <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2 text-lg">
                    <Car className="w-5 h-5 text-yellow-500" /> Meu Veículo
                </h3>
                <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-bold text-slate-900">{profile.car_model}</p>
                        <p className="text-xs text-gray-500">{profile.car_color}</p>
                    </div>
                    <Badge variant="outline" className="bg-white border-slate-200 text-slate-900 font-mono text-sm px-3 py-1">
                        {profile.car_plate}
                    </Badge>
                </div>
            </div>
        )}

        {/* Botões de Ação */}
        <div className="space-y-3">
            <Button 
                onClick={goToHistory} 
                className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold shadow-xl shadow-slate-200 flex items-center justify-between px-6 group"
            >
                <span className="flex items-center gap-3"><History className="w-5 h-5 text-yellow-500" /> Ver Minhas Corridas</span>
                <div className="bg-white/10 p-1 rounded-full group-hover:translate-x-1 transition-transform">
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                </div>
            </Button>

            <Button 
                onClick={() => setShowPWA(true)} 
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-black shadow-lg shadow-yellow-500/20 flex items-center gap-2"
            >
                <Smartphone className="w-5 h-5" /> BAIXAR APLICATIVO
            </Button>

            <Button 
                onClick={handleLogout} 
                variant="ghost"
                className="w-full h-12 rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-700 font-bold mt-2"
            >
                <LogOut className="mr-2 w-4 h-4" /> Sair da Conta
            </Button>
        </div>
        
        <p className="text-center text-[10px] text-gray-300 mt-8 font-medium tracking-widest uppercase">Gold Mobile &copy; 2024</p>
      </div>
    </div>
  );
};

export default Profile;