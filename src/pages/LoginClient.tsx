"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError } from "@/utils/toast";
import { ArrowLeft, Loader2, User, Mail, Lock, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const LoginClient = () => {
  const navigate = useNavigate();
  const { loading, handleSignIn, handleSignUp } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPwa, setShowPwa] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
        const success = await handleSignUp(email, password, name, phone, 'client');
        if (success) setIsSignUp(false);
    } else {
        await handleSignIn(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex font-sans">
       <PWAInstallPrompt openForce={showPwa} onCloseForce={() => setShowPwa(false)} />
       
       <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1496442226666-8d4a0e29f122?q=80&w=2576&auto=format&fit=crop')] bg-cover bg-center opacity-40" />
           <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 to-transparent" />
           <div className="relative z-10 p-12 text-center">
                <img src="/app-logo.jpg" alt="Gold Mobile" className="w-64 mx-auto mb-8 rounded-2xl" />
                <p className="text-gray-300 text-xl font-light max-w-md mx-auto">Sua experiência premium de mobilidade urbana começa aqui.</p>
           </div>
       </div>

       <div className="w-full lg:w-1/2 flex flex-col relative overflow-y-auto bg-zinc-950">
           <div className="p-6 flex items-center lg:absolute lg:top-0 lg:left-0 lg:z-20 lg:w-full">
               <Button variant="ghost" onClick={() => navigate('/')} className="hover:bg-zinc-800 text-white rounded-full w-12 h-12 p-0 shrink-0">
                   <ArrowLeft className="w-6 h-6" />
               </Button>
               <img src="/app-logo.jpg" alt="Gold Mobile" className="h-10 ml-4 lg:hidden rounded-lg" />
           </div>

           <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 py-10">
               <div className="bg-white rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-black via-zinc-800 to-yellow-500" />
                   
                   <div className="mb-8 text-center">
                       <h2 className="text-3xl font-black text-slate-900">{isSignUp ? "Criar Conta" : "Login Passageiro"}</h2>
                       <p className="text-gray-500 mt-2 text-sm">{isSignUp ? "Cadastre-se para começar a viajar." : "Entre para solicitar sua corrida."}</p>
                   </div>

                   <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <>
                                <div className="relative">
                                    <User className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                    <Input placeholder="Nome Completo" className="h-14 pl-12" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                                    <Input placeholder="Celular (DDD)" className="h-14 pl-12" value={phone} onChange={e => setPhone(e.target.value)} required />
                                </div>
                            </>
                        )}
                        
                        <div className="relative">
                            <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                            <Input type="email" placeholder="seu@email.com" className="h-14 pl-12" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        
                        <div className="relative">
                            <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                            <Input type="password" placeholder="Sua senha" className="h-14 pl-12" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>

                        <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800 transition-all" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "Cadastrar" : "Entrar")}
                        </Button>
                   </form>

                   <div className="mt-8 text-center">
                        <button 
                            type="button" 
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm font-bold text-slate-900 hover:underline"
                        >
                            {isSignUp ? "Já tenho uma conta? Entrar" : "Não tem conta? Criar conta agora"}
                        </button>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginClient;