import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (role: 'client' | 'driver' | 'admin') => {
    setLoading(true);
    try {
        if (isSignUp) {
            // Cadastro
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: role, // Importante: Salva a role no metadata
                        first_name: email.split('@')[0]
                    }
                }
            });
            if (error) throw error;
            showSuccess("Cadastro realizado! Faça login.");
            setIsSignUp(false); // Volta para login
        } else {
            // Login
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            
            // Redireciona baseado na role
            navigate(`/${role}`);
        }
    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-sm"></div>
      
      <Card className="w-full max-w-md z-10 shadow-2xl border-0 animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-black rounded-xl flex items-center justify-center mb-2">
             <span className="text-white font-bold text-xl">Go</span>
          </div>
          <CardTitle className="text-2xl font-bold">{isSignUp ? "Criar Conta" : "Bem-vindo de volta"}</CardTitle>
          <CardDescription>
            {isSignUp ? "Preencha seus dados para começar" : "Acesse sua conta para continuar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="client">Passageiro</TabsTrigger>
              <TabsTrigger value="driver">Motorista</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            {['client', 'driver', 'admin'].map((role: any) => (
              <TabsContent key={role} value={role} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="seu@email.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                
                <Button 
                    className="w-full h-12 text-lg font-bold" 
                    onClick={() => handleAuth(role)}
                    disabled={loading}
                >
                  {loading ? 'Processando...' : (isSignUp ? 'CADASTRAR' : 'ENTRAR')}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
            {isSignUp ? "Já tem conta?" : "Não tem conta?"} 
            <span 
                className="text-blue-600 font-bold ml-1 cursor-pointer hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
            >
                {isSignUp ? "Fazer Login" : "Cadastre-se"}
            </span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;