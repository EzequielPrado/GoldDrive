import React, { useState } from "react";
import { 
  Navigation, Wallet, History, User, 
  ToggleLeft, ToggleRight, DollarSign, TrendingUp 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import MapBackground from "@/components/MapBackground";

const DriverDashboard = () => {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-zinc-900 text-white p-4 shadow-lg z-20">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                <User className="text-gray-300" />
             </div>
             <div>
                <h1 className="font-bold text-sm">Carlos Motorista</h1>
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                    <span>★ 4.98</span>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className={`text-sm font-bold ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                {isOnline ? 'VOCÊ ESTÁ ONLINE' : 'OFFLINE'}
             </span>
             <Switch 
                checked={isOnline} 
                onCheckedChange={setIsOnline} 
                className="data-[state=checked]:bg-green-500 scale-125"
             />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col">
        {isOnline ? (
             <div className="flex-1 relative">
                <MapBackground />
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-zinc-900/90 text-white px-6 py-2 rounded-full shadow-xl backdrop-blur">
                    <p className="text-sm font-medium animate-pulse">Procurando corridas...</p>
                </div>
             </div>
        ) : (
            <div className="flex-1 p-4 max-w-5xl mx-auto w-full space-y-6">
                 {/* Wallet Summary */}
                 <Card className="bg-gradient-to-br from-zinc-800 to-black text-white border-0 shadow-xl mt-4">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-zinc-400 text-sm font-medium mb-1">Saldo disponível</p>
                                <h2 className="text-4xl font-bold">R$ 842,50</h2>
                            </div>
                            <div className="bg-zinc-700/50 p-2 rounded-lg">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-800/50 p-3 rounded-lg">
                                <p className="text-xs text-zinc-400">Ganhos hoje</p>
                                <p className="text-xl font-bold text-green-400">+ R$ 124,00</p>
                            </div>
                            <div className="bg-zinc-800/50 p-3 rounded-lg">
                                <p className="text-xs text-zinc-400">Corridas hoje</p>
                                <p className="text-xl font-bold">8</p>
                            </div>
                        </div>
                    </CardContent>
                 </Card>

                 {/* Actions Grid */}
                 <div className="grid grid-cols-2 gap-4">
                    <Card className="hover:bg-gray-50 transition cursor-pointer">
                        <CardContent className="p-6 flex flex-col items-center text-center">
                            <History className="w-8 h-8 text-blue-600 mb-3" />
                            <h3 className="font-bold">Histórico</h3>
                            <p className="text-xs text-gray-500">Ver todas corridas</p>
                        </CardContent>
                    </Card>
                    <Card className="hover:bg-gray-50 transition cursor-pointer">
                        <CardContent className="p-6 flex flex-col items-center text-center">
                            <TrendingUp className="w-8 h-8 text-green-600 mb-3" />
                            <h3 className="font-bold">Metas</h3>
                            <p className="text-xs text-gray-500">Progresso semanal</p>
                        </CardContent>
                    </Card>
                 </div>

                 {/* Recent Activity */}
                 <div className="pt-4">
                    <h3 className="font-bold text-lg mb-4 text-gray-800">Últimas Corridas</h3>
                    <div className="space-y-3">
                        {[1,2,3].map((_, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-900">Viagem Finalizada</p>
                                    <p className="text-xs text-gray-500">Hoje, 14:30 • Dinheiro</p>
                                </div>
                                <span className="font-bold text-green-600">+ R$ 24,90</span>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>
        )}
      </main>

      {/* Bottom Status (Only visible when offline to prompt action) */}
      {!isOnline && (
        <div className="p-4 bg-white border-t">
            <Button 
                className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200"
                onClick={() => setIsOnline(true)}
            >
                INICIAR JORNADA
            </Button>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;