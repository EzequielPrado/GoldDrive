import React, { useState, useEffect } from "react";
import { Wallet, User, MapPin, Navigation, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import MapComponent from "@/components/MapComponent";
import { useRide, RideData } from "@/context/RideContext";
import { showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const DriverDashboard = () => {
  const { ride, availableRides, acceptRide, finishRide, startRide } = useRide();
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<RideData | null>(null);

  // Efeito para "tocar" quando chega nova corrida
  useEffect(() => {
    if (isOnline && availableRides.length > 0 && !ride) {
        // Pega a primeira da fila para mostrar no popup
        setIncomingRide(availableRides[0]);
    } else {
        setIncomingRide(null);
    }
  }, [availableRides, isOnline, ride]);

  const isOnTrip = !!ride;

  const handleAccept = async () => {
    if (incomingRide) {
        await acceptRide(incomingRide.id);
        showSuccess("Corrida aceita! Navegando para passageiro.");
        setIncomingRide(null);
    }
  };

  const handleStartTrip = async () => {
      if (ride) await startRide(ride.id);
  };

  const handleFinishTrip = async () => {
      if (ride) await finishRide(ride.id);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative">
      <header className="bg-zinc-900 text-white p-4 shadow-md z-30">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-zinc-700 p-2 rounded-full"><User className="w-5 h-5" /></div>
             <div>
                <div className="font-bold text-sm">Carlos Mot.</div>
                <div className="text-xs text-yellow-400">★ 4.98</div>
             </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-800 px-4 py-2 rounded-full">
             <span className={`text-xs font-bold ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
             </span>
             <Switch checked={isOnline} onCheckedChange={setIsOnline} className="data-[state=checked]:bg-green-500" />
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        {isOnline ? (
            <div className="h-full w-full relative">
                <MapComponent className="h-full w-full" showPickup={isOnTrip} />
                
                {!isOnTrip && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-white px-6 py-2 rounded-full shadow-lg backdrop-blur z-20">
                        <p className="text-sm font-medium animate-pulse">Procurando corridas...</p>
                    </div>
                )}

                {isOnTrip && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.2)] z-20">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {ride?.status === 'ACCEPTED' ? 'Buscando Passageiro' : 'Em viagem'}
                                </h3>
                                <p className="text-gray-500">Destino: {ride?.destination_address}</p>
                            </div>
                            <div className="text-right">
                                <h3 className="text-xl font-bold text-green-600">R$ {ride?.price}</h3>
                                <p className="text-gray-400 text-sm">Dinheiro</p>
                            </div>
                        </div>
                        
                        {ride?.status === 'ACCEPTED' ? (
                             <Button className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700" onClick={handleStartTrip}>
                                Iniciar Corrida (Passageiro Embarcou)
                             </Button>
                        ) : (
                             <Button className="w-full py-6 text-lg bg-green-600 hover:bg-green-700" onClick={handleFinishTrip}>
                                Finalizar Corrida
                             </Button>
                        )}
                    </div>
                )}
            </div>
        ) : (
            <div className="p-6 space-y-6">
                 <Card className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white border-0 shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-zinc-400 text-sm">Saldo total</p>
                                <h2 className="text-4xl font-bold">R$ 842,50</h2>
                            </div>
                            <Wallet className="w-8 h-8 opacity-50" />
                        </div>
                    </CardContent>
                 </Card>
                 <div className="flex justify-center mt-10">
                     <p className="text-gray-500">Fique online para receber corridas</p>
                 </div>
            </div>
        )}
      </div>

      <Dialog open={!!incomingRide}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-green-400">Nova Corrida!</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4 text-center">
             <div className="flex justify-center gap-8">
                 <div className="text-center">
                     <p className="text-gray-400 text-xs uppercase">Distância</p>
                     <p className="text-2xl font-bold">{incomingRide?.distance}</p>
                 </div>
                 <div className="text-center">
                     <p className="text-gray-400 text-xs uppercase">Ganho</p>
                     <p className="text-2xl font-bold text-green-400">R$ {incomingRide?.price}</p>
                 </div>
             </div>
             
             <div className="bg-zinc-800 p-4 rounded-xl text-left space-y-3">
                 <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-blue-500" />
                     <p className="text-sm font-medium">{incomingRide?.pickup_address}</p>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-green-500" />
                     <p className="text-sm font-medium">{incomingRide?.destination_address}</p>
                 </div>
             </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:justify-center">
            <Button className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-bold" onClick={handleAccept}>
                ACEITAR CORRIDA
            </Button>
            <Button 
                variant="ghost" 
                className="w-full text-gray-400 hover:text-white hover:bg-zinc-800"
                onClick={() => setIncomingRide(null)}
            >
                Ignorar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverDashboard;