import React, { useState, useEffect } from "react";
import MapComponent from "@/components/MapComponent";
import { 
  MapPin, Menu, User, ArrowLeft, Car, Navigation, Loader2, Star, Wallet, AlertCircle, Phone, MessageSquare
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
import { Badge } from "@/components/ui/badge";

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
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [missingAmount, setMissingAmount] = useState(0);

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
             if (userProfile && payload.new.id === userProfile.id) setUserProfile(payload.new);
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.id]);

  const fetchInitialData = async () => {
    setLoadingCats(true);
    const { data: cats } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });
    if (cats && cats.length > 0) { setCategories(cats); setSelectedCategoryId(cats[0].id); }
    const { data: { user } } = await supabase.auth.getUser();
    if(user) { const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single(); setUserProfile(data); }
    setLoadingCats(false);
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (ride) {
      if (ride.status === 'COMPLETED') {
         setStep('rating');
      } else if (['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) {
         setStep('waiting');
         if (ride.status === 'SEARCHING') {
             const diff = new Date().getTime() - new Date(ride.created_at).getTime();
             if (60000 - diff > 0) timeout = setTimeout(() => { cancelRide(ride.id, 'TIMEOUT'); showError("Nenhum motorista encontrado."); }, 60000 - diff);
             else cancelRide(ride.id, 'TIMEOUT');
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
          navigator.geolocation.getCurrentPosition(() => { setPickup(`Rua das Flores, 123`); setLoadingLocation(false); }, () => { showError("Erro GPS"); setLoadingLocation(false); });
      } else setLoadingLocation(false);
  };

  const handleRequest = () => {
    if (!pickup || !destinationId) { showError("Preencha origem e destino"); return; }
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
    if (!dest || !cat) return;

    const price = parseFloat(getPrice(cat.id));
    if ((userProfile?.balance || 0) < price) {
        setMissingAmount(price - (userProfile?.balance || 0));
        setShowBalanceAlert(true);
        return;
    }

    setIsRequesting(true);
    try { await requestRide(pickup, dest.label, price, dest.distance, cat.name); } 
    catch (e: any) { showError(e.message); } 
    finally { setIsRequesting(false); }
  };

  const handleSubmitRating = async (stars: number) => { if (ride) await rateRide(ride.id, stars, false); };

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans bg-gray-100">
      <div className="absolute inset-0 z-0">
         <MapComponent showPickup={step !== 'search'} showDestination={!!destinationId && step !== 'search'} />
      </div>

      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle /> Saldo Insuficiente</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-center">
                <p>Faltam R$ {missingAmount.toFixed(2)}</p>
                <Button className="w-full mt-4 bg-green-600" onClick={() => navigate('/wallet')}>Recarregar Agora</Button>
            </div>
          </DialogContent>
      </Dialog>

      {step !== 'rating' && (
          <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center pointer-events-none">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="secondary" size="icon" className="shadow-lg pointer-events-auto rounded-full bg-white">
                        {step === 'search' ? <Menu /> : <ArrowLeft onClick={(e) => { e.stopPropagation(); navigate('/'); }} />}
                    </Button>
                </SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader><SheetTitle>GoldDrive</SheetTitle></SheetHeader>
                    <div className="space-y-2 mt-4">
                        <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/profile')}><User className="mr-2" /> Perfil</Button>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/wallet')}><Wallet className="mr-2" /> Carteira</Button>
                    </div>
                </SheetContent>
            </Sheet>
            <div className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-lg rounded-full px-4 py-2 font-bold text-sm flex items-center gap-2 cursor-pointer" onClick={() => navigate('/wallet')}>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>R$ {userProfile?.balance?.toFixed(2) || '0.00'}</span>
            </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end md:justify-center pointer-events-none">
        
        {step === 'rating' && (
             <div className="w-full h-screen bg-black/50 backdrop-blur-sm pointer-events-auto flex items-center justify-center p-4">
                 <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center animate-in zoom-in-95">
                     <h2 className="text-2xl font-bold">Avaliar Motorista</h2>
                     <div className="flex justify-center gap-2 my-6">
                         {[1, 2, 3, 4, 5].map((star) => (
                             <button key={star} onClick={() => setRating(star)}><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} /></button>
                         ))}
                     </div>
                     <Button className="w-full bg-black" onClick={() => handleSubmitRating(rating || 5)}>Enviar</Button>
                 </div>
             </div>
        )}

        {step !== 'rating' && (
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 pointer-events-auto md:mb-10">
            {step === 'search' && (
                <>
                <h2 className="text-xl font-bold mb-4">GoldDrive - Para onde?</h2>
                <div className="space-y-4">
                    <div className="relative flex items-center gap-2">
                        <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Sua localização" className="pl-4 bg-gray-50" />
                        <Button size="icon" variant="ghost" className="absolute right-2" onClick={getCurrentLocation} disabled={loadingLocation}><Navigation className={loadingLocation ? 'animate-spin' : ''} /></Button>
                    </div>
                    <Select onValueChange={setDestinationId} value={destinationId}>
                        <SelectTrigger className="bg-gray-100 h-12"><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                        <SelectContent>{MOCK_LOCATIONS.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Button className="w-full mt-6 py-6 text-lg bg-black hover:bg-zinc-800" onClick={handleRequest} disabled={!destinationId || !pickup}>Continuar</Button>
                </>
            )}

            {step === 'confirm' && (
                <div className="animate-in slide-in-from-bottom">
                    <span className="font-medium text-gray-500 block mb-4">Escolha a categoria</span>
                    {loadingCats ? <Loader2 className="animate-spin mx-auto" /> : (
                        <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                            {categories.map((cat) => (
                                <div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer ${selectedCategoryId === cat.id ? 'border-black bg-zinc-50' : 'border-transparent'}`}>
                                    <div className="flex items-center gap-4">
                                        <Car className="w-10 h-10" />
                                        <div><h4 className="font-bold">{cat.name}</h4><p className="text-xs text-gray-500">{cat.description}</p></div>
                                    </div>
                                    <span className="font-bold">R$ {getPrice(cat.id)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Button className="w-full py-6 text-lg bg-black" onClick={confirmRide} disabled={!selectedCategoryId || isRequesting}>{isRequesting ? <Loader2 className="animate-spin" /> : "Confirmar GoldDrive"}</Button>
                </div>
            )}

            {step === 'waiting' && (
                <div className="text-center py-2">
                    {ride?.status === 'ACCEPTED' || ride?.status === 'IN_PROGRESS' || ride?.status === 'ARRIVED' ? (
                        <div className="animate-in fade-in zoom-in space-y-4">
                            {/* STATUS HEADER */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-left">
                                    <h3 className="font-bold text-lg text-slate-800">
                                        {ride.status === 'ARRIVED' ? 'Motorista chegou!' : 
                                         ride.status === 'IN_PROGRESS' ? 'Em viagem' : 
                                         'Motorista a caminho'}
                                    </h3>
                                    <p className="text-sm text-gray-500">GoldDrive • Placa {ride.driver_details?.car_plate}</p>
                                </div>
                                <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                                    {ride.status === 'ACCEPTED' ? '2 min' : '---'}
                                </div>
                            </div>

                            {/* DRIVER & CAR CARD */}
                            <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                                        <AvatarImage src={ride.driver_details?.avatar_url} />
                                        <AvatarFallback>{ride.driver_details?.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left flex-1">
                                        <h4 className="font-bold text-lg">{ride.driver_details?.name}</h4>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="flex items-center gap-1 bg-gray-100 px-1.5 rounded"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {ride.driver_details?.rating?.toFixed(1)}</span>
                                            <span className="text-xs text-gray-400">• {ride.driver_details?.total_rides} corridas</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                                    <Car className="w-8 h-8 text-slate-700" />
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 leading-none">{ride.driver_details?.car_model}</p>
                                        <p className="text-xs text-gray-500 mt-1">{ride.driver_details?.car_color} • {ride.driver_details?.car_year}</p>
                                    </div>
                                    <div className="ml-auto bg-white border px-2 py-1 rounded font-mono font-bold text-slate-800 text-sm tracking-widest">
                                        {ride.driver_details?.car_plate}
                                    </div>
                                </div>
                            </div>

                            {/* ACTIONS */}
                            {ride?.status !== 'IN_PROGRESS' && (
                                 <Button variant="outline" className="w-full mt-2 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => cancelRide(ride.id)}>
                                    Cancelar Corrida
                                 </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-4 relative">
                                <div className="absolute inset-0 border-4 border-yellow-500 rounded-full animate-ping opacity-20"></div>
                                <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Procurando motorista...</h3>
                            <Button variant="outline" className="text-red-500 w-full" onClick={() => cancelRide(ride!.id)}>Cancelar</Button>
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