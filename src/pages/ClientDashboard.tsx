import React, { useState, useEffect } from "react";
import MapComponent from "@/components/MapComponent";
import { 
  MapPin, Clock, CreditCard, Star, Search, 
  Menu, User, Zap, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRide } from "@/context/RideContext";
import { showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { ride, requestRide, cancelRide } = useRide();
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting'>('search');
  const [pickup, setPickup] = useState("Minha Localização Atual");
  const [destination, setDestination] = useState("");

  // Sync with Global State
  useEffect(() => {
    if (ride) {
      if (ride.status === 'SEARCHING' || ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS') {
        setStep('waiting');
      }
    } else {
      setStep('search');
    }
  }, [ride]);

  const handleRequest = () => {
    if (!destination) return;
    setStep('confirm');
  };

  const confirmRide = async () => {
    // Valores fixos por enquanto, idealmente calcularia distancia
    await requestRide(pickup, destination, 24.90, "5.2km");
  };

  const handleCancel = async () => {
      if (ride) await cancelRide(ride.id);
      setStep('search');
  };

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans bg-gray-100">
      <div className="absolute inset-0 z-0">
         <MapComponent 
            showPickup={step !== 'search'} 
            showDestination={!!destination && step !== 'search'} 
         />
      </div>

      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center pointer-events-none">
        <Button 
            variant="secondary" 
            size="icon" 
            className="shadow-lg pointer-events-auto rounded-full h-10 w-10 bg-white"
            onClick={() => navigate('/')}
        >
          {step === 'search' ? <Menu className="h-5 w-5 text-gray-700" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end md:justify-center pointer-events-none">
        <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 pointer-events-auto md:mb-10 transition-all duration-500 ease-in-out">
          
          {step === 'search' && (
            <>
              <h2 className="text-xl font-bold mb-4">Para onde vamos?</h2>
              <div className="space-y-4">
                <div className="relative">
                   <div className="absolute left-3 top-3 w-2 h-2 rounded-full bg-blue-500"></div>
                   <div className="absolute left-4 top-5 w-[1px] h-8 bg-gray-200"></div>
                   <Input value={pickup} onChange={(e) => setPickup(e.target.value)} className="pl-8 bg-gray-50 border-0" />
                </div>
                <div className="relative">
                   <div className="absolute left-3 top-3 w-2 h-2 bg-black"></div>
                   <Input 
                        placeholder="Digite o destino..." 
                        className="pl-8 bg-gray-100 border-0 text-lg font-medium shadow-sm"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                   />
                </div>
              </div>
              <Button className="w-full mt-6 py-6 text-lg rounded-xl bg-black" onClick={handleRequest} disabled={!destination}>
                Continuar
              </Button>
            </>
          )}

          {step === 'confirm' && (
             <div className="animate-in slide-in-from-bottom duration-300">
                <span className="font-medium text-gray-500 block mb-4">Escolha a categoria</span>
                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                    {[
                        { name: "GoPromo", time: "3 min", price: "R$ 14,90", color: "bg-gray-50" },
                        { name: "GoComfort", time: "5 min", price: "R$ 19,50", color: "bg-blue-50 border-blue-200" },
                        { name: "GoBlack", time: "8 min", price: "R$ 29,90", color: "bg-black text-white" },
                    ].map((car, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer ${car.color}`}>
                            <div className="flex items-center gap-4">
                                <Car className="w-8 h-8" />
                                <div>
                                    <h4 className="font-bold">{car.name}</h4>
                                    <p className="text-xs opacity-70">{car.time} • Perto</p>
                                </div>
                            </div>
                            <span className="font-bold">{car.price}</span>
                        </div>
                    ))}
                </div>
                <Button className="w-full py-6 text-lg rounded-xl bg-black" onClick={confirmRide}>
                    Confirmar GoBlack
                </Button>
             </div>
          )}

          {step === 'waiting' && (
             <div className="text-center py-6">
                {ride?.status === 'ACCEPTED' || ride?.status === 'IN_PROGRESS' ? (
                    <div className="animate-in fade-in zoom-in">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-left">
                                <h3 className="font-bold text-lg">
                                    {ride?.status === 'IN_PROGRESS' ? 'Em viagem...' : 'Seu motorista está chegando'}
                                </h3>
                                <p className="text-gray-500 text-sm">Toyota Corolla • ABC-1234</p>
                            </div>
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                <User />
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <Button className="flex-1" variant="outline">Mensagem</Button>
                             {ride?.status !== 'IN_PROGRESS' && (
                                <Button className="flex-1 bg-red-100 text-red-600 hover:bg-red-200 border-0" onClick={handleCancel}>Cancelar</Button>
                             )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4 relative">
                            <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping opacity-20"></div>
                            <Search className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Procurando motorista...</h3>
                        <p className="text-gray-500 mb-6">Aguardando confirmação dos parceiros</p>
                        <Button variant="ghost" className="text-red-500" onClick={handleCancel}>Cancelar</Button>
                    </>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;