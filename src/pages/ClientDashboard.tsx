import React, { useState, useEffect } from "react";
import MapComponent from "@/components/MapComponent";
import { 
  MapPin, Menu, User, ArrowLeft, Car, Navigation, Loader2, Star, Wallet, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const MOCK_LOCATIONS = [
    { id: "short", label: "Shopping Center (2km)", distance: "2.1 km", km: 2.1 },
    { id: "medium", label: "Centro da Cidade (5km)", distance: "5.0 km", km: 5.0 },
    { id: "long", label: "Aeroporto (15km)", distance: "15.4 km", km: 15.4 }
];

type Category = {
    id: string;
    name: string;
    description: string;
    base_fare: number;
    cost_per_km: number;
    min_fare: number;
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { ride, requestRide, cancelRide, rateRide } = useRide();
  
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting' | 'rating'>('search');
  const [pickup, setPickup] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [rating, setRating] = useState(0);
  
  // Dados
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Controle de Saldo
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [missingAmount, setMissingAmount] = useState(0);

  // Carregar dados iniciais e monitorar saldo
  useEffect(() => {
    fetchInitialData();

    // Monitorar mudanças no saldo em tempo real (para atualizar quando voltar da carteira)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
             if (userProfile && payload.new.id === userProfile.id) {
                 setUserProfile(payload.new);
             }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.id]); // Re-executa se o ID mudar, mas idealmente só uma vez após login

  const fetchInitialData = async () => {
    setLoadingCats(true);
    // Categorias
    const { data: cats } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });
    if (cats && cats.length > 0) {
        setCategories(cats);
        setSelectedCategoryId(cats[0].id);
    }
    
    // Perfil
    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
         const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
         setUserProfile(data);
    }
    setLoadingCats(false);
  };

  // Monitora estado da corrida
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (ride) {
      if (ride.status === 'COMPLETED') {
         setStep('rating');
      } else if (['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) {
         setStep('waiting');
         
         if (ride.status === 'SEARCHING') {
             const created = new Date(ride.created_at).getTime();
             const now = new Date().getTime();
             const diff = now - created;
             const remaining = 60000 - diff;
             
             if (remaining > 0) {
                 timeout = setTimeout(() => {
                     cancelRide(ride.id, 'TIMEOUT');
                     showError("Nenhum motorista disponível no momento. Tente novamente.");
                 }, remaining);
             } else {
                 cancelRide(ride.id, 'TIMEOUT');
             }
         }
      }
    } else {
      setStep('search');
    }
    return () => clearTimeout(timeout);
  }, [ride]);

  const getCurrentLocation = () => {
      setLoadingLocation(true);
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
              setPickup(`Rua das Flores, 123 (Minha Localização)`);
              setLoadingLocation(false);
          }, (error) => {
              showError("Erro ao obter localização.");
              setPickup("");
              setLoadingLocation(false);
          });
      } else {
          showError("Geolocalização indisponível");
          setLoadingLocation(false);
      }
  };

  const handleRequest = () => {
    if (!pickup || !destinationId) {
        showError("Preencha origem e destino");
        return;
    }
    setStep('confirm');
  };

  const getPrice = (catId: string) => {
      const dest = MOCK_LOCATIONS.find(l => l.id === destinationId);
      const cat = categories.find(c => c.id === catId);
      if (!dest || !cat) return "0.00";
      const calculated = Number(cat.base_fare) + (dest.km * Number(cat.cost_per_km));
      return Math.max(calculated, Number(cat.min_fare)).toFixed(2);
  };

  const confirmRide = async () => {
    if (isRequesting) return;
    
    const dest = MOCK_LOCATIONS.find(l => l.id === destinationId);
    const cat = categories.find(c => c.id === selectedCategoryId);
    
    if (!dest || !cat) {
        showError("Erro nos dados da corrida.");
        return;
    }

    const price = parseFloat(getPrice(cat.id));
    const currentBalance = Number(userProfile?.balance || 0);

    // Verificação de Saldo
    if (currentBalance < price) {
        setMissingAmount(price - currentBalance);
        setShowBalanceAlert(true);
        return;
    }

    setIsRequesting(true);
    try {
        await requestRide(pickup, dest.label, price, dest.distance, cat.name);
    } catch (e: any) {
        showError(e.message);
    } finally {
        setIsRequesting(false);
    }
  };

  const handleSubmitRating = async (stars: number) => {
      if (ride) {
          await rateRide(ride.id, stars, false);
      }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans bg-gray-100">
      <div className="absolute inset-0 z-0">
         <MapComponent 
            showPickup={step !== 'search'} 
            showDestination={!!destinationId && step !== 'search'} 
         />
      </div>

      {/* Alerta de Saldo Insuficiente */}
      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-6 h-6" /> Saldo Insuficiente
              </DialogTitle>
              <DialogDescription>
                  Você não possui créditos suficientes para esta corrida.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center">
                <p className="text-gray-500 mb-2">Faltam apenas</p>
                <h2 className="text-4xl font-bold text-slate-900">R$ {missingAmount.toFixed(2)}</h2>
                <p className="text-xs text-gray-400 mt-2">Seu saldo atual: R$ {userProfile?.balance?.toFixed(2)}</p>
            </div>
            <DialogFooter className="flex-col sm:flex-col gap-2">
                <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold" onClick={() => navigate('/wallet')}>
                    Adicionar Saldo Agora
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setShowBalanceAlert(false)}>
                    Fechar
                </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>

      {step !== 'rating' && (
          <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center pointer-events-none">
            <Sheet>
                <SheetTrigger asChild>
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        className="shadow-lg pointer-events-auto rounded-full h-10 w-10 bg-white"
                    >
                    {step === 'search' ? <Menu className="h-5 w-5 text-gray-700" /> : <ArrowLeft className="h-5 w-5" onClick={(e) => { e.stopPropagation(); navigate('/'); }} />}
                    </Button>
                </SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader className="text-left mb-6">
                        <div className="flex items-center gap-4 mb-4" onClick={() => navigate('/profile')}>
                            <Avatar className="w-12 h-12 cursor-pointer">
                                <AvatarImage src={userProfile?.avatar_url} />
                                <AvatarFallback>{userProfile?.first_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <SheetTitle className="text-lg">{userProfile?.first_name}</SheetTitle>
                                <p className="text-sm text-gray-500">R$ {userProfile?.balance?.toFixed(2) || '0.00'}</p>
                            </div>
                        </div>
                    </SheetHeader>
                    <div className="space-y-2">
                        <Button variant="ghost" className="w-full justify-start text-lg" onClick={() => navigate('/profile')}>
                            <User className="mr-2 h-5 w-5" /> Perfil
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-lg" onClick={() => navigate('/wallet')}>
                            <Wallet className="mr-2 h-5 w-5" /> Carteira
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-lg text-red-500" onClick={() => navigate('/')}>
                            Sair
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Balão de Saldo (Novo) */}
            <div 
                className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-lg rounded-full px-4 py-2.5 font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-white transition-all border border-gray-200/50"
                onClick={() => navigate('/wallet')}
            >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-slate-700">R$ {userProfile?.balance?.toFixed(2) || '0.00'}</span>
            </div>
        </div>
      )}

      {/* Painel Inferior / Modal */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end md:justify-center pointer-events-none">
        
        {/* MODAL DE AVALIAÇÃO */}
        {step === 'rating' && (
             <div className="w-full h-screen bg-black/50 backdrop-blur-sm pointer-events-auto flex items-center justify-center p-4">
                 <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                     <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
                         <User className="w-10 h-10 text-green-600" />
                     </div>
                     <h2 className="text-2xl font-bold mb-1">Como foi sua viagem?</h2>
                     <p className="text-gray-500 mb-6">Avalie o motorista {ride?.driver_name}</p>
                     
                     <div className="flex justify-center gap-2 mb-8">
                         {[1, 2, 3, 4, 5].map((star) => (
                             <button 
                                key={star}
                                onClick={() => setRating(star)}
                                className="transition-transform hover:scale-110 focus:outline-none"
                             >
                                 <Star 
                                    className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                                 />
                             </button>
                         ))}
                     </div>

                     <Button className="w-full h-12 text-lg font-bold bg-black mb-3" onClick={() => handleSubmitRating(rating || 5)}>
                         Enviar Avaliação
                     </Button>
                     <Button variant="ghost" className="w-full" onClick={() => handleSubmitRating(0)}>
                         Pular
                     </Button>
                 </div>
             </div>
        )}

        {/* PAINEIS NORMAIS */}
        {step !== 'rating' && (
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 pointer-events-auto md:mb-10 transition-all duration-500 ease-in-out">
            {step === 'search' && (
                <>
                <h2 className="text-xl font-bold mb-4">Para onde vamos?</h2>
                <div className="space-y-4">
                    <div className="relative flex items-center gap-2">
                    <div className="absolute left-3 top-3 w-2 h-2 rounded-full bg-blue-500 z-10"></div>
                    <Input 
                            value={pickup} 
                            onChange={(e) => setPickup(e.target.value)} 
                            placeholder="Sua localização"
                            className="pl-8 bg-gray-50 border-0" 
                    />
                    <Button 
                            size="icon" 
                            variant="ghost" 
                            className="absolute right-2 text-blue-600"
                            onClick={getCurrentLocation}
                            disabled={loadingLocation}
                    >
                            <Navigation className={`w-5 h-5 ${loadingLocation ? 'animate-spin' : ''}`} />
                    </Button>
                    </div>

                    <div className="relative">
                    <div className="absolute left-3 top-3.5 w-2 h-2 bg-black z-10"></div>
                    <Select onValueChange={setDestinationId} value={destinationId}>
                        <SelectTrigger className="pl-8 bg-gray-100 border-0 h-12 text-lg font-medium">
                            <SelectValue placeholder="Selecione o destino" />
                        </SelectTrigger>
                        <SelectContent>
                            {MOCK_LOCATIONS.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    </div>
                </div>
                <Button className="w-full mt-6 py-6 text-lg rounded-xl bg-black hover:bg-zinc-800" onClick={handleRequest} disabled={!destinationId || !pickup}>
                    Continuar
                </Button>
                </>
            )}

            {step === 'confirm' && (
                <div className="animate-in slide-in-from-bottom duration-300">
                    <span className="font-medium text-gray-500 block mb-4">Escolha a categoria</span>
                    
                    {loadingCats ? (
                        <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>
                    ) : (
                        <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                            {categories.map((cat) => (
                                <div 
                                    key={cat.id} 
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedCategoryId === cat.id 
                                        ? 'border-black bg-zinc-50 shadow-md' 
                                        : 'border-transparent bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <Car className="w-10 h-10 text-gray-700" />
                                        <div>
                                            <h4 className="font-bold text-lg">{cat.name}</h4>
                                            <p className="text-xs text-gray-500">{cat.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-lg">R$ {getPrice(cat.id)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex gap-3 items-center">
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-1">Pagamento</p>
                            <div className="flex items-center gap-2 font-bold">
                                💵 Saldo App
                            </div>
                        </div>
                        <Button className="flex-[2] py-6 text-lg rounded-xl bg-black hover:bg-zinc-800" onClick={confirmRide} disabled={!selectedCategoryId || isRequesting}>
                            {isRequesting ? <Loader2 className="animate-spin" /> : "Confirmar GoMove"}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'waiting' && (
                <div className="text-center py-4">
                    {ride?.status === 'ACCEPTED' || ride?.status === 'IN_PROGRESS' || ride?.status === 'ARRIVED' ? (
                        <div className="animate-in fade-in zoom-in space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
                                <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow">
                                    <User className="w-8 h-8 text-gray-500" />
                                </div>
                                <div className="text-left flex-1">
                                    <h3 className="font-bold text-lg">{ride.driver_name || 'Motorista'}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold">★ 5.0</span>
                                        <span>• {ride.category}</span>
                                    </div>
                                    <p className="text-xs font-mono bg-zinc-100 inline-block px-1 mt-1 rounded border">ABC-1234</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center px-2">
                                 <div className="text-left">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Status</p>
                                    <p className="text-blue-600 font-bold animate-pulse">
                                        {ride.status === 'ARRIVED' ? 'Motorista no local!' :
                                         ride.status === 'IN_PROGRESS' ? 'Em viagem ao destino' : 'Motorista chegando'}
                                    </p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Tempo</p>
                                    <p className="font-bold">
                                        {ride.status === 'ACCEPTED' ? '60s' : '--'}
                                    </p>
                                 </div>
                            </div>

                            {ride?.status !== 'IN_PROGRESS' && (
                                 <Button variant="destructive" className="w-full mt-4" onClick={() => cancelRide(ride.id)}>
                                    Cancelar Corrida
                                 </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-4 relative">
                                <div className="absolute inset-0 border-4 border-blue-500 rounded-full animate-ping opacity-20"></div>
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Procurando motorista...</h3>
                            <p className="text-gray-500 mb-6 text-sm px-8">Estamos oferecendo sua corrida para os motoristas parceiros da GoMove.</p>
                            
                            <div className="bg-gray-50 p-4 rounded-lg mb-4 text-left">
                                 <div className="flex justify-between items-center border-b pb-2 mb-2">
                                    <span className="text-sm font-bold">{ride?.category}</span>
                                    <span className="text-sm font-bold text-green-600">R$ {ride?.price}</span>
                                 </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-gray-500">Origem</span>
                                    <span className="text-sm font-medium truncate max-w-[200px]">{ride?.pickup_address}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Destino</span>
                                    <span className="text-sm font-medium truncate max-w-[200px]">{ride?.destination_address}</span>
                                </div>
                            </div>

                            <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 w-full" onClick={() => cancelRide(ride!.id)}>
                                Cancelar Solicitação
                            </Button>
                        </>
                    )}
                 </div>
            )}
            </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;