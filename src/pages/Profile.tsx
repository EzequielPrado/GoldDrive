import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2, Shield, Upload } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profile, setProfile] = useState({
    id: "", first_name: "", last_name: "", email: "", phone: "", bio: "", avatar_url: "", role: ""
  });

  useEffect(() => { getProfile(); }, []);

  const getProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      setProfile({ ...data, email: user.email || "", phone: data.phone || "", bio: data.bio || "", avatar_url: data.avatar_url || "" });
    } catch (error: any) { showError(error.message); } finally { setLoading(false); }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
          first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone, bio: profile.bio, avatar_url: profile.avatar_url, updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      if (error) throw error;
      showSuccess("Perfil atualizado!");
    } catch (error: any) { showError(error.message); } finally { setSaving(false); }
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
      setProfile({ ...profile, avatar_url: data.publicUrl });
      showSuccess("Imagem carregada!");
      
    } catch (error: any) {
      showError(error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin w-10 h-10 text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20 relative overflow-x-hidden">
      {/* Header Image / Cover */}
      <div className="h-64 bg-slate-900 w-full relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 to-slate-900" />
         <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070')] bg-cover bg-center" />
         
         <Button variant="secondary" size="icon" className="absolute top-6 left-6 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md z-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
         </Button>
      </div>

      <div className="px-6 -mt-20 relative z-10 max-w-2xl mx-auto pb-10">
        {/* Card Principal */}
        <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-[40px] shadow-2xl p-8 text-center animate-in slide-in-from-bottom duration-500">
            
            {/* Avatar Section */}
            <div className="relative inline-block mb-6 group">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl ring-4 ring-gray-50/50">
                    <AvatarImage src={profile.avatar_url} className="object-cover" />
                    <AvatarFallback className="text-4xl bg-yellow-500 text-black font-bold">{profile.first_name[0]}</AvatarFallback>
                </Avatar>
                
                <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-black text-white p-3 rounded-full shadow-lg border-4 border-white cursor-pointer hover:bg-yellow-500 hover:text-black transition-all hover:scale-110">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </Label>
                <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </div>

            <h1 className="text-3xl font-black text-slate-900 mb-1">{profile.first_name} {profile.last_name}</h1>
            <div className="flex items-center justify-center gap-2 mb-8">
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1 border border-yellow-200">
                    <Shield className="w-3 h-3" /> {profile.role === 'client' ? 'Passageiro Gold' : profile.role === 'driver' ? 'Motorista Parceiro' : 'Admin'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="space-y-2">
                    <Label className="font-bold text-slate-700 ml-1">Nome</Label>
                    <Input value={profile.first_name} onChange={(e) => setProfile({...profile, first_name: e.target.value})} className="h-12 bg-gray-50 border-0 focus:ring-2 focus:ring-yellow-500/20 rounded-2xl font-medium" />
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-slate-700 ml-1">Sobrenome</Label>
                    <Input value={profile.last_name} onChange={(e) => setProfile({...profile, last_name: e.target.value})} className="h-12 bg-gray-50 border-0 focus:ring-2 focus:ring-yellow-500/20 rounded-2xl font-medium" />
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-slate-700 ml-1">Telefone</Label>
                    <Input value={profile.phone} onChange={(e) => setProfile({...profile, phone: e.target.value})} className="h-12 bg-gray-50 border-0 focus:ring-2 focus:ring-yellow-500/20 rounded-2xl font-medium" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-gray-400 ml-1">Email</Label>
                    <Input value={profile.email} disabled className="h-12 bg-gray-100 border-0 rounded-2xl text-gray-500 font-medium" />
                </div>
            </div>

            <Button onClick={handleUpdate} disabled={saving} className="w-full h-14 mt-8 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold text-lg shadow-xl shadow-black/10 transition-transform active:scale-[0.98]">
                {saving ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
            </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;