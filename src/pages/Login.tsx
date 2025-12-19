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
  
  // Controle manual do PWA Popup
  const [showPwaHelp, setShowPwaHelp] = useState(false);
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  // Mode States
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Cores dinâmicas baseadas no perfil
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

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    resetForm();
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      showError("Digite seu email para recuperar a senha.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/update-password',
      });
      if (error) throw error;
      showSuccess("Email enviado! Verifique sua caixa de entrada.");
      setIsForgotPassword(false);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        if (isSignUp) {
            // Validações
            if (!email || !password || !fullName) throw new Error("Preencha todos os campos.");
            if (password !== confirmPassword) throw new Error("As senhas não coincidem.");
            if (password.length < 6) throw new Error("Senha muito curta (mínimo 6 caracteres).");

            const nameParts = fullName.trim().split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(" ") || "";

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: activeTab,
                        first_name: firstName,
                        last_name: lastName,
                        full_name: fullName
                    }
                }
            });
            if (error) throw error;
            showSuccess("Conta criada! Verifique seu email.");
            setIsSignUp(false);
        } else {
            // Login
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            if (!data.user) throw new Error("Erro ao autenticar");

            // Buscar role correta no banco
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();
            
            const role = profile?.role || 'client';
            
            // Redirecionar baseado na role real
            if (role === 'admin') navigate('/admin');
            else if (role === 'driver') navigate('/driver');
            else navigate('/client');
        }
    } catch (e: any) {
        if (e.message.includes("Invalid login")) {
            showError("Email ou senha incorretos.");
        } else {
            showError(e.message);
        }
    } finally {
        setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
           <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                 <Button variant="ghost" size="icon" onClick={() => setIsForgotPassword(false)} className="-ml-2">
                    <ArrowLeft className="w-5 h-5" />
                 </Button>
                 <CardTitle>Recuperar Senha</CardTitle>
              </div>
              <CardDescription>Enviaremos um link para o seu email.</CardDescription>
           </CardHeader>
           <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                      <Label>Email Cadastrado</Label>
                      <Input 
                          type="email" 
                          placeholder="ex: joao@email.com" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={loading}
                      />
                  </div>
                  <Button type="submit" className="w-full bg-black hover:bg-zinc-800" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Email"}
                  </Button>
              </form>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 relative overflow-hidden">
      
      {/* Componente de Instalação (Automático + Manual via Botão) */}
      <PWAInstallPrompt openForce={showPwaHelp} onCloseForce={() => setShowPwaHelp(false)} />

      {/* Background Decorativo */}
      <div className={`absolute top-0 left-0 right-0 h-1/2 transition-colors duration-500 ease-in-out -z-10 ${
          activeTab === 'driver' ? 'bg-yellow-500' : activeTab === 'admin' ? 'bg-slate-900' : 'bg-black'
      }`} />
      
      <div className="mb-8 text-center text-white z-10 flex flex-col items-center">
        <img src="/logo-goldmobile-2.png" alt="Gold Mobile" className="w-48 h-auto mb-2 drop-shadow-lg" />
        <p className="opacity-90">Sua plataforma premium de mobilidade</p>
      </div>

      <Card className="w-full max-w-md z-10 shadow-xl border-0">
        <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
                {isSignUp ? "Criar Nova Conta" : "Acessar Plataforma"}
            </CardTitle>
            <CardDescription>
                Selecione seu tipo de perfil abaixo
            </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-xl">
              <TabsTrigger value="client" className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm rounded-lg transition-all">
                <div className="flex flex-col items-center gap-1 py-1">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-medium">Passageiro</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="driver" className="data-[state=active]:bg-white data-[state=active]:text-yellow-600 data-[state=active]:shadow-sm rounded-lg transition-all">
                <div className="flex flex-col items-center gap-1 py-1">
                    <Car className="w-4 h-4" />
                    <span className="text-xs font-medium">Motorista</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all">
                <div className="flex flex-col items-center gap-1 py-1">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-medium">Admin</span>
                </div>
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                        <Label>Nome Completo</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Seu nome" 
                                className="pl-9 bg-gray-50 focus:bg-white transition-colors"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                        type="email" 
                        placeholder="seu@email.com" 
                        className="pl-9 bg-gray-50 focus:bg-white transition-colors"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Senha</Label>
                    {!isSignUp && (
                        <span 
                            className="text-xs text-black cursor-pointer hover:underline font-medium"
                            onClick={() => setIsForgotPassword(true)}
                        >
                            Esqueceu a senha?
                        </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                        type="password" 
                        placeholder="••••••••"
                        className="pl-9 bg-gray-50 focus:bg-white transition-colors"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {isSignUp && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                        <Label>Confirmar Senha</Label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                                type="password" 
                                placeholder="••••••••"
                                className="pl-9 bg-gray-50 focus:bg-white transition-colors"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                )}
                
                <Button 
                    type="submit"
                    className={`w-full h-12 text-md font-bold mt-4 transition-all shadow-md ${getThemeColor()}`}
                    disabled={loading}
                >
                  {loading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Acessando...
                    </>
                  ) : (
                    isSignUp ? `Cadastrar como ${getRoleName()}` : `Entrar como ${getRoleName()}`
                  )}
                </Button>
            </form>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4 justify-center text-sm bg-gray-50/50 py-4 border-t">
            <div className="text-center">
                {isSignUp ? "Já possui uma conta?" : "Novo por aqui?"} 
                <button 
                    className="text-black font-bold ml-1 hover:underline focus:outline-none"
                    onClick={toggleMode}
                    type="button"
                >
                    {isSignUp ? "Fazer Login" : "Criar conta grátis"}
                </button>
            </div>

            {/* Botão para abrir o popup de instalação manualmente */}
            <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-gray-500 hover:text-black gap-2"
                onClick={() => setShowPwaHelp(true)}
            >
                <Smartphone className="w-3 h-3" /> Instalar Aplicativo
            </Button>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-xs text-gray-400 text-center">
        &copy; 2024 Gold Mobile. Todos os direitos reservados.
      </div>
    </div>
  );
};

export default Login;