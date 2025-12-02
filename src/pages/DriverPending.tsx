import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, Clock, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DriverPending = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-green-600 rounded-b-[40%] shadow-2xl z-0" />
      <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl z-0" />
      <div className="absolute top-20 left-20 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl z-0" />

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-in slide-in-from-bottom-8 duration-700">
        <div className="p-8 text-center">
          
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-green-200 shadow-xl relative group">
             <div className="absolute inset-0 bg-green-400 rounded-full opacity-20 animate-ping" />
             <CheckCircle2 className="w-12 h-12 text-green-600 relative z-10" />
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Cadastro Recebido!</h1>
          <p className="text-gray-500 text-lg mb-8 leading-relaxed">
            Seus dados foram enviados com sucesso para nossa equipe de segurança.
          </p>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-left space-y-4 mb-8">
              <div className="flex items-start gap-4">
                  <div className="p-2 bg-yellow-100 rounded-xl shrink-0">
                      <Clock className="w-6 h-6 text-yellow-700" />
                  </div>
                  <div>
                      <h3 className="font-bold text-slate-800">Análise em andamento</h3>
                      <p className="text-sm text-gray-500 mt-1">Nossa equipe já está validando sua CNH e documentos do veículo.</p>
                  </div>
              </div>

              <div className="w-full h-px bg-slate-200" />

              <div className="flex items-start gap-4">
                  <div className="p-2 bg-green-100 rounded-xl shrink-0">
                      <MessageCircle className="w-6 h-6 text-green-700" />
                  </div>
                  <div>
                      <h3 className="font-bold text-slate-800">Contato via WhatsApp</h3>
                      <p className="text-sm text-gray-500 mt-1">
                          Assim que aprovado, entraremos em contato pelo número cadastrado para liberar seu acesso.
                      </p>
                  </div>
              </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex items-center gap-3">
               <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
               <p className="text-xs text-blue-700 font-medium text-left">
                   Esse processo garante a segurança de todos os usuários da plataforma Gold Mobile.
               </p>
          </div>

          <Button 
            onClick={handleLogout} 
            variant="outline"
            className="w-full h-14 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-bold"
          >
            <LogOut className="mr-2 w-4 h-4" /> Voltar ao Início
          </Button>

        </div>
      </div>
    </div>
  );
};

export default DriverPending;