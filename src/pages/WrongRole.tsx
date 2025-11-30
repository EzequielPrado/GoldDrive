import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WrongRole = ({ userRole, requiredRole }: { userRole: string, requiredRole: string[] }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getPortalName = (roles: string[]) => {
      if (roles.includes('client')) return "Passageiro";
      if (roles.includes('driver')) return "Motorista";
      if (roles.includes('admin')) return "Administrador";
      return "Outro";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center font-sans">
       <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
           <AlertTriangle className="w-12 h-12 text-red-600" />
       </div>
       <h1 className="text-3xl font-black text-slate-900 mb-2">Acesso Restrito</h1>
       <p className="text-gray-500 max-w-md mb-8">
           Esta área é exclusiva para <strong>{getPortalName(requiredRole)}s</strong>. 
           <br/>
           Sua conta atual é de: <strong>{userRole === 'client' ? 'Passageiro' : userRole === 'driver' ? 'Motorista' : userRole}</strong>.
       </p>

       <div className="flex flex-col gap-3 w-full max-w-xs">
           <Button onClick={handleLogout} className="h-12 rounded-xl bg-slate-900 text-white font-bold">
               Sair e Trocar de Conta
           </Button>
           <Button variant="ghost" onClick={() => navigate('/')} className="h-12 rounded-xl">
               <ArrowLeft className="mr-2 w-4 h-4" /> Voltar ao Início
           </Button>
       </div>
    </div>
  );
};

export default WrongRole;