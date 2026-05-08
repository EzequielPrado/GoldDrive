import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a session (Supabase automatically handles the hash token)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If no session, it might be an invalid or expired link
        // But sometimes Supabase takes a moment to process the hash
        setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (!retrySession) {
                showError("Link de recuperação inválido ou expirado.");
                navigate("/login");
            }
        }, 1500);
      }
    };
    checkSession();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      showError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      showError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      showSuccess("Senha atualizada com sucesso!");
      setIsSuccess(true);
      
      // Logout and redirect to login after 3 seconds
      setTimeout(() => {
        supabase.auth.signOut();
        navigate("/login");
      }, 3000);

    } catch (error: any) {
      showError(error.message || "Erro ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl text-white rounded-[32px] overflow-hidden p-8 text-center animate-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Senha Atualizada!</h2>
          <p className="text-zinc-400 mb-8">Sua senha foi alterada com sucesso. Você será redirecionado para a tela de login em alguns segundos.</p>
          <Button 
            className="w-full bg-yellow-500 text-black font-bold h-12 rounded-xl hover:bg-yellow-400"
            onClick={() => navigate("/login")}
          >
            IR PARA LOGIN AGORA
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-800/20 blur-[120px] rounded-full" />

      <div className="mb-8 text-center z-10 flex flex-col items-center">
        <img src="/app-logo.png" alt="Gold Drive" className="w-48 h-auto mb-4 rounded-2xl shadow-2xl" />
        <h1 className="text-white text-xl font-medium opacity-80">Recuperação de Acesso</h1>
      </div>

      <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl text-white rounded-[32px] overflow-hidden z-10 shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
        <div className="h-2 bg-gradient-to-r from-yellow-500 via-zinc-800 to-black" />
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-2xl font-black tracking-tight">Nova Senha</CardTitle>
          <CardDescription className="text-zinc-400">Escolha uma senha forte para sua segurança.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="h-12 pl-12 bg-zinc-900/50 border-white/10 text-white rounded-xl focus:ring-yellow-500/50 focus:border-yellow-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="h-12 pl-12 bg-zinc-900/50 border-white/10 text-white rounded-xl focus:ring-yellow-500/50 focus:border-yellow-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-yellow-500 text-black font-black h-14 rounded-2xl hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : "REDEFINIR SENHA"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Button 
              variant="ghost" 
              className="text-zinc-500 hover:text-white hover:bg-white/5 rounded-full"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
