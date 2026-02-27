import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Mail, Lock, User, KeyRound, Car, MapPin, Shield, Loader2, Smartphone } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("client");
  const [showPwaHelp, setShowPwaHelp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const getThemeColor = () => {
    switch(activeTab) {
        case 'driver': return 'bg-yellow-500 hover:bg-yellow-600 ring-yellow-500 text-black';
        case 'admin': return 'bg-slate-900 hover:bg-slate-800 ring-slate-900';
        default: return 'bg-black hover:bg-zinc-800 ring-black';
    }
  };

  const getRoleName = () => {
    switch(activeTab) {
        case 'driver': return 'Motorista';
        case 'admin': return 'Administrador';
        default: return 'Passageiro';
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email, password,
                options: { data: { role: activeTab, full_name: fullName } }
            });
            if (error) throw error;
            showSuccess("Conta criada! Verifique seu email.");
            setIsSignUp(false);
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
            const role = profile?.role || 'client';
            if (role === 'admin') navigate('/admin');
            else if (role === 'driver') navigate('/driver');
            else navigate('/client');
        }
    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 relative overflow-hidden">
      <PWAInstallPrompt openForce={showPwaHelp} onCloseForce={() => setShowPwaHelp(false)} />
      <div className={`absolute top-0 left-0 right-0 h-1/2 transition-colors duration-500 ease-in-out -z-10 ${
          activeTab === 'driver' ? 'bg-yellow-500' : activeTab === 'admin' ? 'bg-slate-900' : 'bg-black'
      }`} />
      <div className="mb-8 text-center text-white z-10 flex flex-col items-center">
        <img src="/app-logo.jpg" alt="Gold Mobile" className="w-48 h-auto mb-2 drop-shadow-lg rounded-xl" />
        <p className="opacity-90">Sua plataforma premium de mobilidade</p>
      </div>
      <Card className="w-full max-w-md z-10 shadow-xl border-0">
        <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{isSignUp ? "Criar Nova Conta" : "Acessar Plataforma"}</CardTitle>
            <CardDescription>Selecione seu tipo de perfil abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-xl">
              <TabsTrigger value="client">Passageiro</TabsTrigger>
              <TabsTrigger value="driver">Motorista</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
            <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && <div className="space-y-2"><Label>Nome Completo</Label><Input placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>}
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className={`w-full h-12 mt-4 font-bold shadow-md ${getThemeColor()}`} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? `Cadastrar` : `Entrar`)}
                </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;