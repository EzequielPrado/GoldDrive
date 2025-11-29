import React, { useState, useEffect } from "react";
import MapComponent from "@/components/MapComponent";
import { 
  MapPin, Menu, User, ArrowLeft, Car, Navigation, Loader2, Star, Wallet, AlertCircle, Clock, XCircle, ChevronRight, AlertTriangle
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const MOCK_LOCATIONS = [
    { id: "short", label: "Shopping Center (2km)", distance: "2.1 km", km: 2.1 },
    { id: "medium", label: "Centro da Cidade (5km)", distance: "5.0 km", km: 5.0 },
    { id: "long", label: "Aeroporto (15km)", distance: "15.4 km", km: 15.4 }
];

type Category = { id: string; name: string; description: string; base_fare: number; cost_per_km: number; min_fare: number; };

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { ride, requestRide, cancelRide, rateRide, clearRide } = useRide();
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting' | 'rating' | 'cancelled'>('search');
  const [pickup, setPickup] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [missingAmount, setMissingAmount] = useState(0);
  
  // Confirmação de Cancelamento
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  
  // Histórico
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Monitor Ride State
  useEffect(() => {
    if (ride) {
      if (ride.status === 'CANCELLED') {
          setStep('cancelled');
      } else if (ride.status === 'COMPLETED') {
         setStep('rating');
      } else if (['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) {
         setStep('waiting');
      }
    } else {
      if (step !== 'search') setStep('search');
    }
  }, [ride]);

  const fetchInitialData = async () => {
    const { data: cats } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });
    if (cats) { setCategories(cats); setSelectedCategoryId(cats[0].id); }
    const { data: { user } } = await supabase.auth.getUser();
    if(user) { 
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single(); 
        setUserProfile(data); 
        fetchHistory(user.id);
    }
  };

  const fetchHistory = async (uid: string) => {
      const { data } = await supabase.from('rides')
        .select('*, driver:profiles!driver_id(first_name, last_name, car_model, car_plate)')
        .eq('customer_id', uid)
        .order('created_at', { ascending: false });
      setHistoryItems(data || []);
  };

  const handleClearCancelled = () => {
      clearRide();
      setStep('search');
  };

  const handleCancelClick = () => {
      setShowCancelAlert(true);
  };

  const confirmCancel = async () => {
      if (ride) {
          await cancelRide(ride.id);
          setShowCancelAlert(false);
      }
  };

  const getCurrentLocation = () => {
      setLoadingLocation(true);
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(() => { setPickup(`Rua das Flores, 123`); setLoadingLocation(false); }, () => { showError("Erro GPS"); setLoadingLocation(false); });
      } else setLoadingLocation(false);
  };

  const handleRequest = () => { if (!pickup || !destinationId) { showError("Preencha origem e destino"); return; } setStep('confirm'); };

  const getPrice = (catId: string) => {
      const dest = MOCK_LOCATIONS.find(l => l.id === destinationId);
      const cat = categories.find(c => c.id === catId);
      if (!dest || !cat) return "0.00";
      return Math.max(Number(cat.base_fare) + (dest.km * Number(cat.cost_per_km)), Number(cat.min_fare)).toFixed(2);
  };

  const confirmRide = async () => {
    if (isRequesting) return;
    const dest = MOCK_LOCATIONS.find(l => l.id === destinationId);
    const cat = categories.find(c => c.id === selectedCategoryId);
    if (!dest || !cat) return;
    const price = parseFloat(getPrice(cat.id));
    if ((userProfile?.balance || 0) < price) { setMissingAmount(price - (userProfile?.balance || 0)); setShowBalanceAlert(true); return; }
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

      {/* Saldo Alerta */}
      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}>
          <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="text-red-600">Saldo Insuficiente</DialogTitle></DialogHeader><div className="text-center py-4"><h2 className="text-4xl font-bold">R$ {missingAmount.toFixed(2)}</h2></div><DialogFooter><Button onClick={() => navigate('/wallet')}>Recarregar</Button></DialogFooter></DialogContent>
      </Dialog>

      {/* Alert Cancelamento */}
      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> Cancelar Corrida?</AlertDialogTitle>
                  <AlertDialogDescription>Deseja realmente cancelar? Uma taxa pode ser cobrada se o motorista já estiver próximo.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-700">Sim, Cancelar</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* DETALHES DO HISTÓRICO */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={(o) => !o && setSelectedHistoryItem(null)}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Detalhes da Corrida</DialogTitle>
                  <DialogDescription>{new Date(selectedHistoryItem?.created_at).toLocaleString()}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <span className="font-bold text-lg">{selectedHistoryItem?.category}</span>
                      <Badge variant={selectedHistoryItem?.status === 'COMPLETED' ? 'default' : 'destructive'}>
                          {selectedHistoryItem?.status}
                      </Badge>
                  </div>
                  <div className="space-y-2">
                      <div className="flex items-start gap-2"><div className="w-2 h-2 mt-2 bg-blue-500 rounded-full"/><div><p className="text-xs text-gray-400">Origem</p><p className="font-medium">{selectedHistoryItem?.pickup_address}</p></div></div>
                      <div className="flex items-start gap-2"><div className="w-2 h-2 mt-2 bg-green-500 rounded-full"/><div><p className="text-xs text-gray-400">Destino</p><p className="font-medium">{selectedHistoryItem?.destination_address}</p></div></div>
                  </div>
                  {selectedHistoryItem?.driver && (
                      <div className="flex items-center gap-3 border-t pt-3">
                          <Avatar><AvatarFallback>{selectedHistoryItem.driver.first_name[0]}</AvatarFallback></Avatar>
                          <div>
                              <p className="font-bold">{selectedHistoryItem.driver.first_name} {selectedHistoryItem.driver.last_name}</p>
                              <p className="text-xs text-gray-500">{selectedHistoryItem.driver.car_model} • {selectedHistoryItem.driver.car_plate}</p>
                          </div>
                      </div>
                  )}
                  <div className="flex justify-between items-center border-t pt-3">
                      <span className="font-bold text-gray-500">Valor Total</span>
                      <span className="font-bold text-xl">R$ {selectedHistoryItem?.price}</span>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* HISTÓRICO SHEET */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
          <SheetContent side="right" className="w-full sm:w-[400px]">
              <SheetHeader><SheetTitle>Histórico de Viagens</SheetTitle></SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
                  {historyItems.map(item => (
                      <div key={item.id} onClick={() => setSelectedHistoryItem(item)} className="mb-4 p-4 border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-sm">{new Date(item.created_at).toLocaleDateString()}</span>
                              <span className={`text-xs font-bold ${item.status === 'CANCELLED' ? 'text-red-500' : 'text-green-600'}`}>{item.status}</span>
                          </div>
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><MapPin className="w-5 h-5 text-gray-600" /></div>
                              <div className="flex-1 overflow-hidden">
                                  <p className="font-medium truncate">{item.destination_address}</p>
                                  <p className="text-xs text-gray-500">R$ {item.price}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                      </div>
                  ))}
              </ScrollArea>
          </SheetContent>
      </Sheet>

      {/* HEADER / MENU */}
      {step !== 'rating' && step !== 'cancelled' && (
          <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center pointer-events-none">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="secondary" size="icon" className="shadow-lg pointer-events-auto rounded-full h-10 w-10 bg-white">
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
                        <Button variant="ghost" className="w-full justify-start text-lg" onClick={() => navigate('/profile')}><User className="mr-2 h-5 w-5" /> Perfil</Button>
                        <Button variant="ghost" className="w-full justify-start text-lg" onClick={() => setShowHistory(true)}><Clock className="mr-2 h-5 w-5" /> Histórico</Button>
                        <Button variant="ghost" className="w-full justify-start text-lg" onClick={() => navigate('/wallet')}><Wallet className="mr-2 h-5 w-5" /> Carteira</Button>
                    </div>
                </SheetContent>
            </Sheet>
            <div className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-lg rounded-full px-4 py-2.5 font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-white transition-all border border-gray-200/50" onClick={() => navigate('/wallet')}>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-slate-700">R$ {userProfile?.balance?.toFixed(2) || '0.00'}</span>
            </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end md:justify-center pointer-events-none">
        
        {/* TELA DE CANCELAMENTO */}
        {step === 'cancelled' && (
             <div className="w-full h-screen bg-black/60 backdrop-blur-sm pointer-events-auto flex items-center justify-center p-4 z-50">
                 <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95">
                     <div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
                         <XCircle className="w-10 h-10 text-red-600" />
                     </div>
                     <h2 className="text-2xl font-bold mb-2">Corrida Cancelada</h2>
                     <p className="text-gray-500 mb-6">A solicitação foi cancelada.</p>
                     <Button className="w-full h-12 text-lg font-bold bg-black" onClick={handleClearCancelled}>
                         Entendido
                     </Button>
                 </div>
             </div>
        )}

        {/* TELA DE AVALIAÇÃO */}
        {step === 'rating' && (
             <div className="w-full h-screen bg-black/50 backdrop-blur-sm pointer-events-auto flex items-center justify-center p-4">
                 <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                     <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
                         <User className="w-10 h-10 text-green-600" />
                     </div>
                     <h2 className="text-2xl font-bold mb-1">Como foi sua viagem?</h2>
                     <p className="text-gray-500 mb-6">Avalie o motorista {ride?.driver_details?.name}</p>
                     <div className="flex justify-center gap-2 mb-8">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} /></button>))}</div>
                     <Button className="w-full h-12 text-lg font-bold bg-black mb-3" onClick={() => { handleSubmitRating(rating || 5); setStep('search'); }}>Enviar Avaliação</Button>
                 </div>
             </div>
        )}

        {/* PAINEIS DE BUSCA E STATUS */}
        {step !== 'rating' && step !== 'cancelled' && (
            <div className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6 pointer-events-auto md:mb-10 transition-all duration-500 ease-in-out">
            {step === 'search' && (
                <>
                <h2 className="text-xl font-bold mb-4">Para onde vamos?</h2>
                <div className="space-y-4">
                    <div className="relative flex items-center gap-2"><div className="absolute left-3 top-3 w-2 h-2 rounded-full bg-blue-500 z-10"></div><Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Sua localização" className="pl-8 bg-gray-50 border-0" /><Button size="icon" variant="ghost" className="absolute right-2 text-blue-600" onClick={getCurrentLocation} disabled={loadingLocation}><Navigation className={`w-5 h-5 ${loadingLocation ? 'animate-spin' : ''}`} /></Button></div>
                    <div className="relative"><div className="absolute left-3 top-3.5 w-2 h-2 bg-black z-10"></div><Select onValueChange={setDestinationId} value={destinationId}><SelectTrigger className="pl-8 bg-gray-100 border-0 h-12 text-lg font-medium"><SelectValue placeholder="Selecione o destino" /></SelectTrigger><SelectContent>{MOCK_LOCATIONS.map(loc => (<SelectItem key={loc.id} value={loc.id}>{loc.label}</SelectItem>))}</SelectContent></Select></div>
                </div>
                <Button className="w-full mt-6 py-6 text-lg rounded-xl bg-black hover:bg-zinc-800" onClick={handleRequest} disabled={!destinationId || !pickup}>Continuar</Button>
                </>
            )}

            {step === 'confirm' && (
                <div className="animate-in slide-in-from-bottom duration-300">
                    <span className="font-medium text-gray-500 block mb-4">Escolha a categoria</span>
                    {loadingCats ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto" /></div> : <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">{categories.map((cat) => (<div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedCategoryId === cat.id ? 'border-black bg-zinc-50 shadow-md' : 'border-transparent bg-white hover:bg-gray-50'}`}><div className="flex items-center gap-4"><Car className="w-10 h-10 text-gray-700" /><div><h4 className="font-bold text-lg">{cat.name}</h4><p className="text-xs text-gray-500">{cat.description}</p></div></div><span className="font-bold text-lg">R$ {getPrice(cat.id)}</span></div>))}</div>}
                    <div className="flex gap-3 items-center"><div className="flex-1"><p className="text-xs text-gray-500 mb-1">Pagamento</p><div className="flex items-center gap-2 font-bold">💵 Saldo App</div></div><Button className="flex-[2] py-6 text-lg rounded-xl bg-black hover:bg-zinc-800" onClick={confirmRide} disabled={!selectedCategoryId || isRequesting}>{isRequesting ? <Loader2 className="animate-spin" /> : "Confirmar GoldDrive"}</Button></div>
                </div>
            )}

            {step === 'waiting' && (
                <div className="text-center py-4">
                    {ride?.status === 'ACCEPTED' || ride?.status === 'IN_PROGRESS' || ride?.status === 'ARRIVED' ? (
                        <div className="animate-in fade-in zoom-in space-y-4">
                            <div className="bg-white border-2 border-yellow-500/20 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-4 border-b pb-4">
                                    <Avatar className="w-16 h-16 border-2 border-yellow-500"><AvatarImage src={ride.driver_details?.avatar_url} /><AvatarFallback>{ride.driver_details?.name?.[0]}</AvatarFallback></Avatar>
                                    <div className="text-left flex-1">
                                        <h3 className="font-bold text-xl">{ride.driver_details?.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-600"><span className="flex items-center gap-1 bg-yellow-100 px-1.5 rounded font-bold text-yellow-700">★ {ride.driver_details?.rating?.toFixed(1)}</span><span>• {ride.driver_details?.total_rides} viagens</span></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                    <div className="text-left"><p className="text-xs text-gray-500 uppercase">Veículo</p><p className="font-bold text-lg">{ride.driver_details?.car_model}</p><p className="text-sm text-gray-600">{ride.driver_details?.car_color}</p></div>
                                    <div className="text-right"><div className="bg-black text-white px-3 py-1 rounded-lg font-mono font-bold text-lg tracking-widest border-2 border-gray-800">{ride.driver_details?.car_plate}</div></div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center px-2">
                                 <div className="text-left"><p className="text-xs text-gray-500 uppercase font-bold">Status</p><p className="text-blue-600 font-bold animate-pulse">{ride.status === 'ARRIVED' ? 'Motorista no local!' : ride.status === 'IN_PROGRESS' ? 'Em viagem ao destino' : 'Motorista a caminho'}</p></div>
                                 <div className="text-right"><p className="text-xs text-gray-500 uppercase font-bold">Chegada</p><p className="font-bold">{ride.status === 'ACCEPTED' ? '2 min' : '--'}</p></div>
                            </div>
                            {ride?.status !== 'IN_PROGRESS' && <Button variant="destructive" className="w-full mt-4" onClick={handleCancelClick}>Cancelar Corrida</Button>}
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-4 relative"><div className="absolute inset-0 border-4 border-yellow-500 rounded-full animate-ping opacity-20"></div><Loader2 className="w-8 h-8 text-yellow-600 animate-spin" /></div>
                            <h3 className="text-xl font-bold mb-2">Procurando motorista...</h3>
                            <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 w-full" onClick={handleCancelClick}>Cancelar Solicitação</Button>
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