import React, { useState } from "react";
import MapBackground from "@/components/MapBackground";
import { 
  MapPin, Clock, CreditCard, Star, Search, 
  Menu, User, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { showSuccess, showLoading } from "@/utils/toast";

const ClientDashboard = () => {
  const [step, setStep] = useState<'search' | 'confirm' | 'searching'>('search');
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");

  const handleRequest = () => {
    if (!destination) return;
    setStep('confirm');
  };

  const confirmRide = () => {
    setStep('searching');
    showLoading("Procurando motorista próximo...");
    setTimeout(() => {
        showSuccess("Motorista encontrado! João está a 3 min.");
        // Em um app real, mudaria para tela de rastreamento
    }, 3000);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans">
      <MapBackground />

      {/* Header Mobile Style */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center pointer-events-none">
        <Button variant="secondary" size="icon" className="shadow-lg pointer-events-auto rounded-full h-10 w-10 bg-white">
          <Menu className="h-5 w-5 text-gray-700" />
        </Button>
        <div className="bg-white/90 backdrop-blur px-4 py-1.5 rounded-full shadow-lg font-bold text-sm pointer-events-auto flex items-center gap-2">
            <span className="text-primary">● 500 pts</span>
        </div>
      </div>

      {/* Main Action Area - Bottom Sheet style for Desktop/Mobile */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end md:justify-center md:h-full pointer-events-none">
        <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 pointer-events-auto md:mb-10 transition-all duration-500 ease-in-out">
          
          {step === 'search' && (
            <>
              {/* Banners Area */}
              <div className="mb-6 -mx-2">
                 <Carousel className="w-full">
                    <CarouselContent>
                        <CarouselItem>
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-white h-32 flex flex-col justify-center relative overflow-hidden">
                                <Zap className="absolute right-2 top-2 text-white/20 w-24 h-24 rotate-12" />
                                <h3 className="font-bold text-lg z-10">Desconto Relâmpago</h3>
                                <p className="text-sm opacity-90 z-10">20% off na categoria Black hoje!</p>
                            </div>
                        </CarouselItem>
                        <CarouselItem>
                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white h-32 flex flex-col justify-center relative overflow-hidden">
                                <h3 className="font-bold text-lg z-10">Indique e Ganhe</h3>
                                <p className="text-sm opacity-90 z-10">Convide amigos e ganhe R$ 20,00</p>
                            </div>
                        </CarouselItem>
                    </CarouselContent>
                 </Carousel>
              </div>

              <h2 className="text-2xl font-bold mb-4">Para onde vamos?</h2>
              
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-3 top-3 w-2 h-2 rounded-full bg-black"></div>
                  <div className="absolute left-4 top-5 w-[1px] h-8 bg-gray-200"></div>
                  <Input 
                    placeholder="Sua localização atual" 
                    className="pl-8 bg-gray-50 border-0 focus-visible:ring-1"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-3 w-2 h-2 bg-black"></div>
                  <Input 
                    placeholder="Digite o destino..." 
                    className="pl-8 bg-gray-100 border-0 text-lg font-medium focus-visible:ring-1 transition-all"
                    autoFocus
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6">
                 <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Recentes</h3>
                 <div className="space-y-3">
                    <div 
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
                        onClick={() => { setDestination("Shopping Center"); handleRequest(); }}
                    >
                        <div className="bg-gray-100 p-2 rounded-full"><Clock className="w-4 h-4 text-gray-600" /></div>
                        <div>
                            <p className="font-medium">Shopping Center</p>
                            <p className="text-xs text-gray-500">Av. Paulista, 1000</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition">
                        <div className="bg-gray-100 p-2 rounded-full"><Star className="w-4 h-4 text-gray-600" /></div>
                        <div>
                            <p className="font-medium">Casa</p>
                            <p className="text-xs text-gray-500">Rua das Flores, 123</p>
                        </div>
                    </div>
                 </div>
              </div>

              <Button 
                className="w-full mt-6 py-6 text-lg rounded-xl" 
                onClick={handleRequest}
                disabled={!destination}
              >
                Continuar
              </Button>
            </>
          )}

          {step === 'confirm' && (
             <div className="animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="sm" onClick={() => setStep('search')}>Voltar</Button>
                    <span className="font-medium text-gray-500">Escolha a categoria</span>
                </div>

                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                    {/* Category Options */}
                    {[
                        { name: "Econômico", time: "3 min", price: "R$ 12,90", desc: "Melhor preço", color: "bg-gray-100" },
                        { name: "Confort", time: "5 min", price: "R$ 16,50", desc: "Carros mais novos", color: "bg-blue-50" },
                        { name: "Black", time: "8 min", price: "R$ 24,90", desc: "Luxo e conforto", color: "bg-black text-white" },
                    ].map((car, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border-2 border-transparent hover:border-black cursor-pointer transition ${car.color === 'bg-black text-white' ? 'bg-zinc-900 text-white' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-4">
                                {/* Car Icon Placeholder */}
                                <div className="w-12 h-8 bg-current opacity-20 rounded-md"></div>
                                <div>
                                    <h4 className="font-bold text-lg">{car.name}</h4>
                                    <p className={`text-xs ${car.color.includes('black') ? 'text-gray-400' : 'text-gray-500'}`}>{car.time} • {car.desc}</p>
                                </div>
                            </div>
                            <span className="font-bold text-lg">{car.price}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4 cursor-pointer">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-sm">Cartão •••• 4242</span>
                    </div>
                    <span className="text-xs text-blue-600 font-bold">Trocar</span>
                </div>

                <Button className="w-full py-6 text-lg rounded-xl bg-black hover:bg-zinc-800" onClick={confirmRide}>
                    Confirmar Solicitação
                </Button>
             </div>
          )}

          {step === 'searching' && (
             <div className="text-center py-8 animate-pulse">
                <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4 relative">
                     <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping opacity-20"></div>
                     <Search className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Buscando seu motorista</h3>
                <p className="text-gray-500">Conectando aos parceiros próximos...</p>
                <Button variant="outline" className="mt-8 rounded-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setStep('search')}>
                    Cancelar busca
                </Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;