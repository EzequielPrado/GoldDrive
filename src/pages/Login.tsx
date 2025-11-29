import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowLeft, Mail, Lock, User, KeyRound } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("client");
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  // Mode States
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

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
      showSuccess("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setIsForgotPassword(false);
    } catch (e: any) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); // Impede o reload da página ao dar Enter
    
    setLoading(true);
    try {
        if (isSignUp) {
            // Validações de Cadastro
            if (!email || !password || !fullName) {
                showError("Preencha todos os campos.");
                setLoading(false);
                return;
            }
            if (password !== confirmPassword) {
                showError("As senhas não coincidem.");
                setLoading(false);
                return;
            }
            if (password.length < 6) {
                showError("A senha deve ter pelo menos 6 caracteres.");
                setLoading(false);
                return;
            }

            // Separa nome e sobrenome
            const nameParts = fullName.trim().split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(" ") || "";

            // Cadastro
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: activeTab, // Usa a aba ativa como role (client, driver, admin)
                        first_name: firstName,
                        last_name: lastName,
                        full_name: fullName
                    }
                }
            });
            if (error) throw error;
            showSuccess("Cadastro realizado! Verifique seu email para confirmar.");
            setIsSignUp(false);
        } else {
            // Login
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            
            navigate(activeTab === 'admin' ? '/admin' : activeTab === 'driver' ? '/driver' : '/client');
        }
    } catch (e: any) {
        if (e.message && e.message.includes("Invalid login")) {
            showError("Email ou senha incorretos.");
        } else {
            showError(e.message || "Erro desconhecido ao tentar entrar.");
        }
    } finally {
        // Garante que o loading pare, exceto se navegou (mas o unmount limpa o state)
        if (window.location.pathname === '/login') {
            setLoading(false);
        }
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
           <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                 <Button variant="ghost" size="icon" onClick={() => setIsForgotPassword(false)} className="-ml-2">
                    <ArrowLeft className="w-5 h-5" />
                 </Button>
                 <CardTitle>Recuperar Senha</CardTitle>
              </div>
              <CardDescription>Digite seu email para receber o link de redefinição.</CardDescription>
           </CardHeader>
           <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                            type="email" 
                            placeholder="seu@email.com" 
                            className="pl-9"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Enviando..." : "Enviar Email"}
                  </Button>
              </form>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 z-0" />
      
      <Card className="w-full max-w-md z-10 shadow-2xl border-0">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto w-12 h-12 bg-black rounded-xl flex items-center justify-center mb-2 shadow-lg">
             <span className="text-white font-bold text-xl">Go</span>
          </div>
          <CardTitle className="text-2xl font-bold">{isSignUp ? "Crie sua Conta" : "Login"}</CardTitle>
          <CardDescription>
            {isSignUp ? "Junte-se a revolução da mobilidade" : "Bem-vindo de volta ao GoMove"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="client">Passageiro</TabsTrigger>
              <TabsTrigger value="driver">Motorista</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                    <div className="space-y-2 animate-in slide-in-from-left-5 fade-in duration-300">
                        <Label>Nome Completo</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="João da Silva" 
                                className="pl-9"
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
                        className="pl-9"
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
                            className="text-xs text-blue-600 cursor-pointer hover:underline"
                            type="button"
                            onClick={() => setIsForgotPassword(true)}
                        >
                            Esqueceu?
                        </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                        type="password" 
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {isSignUp && (
                    <div className="space-y-2 animate-in slide-in-from-left-5 fade-in duration-300">
                        <Label>Confirmar Senha</Label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                                type="password" 
                                className="pl-9"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                )}
                
                <Button 
                    type="submit"
                    className={`w-full h-12 text-lg font-bold mt-2 ${
                        activeTab === 'admin' ? 'bg-slate-900 hover:bg-slate-800' : 
                        activeTab === 'driver' ? 'bg-green-600 hover:bg-green-700' : 
                        'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={loading}
                >
                  {loading ? 'Processando...' : (isSignUp ? 'CADASTRAR' : 'ENTRAR')}
                </Button>
            </form>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex justify-center text-sm text-muted-foreground pb-6">
            {isSignUp ? "Já tem conta?" : "Não tem conta?"} 
            <span 
                className="text-primary font-bold ml-1 cursor-pointer hover:underline"
                onClick={toggleMode}
            >
                {isSignUp ? "Fazer Login" : "Cadastre-se"}
            </span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;