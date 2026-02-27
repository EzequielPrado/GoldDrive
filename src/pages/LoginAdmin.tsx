import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2, ArrowLeft, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const LoginAdmin = () => {
  const navigate = useNavigate();
  const { loading, handleSignIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSignIn(email, password, 'admin');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
       <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="mb-8 text-center flex flex-col items-center">
               <img src="/app-logo.jpg" alt="Gold Mobile" className="w-48 h-auto mb-6 rounded-2xl" />
               <p className="text-slate-400">Credenciais de alta segurança necessárias.</p>
           </div>
           <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px] overflow-hidden">
               <CardContent className="p-8">
                   <form onSubmit={handleAuth} className="space-y-6">
                       <Input type="email" placeholder="admin@goldmobile.com" className="bg-slate-900/50 border-white/10 text-white h-12" value={email} onChange={e => setEmail(e.target.value)} />
                       <Input type="password" placeholder="••••••••••••" className="bg-slate-900/50 border-white/10 text-white h-12" value={password} onChange={e => setPassword(e.target.value)} />
                       <Button className="w-full bg-yellow-500 text-black font-black h-12 rounded-xl" disabled={loading}>
                           {loading ? <Loader2 className="animate-spin" /> : "AUTENTICAR SISTEMA"}
                       </Button>
                   </form>
               </CardContent>
           </Card>
           <div className="mt-8 text-center">
               <Button variant="ghost" className="text-slate-500 hover:text-white" onClick={() => navigate('/')}>
                   <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Início
               </Button>
           </div>
       </div>
    </div>
  );
};

export default LoginAdmin;