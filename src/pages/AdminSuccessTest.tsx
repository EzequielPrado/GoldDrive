import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ShieldCheck, LogOut, LayoutDashboard } from "lucide-react";

const AdminSuccessTest = () => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      // Busca usuário direto da sessão
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Busca role via RPC para confirmar
        const { data: roleData } = await supabase.rpc('get_my_role');
        setRole(roleData || "Sem role definida");
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.href = "/admin-secure";
  };

  const goToDashboard = () => {
      window.location.href = "/admin";
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-green-50">Carregando dados de sessão...</div>;

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-green-200">
        <CardHeader className="text-center bg-green-100/50 pb-6">
          <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-black text-green-900">LOGIN REALIZADO!</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
            
            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Usuário Autenticado</p>
                <p className="text-lg font-bold text-gray-900">{user?.email || "Email não encontrado"}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">{user?.id}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center gap-3">
                <ShieldCheck className={`w-8 h-8 ${role === 'admin' ? 'text-blue-500' : 'text-red-500'}`} />
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">Nível de Permissão (Role)</p>
                    <p className="text-lg font-black text-gray-900 uppercase">{role}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
                <Button variant="outline" onClick={handleLogout} className="h-12 border-red-200 text-red-600 hover:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
                <Button onClick={goToDashboard} className="h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold">
                    Ir para Dashboard <LayoutDashboard className="ml-2 h-4 w-4" />
                </Button>
            </div>
            
            <p className="text-xs text-center text-gray-400">
                Se você vê esta tela, o Supabase Auth está funcionando corretamente.
            </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSuccessTest;