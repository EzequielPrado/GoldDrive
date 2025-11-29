import React, { useState, useEffect } from "react";
import { Wallet, User, MapPin, Navigation, Shield, DollarSign, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import MapComponent from "@/components/MapComponent";
import { useRide, RideData } from "@/context/RideContext";
import { showSuccess } from "@/utils/toast";

const DriverDashboard = () => {
  const { ride, availableRides, acceptRide, finishRide, startRide, rateRide } = useRide();
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<RideData | null>(null);
  const [timer, setTimer] = useState(15);
  const [rating, setRating] = useState(0);

  // Estados derivados
  const isOnTrip = !!ride && ride.status !== 'COMPLETED';
  const isRating = ride?.status === 'COMPLETED';

  useEffect(() => {
    if (isOnline && availableRides.length > 0 && !ride) {
        setIncomingRide(availableRides[0]);
        setTimer(15);
    } else {
        setIncomingRide(null);
    }
  }, [availableRides, isOnline, ride]);

  useEffect(() => {
    if (incomingRide && timer > 0) {
        const interval = setInterval(() => setTimer(t => t - 1), 1000);
        return () => clearInterval(interval);
    } else if (timer === 0) {
        setIncomingRide(null);
    }
  }, [incomingRide, timer]);

  const handleAccept = async () => {
    if (incomingRide) {
        await acceptRide(incomingRide.id);
        showSuccess("Corrida aceita! Vá até o passageiro.");
        setIncomingRide(null);
    }
  };

  const handleSubmitRating = async (stars: number) => {
      if (ride) {
          await rateRide(ride.id, stars, true); // true = isDriver
      }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative overflow-hidden">
      {/* Header Fixo */}
      <header className="bg-zinc-900 text-white p-4 shadow-md z-30">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-zinc-700 p-2 rounded-full"><User className="w-5 h-5" /></div>
             <div>
                <div className="font-bold text-sm">Carlos Mot.</div>
                <div className="text-xs text-yellow-400">★ 4.98</div>
             </div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-800 px-4 py-2 rounded-full border border-zinc-700">
             <span className={`text-xs font-bold ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
             </span>
             <Switch checked={isOnline} onCheckedChange={setIsOnline} className="data-[state=checked]:bg-green-500" />
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
         {/* TELA DE AVALIAÇÃO (MODAL) */}
         {isRating && (
             <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                 <div className="bg-zinc-900 text-white w-full max-w-sm rounded-3xl p-6 text-center animate-in zoom-in-95">
                     <h2 className="text-2xl font-bold mb-2">Avaliar Passageiro</h2>
                     <p className="text-gray-400 mb-8">Como foi o comportamento do passageiro?</p>
                     
                     <div className="flex justify-center gap-2 mb-8">
                         {[1, 2, 3, 4, 5].map((star) => (
                             <button 
                                key={star}
                                onClick={() => setRating(star)}
                                className="transition-transform hover:scale-110 focus:outline-none"
                             >
                                 <Star 
                                    className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600'}`} 
                                 />
                             </button>
                         ))}
                     </div>

                     <Button className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 mb-3" onClick={() => handleSubmitRating(rating || 5)}>
                         Confirmar Avaliação
                     </Button>
                     <Button variant="ghost" className="w-full text-gray-400 hover:text-white" onClick={() => handleSubmitRating(0)}>
                         Pular Avaliação
                     </Button>
                 </div>
             </div>
         )}

        {isOnline ? (
            <div className="h-full w-full relative">
                <MapComponent className="h-full w-full" showPickup={isOnTrip} />
                
                {!isOnTrip && !incomingRide && !isRating && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-white px-6 py-2 rounded-full shadow-lg backdrop-blur z-20 flex items-center gap-2">
                         <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                         <p className="text-sm font-medium">Procurando corridas...</p>
                    </div>
                )}

                {isOnTrip && !isRating && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white shadow-[0_-5px_30px_rgba(0,0,0,0.3)] z-20 animate-in slide-in-from-bottom duration-500">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${ride?.status === 'ACCEPTED' ? 'bg-blue-500' : 'bg-green-600'}`}>
                                            {ride?.status === 'ACCEPTED' ? 'BUSCANDO' : 'EM VIAGEM'}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">Passageiro</h3>
                                    <p className="text-gray-500 text-sm truncate max-w-[200px]">{ride?.destination_address}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="text-2xl font-black text-green-600">R$ {ride?.price}</h3>
                                    <p className="text-gray-400 text-xs uppercase font-bold">Dinheiro</p>
                                </div>
                            </div>
                            
                            {ride?.status === 'ACCEPTED' ? (
                                 <Button className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700 font-bold rounded-xl shadow-lg shadow-blue-200" onClick={() => startRide(ride!.id)}>
                                    <Navigation className="mr-2 h-5 w-5" /> Iniciar Corrida
                                 </Button>
                            ) : (
                                 <Button className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 font-bold rounded-xl shadow-lg shadow-green-200" onClick={() => finishRide(ride!.id)}>
                                    <Shield className="mr-2 h-5 w-5" /> Finalizar & Receber
                                 </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="p-6 space-y-6 h-full bg-zinc-900 flex flex-col items-center justify-center text-center">
                 <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Wallet className="w-16 h-16 text-zinc-600" />
                 </div>
                 <h2 className="text-3xl font-bold text-white">Você está offline</h2>
                 <Button size="lg" className="w-full max-w-xs bg-green-600 hover:bg-green-700 mt-4" onClick={() => setIsOnline(true)}>
                    FICAR ONLINE
                 </Button>
            </div>
        )}

        {/* POPUP DE NOVA CORRIDA */}
        {incomingRide && !isRating && (
            <div className="absolute inset-0 z-50 flex flex-col bg-zinc-900 text-white animate-in slide-in-from-bottom duration-300">
                <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                    <div className="absolute top-6 right-6 w-12 h-12 rounded-full border-4 border-white/20 flex items-center justify-center font-bold text-xl">
                        {timer}
                    </div>

                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Nova Solicitação</h2>
                    <h1 className="text-5xl font-black mb-1">{incomingRide.category}</h1>
                    <div className="bg-green-500/20 text-green-400 px-4 py-1 rounded-full text-sm font-bold mb-8 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> Pagamento em Dinheiro
                    </div>

                    <div className="w-full bg-zinc-800 rounded-2xl p-6 space-y-6 mb-8">
                        <div className="flex justify-between items-end border-b border-zinc-700 pb-4">
                            <div>
                                <p className="text-gray-400 text-xs uppercase mb-1">Ganho Estimado</p>
                                <p className="text-4xl font-bold text-green-400">R$ {incomingRide.price}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-400 text-xs uppercase mb-1">Distância</p>
                                <p className="text-2xl font-bold">{incomingRide.distance}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                             <div className="flex items-start gap-4">
                                 <div className="w-3 h-3 rounded-full bg-white mt-2 shrink-0 shadow-[0_0_10px_white]" />
                                 <div>
                                     <p className="text-xs text-gray-500 uppercase">Buscar em</p>
                                     <p className="text-lg font-medium leading-tight">{incomingRide.pickup_address}</p>
                                 </div>
                             </div>
                             <div className="flex items-start gap-4">
                                 <div className="w-3 h-3 rounded-full bg-green-500 mt-2 shrink-0 shadow-[0_0_10px_#22c55e]" />
                                 <div>
                                     <p className="text-xs text-gray-500 uppercase">Levar até</p>
                                     <p className="text-lg font-medium leading-tight">{incomingRide.destination_address}</p>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-4">
                         <Button 
                            variant="ghost" 
                            className="h-16 text-xl bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl"
                            onClick={() => setIncomingRide(null)}
                         >
                            Recusar
                         </Button>
                         <Button 
                            className="h-16 text-xl bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.4)] animate-pulse"
                            onClick={handleAccept}
                         >
                            ACEITAR CORRIDA
                         </Button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;