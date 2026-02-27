import React, { useState, useEffect, useCallback } from "react";
import GoogleMapComponent from "@/components/GoogleMapComponent";
import { 
  MapPin, Car, Loader2, Star, ChevronRight, Clock, Wallet, ArrowLeft, History, MessageCircle, CheckCircle2, AlertTriangle, Banknote, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import FloatingDock from "@/components/FloatingDock";
import RideChat from "@/components/RideChat";
import GoogleLocationSearch from "@/components/GoogleLocationSearch";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ride, loading: rideLoading, requestRide, cancelRide, rateRide, clearRide, currentUserId } = useRide();
  
  const [activeTab, setActiveTab] = useState("home");
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting' | 'rating' | 'cancelled'>('search');
  
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [routeDistance, setRouteDistance] = useState<number>(0); 
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'CASH'>('CASH');
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [missingAmount, setMissingAmount] = useState(0);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState({ enableCash: true, enableWallet: true });
  
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);

  // Efeito de sincronização de estado com a corrida global
  useEffect(() => {
    // Se ainda está carregando o estado inicial do banco, não faz nada
    if (rideLoading) return;

    if (ride) {
      if (ride.status === 'CANCELLED') setStep('cancelled');
      else if (ride.status === 'COMPLETED') setStep('rating');
      else if (['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) {
        setStep('waiting');
      }
    } else {
      // Só volta para busca se não estivermos no meio do fluxo de confirmação
      if (step === 'waiting' || step === 'rating' || step === 'cancelled') {
        setStep('search');
      }
    }
  }, [ride, rideLoading]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) setActiveTab(tabParam);
    fetchInitialData();
  }, [activeTab, searchParams]);

  const fetchInitialData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); 
        if (profile) setUserProfile(profile); 

        if (activeTab === 'home') {
            const [catsRes, tiersRes, settingsRes] = await Promise.all([
                supabase.from('car_categories').select('*').eq('active', true).order('base_fare', { ascending: true }),
                supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true }),
                supabase.from('app_settings').select('*')
            ]);
            if (catsRes.data) {
                const filteredCats = catsRes.data.filter(c => !c.name.toLowerCase().includes('promo'));
                setCategories(filteredCats); 
                if (!selectedCategoryId && filteredCats.length > 0) setSelectedCategoryId(filteredCats[0].id);
            }
            if (tiersRes.data) setPricingTiers(tiersRes.data);
            const cash = settingsRes.data?.find((s: any) => s.key === 'enable_cash');
            const wallet = settingsRes.data?.find((s: any) => s.key === 'enable_wallet');
            setAppSettings({ enableCash: cash?.value ?? true, enableWallet: wallet?.value ?? true });
        } 
        if (activeTab === 'history') {
            const { data: history } = await supabase.from('rides').select(`*, driver:profiles!public_rides_driver_id_fkey(*)`).eq('customer_id', user.id).order('created_at', { ascending: false });
            setHistoryItems(history || []);
        }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (pickupLocation && destLocation && step === 'confirm') {
        setCalculatingRoute(true);
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins: [{ lat: pickupLocation.lat, lng: pickupLocation.lon }],
            destinations: [{ lat: destLocation.lat, lng: destLocation.lon }],
            travelMode: google.maps.TravelMode.DRIVING
        }, (response, status) => {
            if (status === 'OK' && response?.rows[0].elements[0].distance) {
                setRouteDistance(response.rows[0].elements[0].distance.value / 1000);
            } else {
                showError("Erro no cálculo da rota.");
                setStep('search');
            }
            setCalculatingRoute(false);
        });
    }
  }, [pickupLocation, destLocation, step]);

  const calculatePrice = useCallback((catId?: string) => {
      const category = categories.find(c => c.id === (catId || selectedCategoryId));
      if (!category || routeDistance <= 0) return 0;
      let price = 0;
      if (category.name === 'Gold Driver') {
          const tier = pricingTiers.find(t => routeDistance <= Number(t.max_distance)) || pricingTiers[pricingTiers.length - 1];
          price = Number(tier?.price || 15);
      } else {
          price = Number(category.base_fare) + (routeDistance * Number(category.cost_per_km));
          if (price < Number(category.min_fare)) price = Number(category.min_fare);
      }
      return parseFloat(price.toFixed(2));
  }, [categories, pricingTiers, routeDistance, selectedCategoryId]);

  const confirmRide = async () => {
    if (isRequesting || !pickupLocation || !destLocation || !selectedCategoryId) return;
    const price = calculatePrice();
    const category = categories.find(c => c.id === selectedCategoryId);
    if (paymentMethod === 'WALLET' && (userProfile?.balance || 0) < price) { 
        setMissingAmount(price - (userProfile?.balance || 0)); 
        setShowBalanceAlert(true); 
        return; 
    }
    setIsRequesting(true);
    try { 
        await requestRide(pickupLocation.display_name, destLocation.display_name, { lat: pickupLocation.lat, lng: pickupLocation.lon }, { lat: destLocation.lat, lng: destLocation.lon }, price, `${routeDistance.toFixed(1)} km`, category.name, paymentMethod); 
        showSuccess("Solicitação enviada!");
    } catch (e: any) { showError(e.message); } finally { setIsRequesting(false); }
  };

  const getCurrentLocation = () => {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                  setPickupLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, display_name: results[0].formatted_address });
                  showSuccess("Localização atualizada!");
              }
              setGpsLoading(false);
          });
      }, () => { setGpsLoading(false); showError("GPS desativado."); });
  };

  if (rideLoading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-zinc-950">
              <Loader2 className="w-10 h-10 animate-spin text-yellow-500" />
          </div>
      );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-gray-100 font-sans text-slate-900 relative">
      <img src="/app-logo.jpg" alt="Gold" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-[100] drop-shadow-md rounded-lg" />
      
      <div className="absolute inset-0 z-0">
        <GoogleMapComponent pickupLocation={pickupLocation} destinationLocation={destLocation} />
      </div>

      {/* Interface Fixa Superior */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-start pointer-events-none mt-4">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-xl p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg border border-white/20 cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 border-2 border-white"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback className="bg-yellow-500 text-black font-bold">{userProfile?.first_name?.[0]}</AvatarFallback></Avatar>
             <div className="hidden sm:block">
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Olá, {userProfile?.first_name}</p>
                 <p className="text-xs text-slate-900 font-black">Bom te ver!</p>
             </div>
          </div>
          {appSettings.enableWallet && (
            <div className="pointer-events-auto bg-slate-900 text-white px-4 py-2.5 rounded-full flex items-center gap-2 shadow-xl border border-white/10" onClick={() => navigate('/wallet')}>
                <Wallet className="w-4 h-4 text-yellow-500" />
                <span className="font-bold text-sm">R$ {userProfile?.balance?.toFixed(2) || '0.00'}</span>
            </div>
          )}
      </div>

      {/* Camada de UI Principal */}
      <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-end pb-32 md:justify-center p-4">
        {activeTab === 'home' && (
            <div className="w-full max-w-md mx-auto pointer-events-auto">
                {step === 'search' && (
                    <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 animate-in fade-in zoom-in-95 duration-300">
                        <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Para onde vamos?</h2>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <GoogleLocationSearch placeholder="Local de embarque" onSelect={(l) => setPickupLocation(l)} initialValue={pickupLocation?.display_name} className="flex-1" />
                                <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-gray-200" onClick={getCurrentLocation} disabled={gpsLoading}>{gpsLoading ? <Loader2 className="animate-spin" /> : <MapPin className="w-5 h-5" />}</Button>
                            </div>
                            <GoogleLocationSearch placeholder="Digite o destino" onSelect={(l) => setDestLocation(l)} initialValue={destLocation?.display_name} />
                        </div>
                        <Button className="w-full mt-6 h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800 shadow-xl" onClick={() => { if(!pickupLocation || !destLocation) showError("Defina os pontos da viagem."); else setStep('confirm'); }}>
                            Solicitar Corrida <ChevronRight className="ml-1 w-5 h-5" />
                        </Button>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setStep('search')}>
                            <div className="bg-gray-100 p-2 rounded-full"><ArrowLeft className="w-5 h-5" /></div>
                            <h2 className="text-xl font-black text-slate-900">Escolha o plano</h2>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 space-y-2 text-[13px]">
                            <p className="font-medium text-slate-600 line-clamp-1 truncate">De: {pickupLocation?.display_name}</p>
                            <p className="font-bold text-slate-900 line-clamp-1 truncate">Para: {destLocation?.display_name}</p>
                        </div>
                        {calculatingRoute ? (
                            <div className="py-12 flex flex-col items-center gap-3">
                                <Loader2 className="animate-spin text-yellow-500 w-8 h-8" />
                                <p className="text-sm font-bold text-gray-500">Calculando melhor preço...</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 mb-6 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                    {categories.map(cat => {
                                        const price = calculatePrice(cat.id);
                                        const isSelected = selectedCategoryId === cat.id;
                                        return (
                                            <div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-yellow-500 bg-yellow-50 shadow-md scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-slate-400'}`}><Car className="w-6 h-6" /></div>
                                                    <div><h4 className="font-black text-slate-900">{cat.name}</h4><p className="text-[10px] text-gray-500 font-bold uppercase">{cat.description || 'Premium'}</p></div>
                                                </div>
                                                <div className="text-right"><span className="font-black text-lg text-slate-900">R$ {price.toFixed(2)}</span></div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {appSettings.enableWallet && <button onClick={() => setPaymentMethod('WALLET')} className={`h-14 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'WALLET' ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-gray-200 text-slate-500'}`}><Wallet className="w-4 h-4" /> Carteira</button>}
                                    <button onClick={() => setPaymentMethod('CASH')} className={`h-14 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'CASH' ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-gray-200 text-slate-500'}`}><Banknote className="w-4 h-4" /> Dinheiro</button>
                                </div>
                                <Button className="w-full h-14 text-lg font-black rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black shadow-xl" onClick={confirmRide} disabled={isRequesting}>{isRequesting ? <Loader2 className="animate-spin" /> : "CONFIRMAR PEDIDO"}</Button>
                            </>
                        )}
                    </div>
                )}

                {step === 'waiting' && (
                     <div className="bg-white p-6 rounded-[32px] shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
                         {ride?.status === 'SEARCHING' ? (
                             <div className="py-8 text-center">
                                 <div className="relative w-24 h-24 mx-auto mb-6">
                                    <div className="absolute inset-0 bg-yellow-500 rounded-full animate-ping opacity-20" />
                                    <div className="relative w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center text-black shadow-lg"><Car className="w-10 h-10" /></div>
                                 </div>
                                 <h3 className="text-2xl font-black text-slate-900">Buscando motorista</h3>
                                 <p className="text-gray-500 text-sm mt-2">Aguarde, estamos localizando um parceiro.</p>
                                 <Button variant="ghost" className="mt-8 text-red-500 font-bold" onClick={() => setShowCancelAlert(true)}>CANCELAR</Button>
                             </div>
                         ) : (
                             <div className="space-y-6">
                                 <div className="flex items-center justify-between">
                                     <Badge className="bg-green-500 text-black font-black uppercase tracking-widest text-[10px] px-3 py-1">{ride?.status === 'ACCEPTED' ? 'A CAMINHO' : ride?.status === 'ARRIVED' ? 'NO LOCAL' : 'EM VIAGEM'}</Badge>
                                     <span className="font-black text-lg">R$ {Number(ride?.price).toFixed(2)}</span>
                                 </div>
                                 <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <Avatar className="w-14 h-14 border-2 border-white shadow-sm"><AvatarImage src={ride?.driver_details?.avatar_url} /><AvatarFallback className="bg-slate-200 font-bold">{ride?.driver_details?.first_name?.[0]}</AvatarFallback></Avatar>
                                    <div className="flex-1">
                                        <h3 className="font-black text-slate-900 leading-tight">{ride?.driver_details?.first_name}</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">{ride?.driver_details?.car_model} • {ride?.driver_details?.car_plate}</p>
                                    </div>
                                    <Button size="icon" className="bg-slate-900 text-white rounded-xl h-12 w-12" onClick={() => setShowChat(true)}><MessageCircle className="w-5 h-5" /></Button>
                                 </div>
                                 {ride?.status !== 'IN_PROGRESS' && <Button variant="ghost" className="w-full text-red-500 font-bold text-xs" onClick={() => setShowCancelAlert(true)}>Cancelar Viagem</Button>}
                             </div>
                         )}
                     </div>
                )}

                {step === 'rating' && (
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Chegou ao destino!</h2>
                        <p className="text-gray-500 mb-8">Avalie o motorista:</p>
                        <div className="flex justify-center gap-3 mb-8">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => setRating(star)} className="transition-transform active:scale-90"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200'}`} /></button>))}</div>
                        <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl shadow-xl" onClick={async () => { if (ride) await rateRide(ride.id, rating || 5, false); clearRide(); setStep('search'); }}>Finalizar Avaliação</Button>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'history' && (
            <div className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 pointer-events-auto h-[60vh] flex flex-col animate-in fade-in duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2"><History className="w-6 h-6" /> Histórico</h2>
                <ScrollArea className="flex-1 -mr-2 pr-4 custom-scrollbar">
                    {historyItems.length === 0 ? (<div className="py-12 text-center text-gray-400"><Clock className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>Sem viagens ainda.</p></div>) : historyItems.map(item => (<div key={item.id} className="mb-3 p-4 bg-gray-50 rounded-2xl border border-gray-100"><div className="flex justify-between items-start mb-2"><div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</p><p className="font-black text-slate-900 text-sm mt-0.5">{item.category}</p></div><span className="font-black text-slate-900">R$ {Number(item.price).toFixed(2)}</span></div><div className="flex items-center gap-2 mt-3 text-xs text-gray-500"><MapPin className="w-3 h-3 shrink-0" /><p className="truncate">{item.destination_address}</p></div></div>))}
                </ScrollArea>
            </div>
        )}
      </div>

      <FloatingDock activeTab={activeTab} onTabChange={tab => { if(tab === 'profile') navigate('/profile'); else if(tab === 'wallet') navigate('/wallet'); else setActiveTab(tab); }} role="client" />
      {showChat && ride && currentUserId && (<RideChat rideId={ride.id} currentUserId={currentUserId} role="client" otherUserName={ride.driver_details?.first_name || 'Motorista'} otherUserAvatar={ride.driver_details?.avatar_url} onClose={() => setShowChat(false)} />)}
      
      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
          <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
              <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-slate-900">Cancelar Viagem?</AlertDialogTitle><AlertDialogDescription className="text-gray-500">Tem certeza que deseja cancelar?</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter className="mt-4 flex gap-3"><AlertDialogCancel className="rounded-xl h-12 flex-1 font-bold">Voltar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 flex-1 font-bold" onClick={async () => { if(ride) await cancelRide(ride.id, "Cancelado"); setShowCancelAlert(false); setStep('search'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}>
          <DialogContent className="rounded-[32px] border-0 text-center p-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600"><AlertTriangle className="w-10 h-10" /></div>
              <DialogTitle className="text-2xl font-black text-slate-900 mb-2">Saldo Insuficiente</DialogTitle>
              <DialogDescription className="text-gray-500 mb-6">Faltam R$ {missingAmount.toFixed(2)} na sua carteira.</DialogDescription>
              <div className="flex flex-col gap-3">
                  <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl" onClick={() => navigate('/wallet')}>Adicionar Crédito</Button>
                  <Button variant="ghost" className="w-full h-12 text-gray-500 font-bold" onClick={() => { setShowBalanceAlert(false); setPaymentMethod('CASH'); }}>Pagar em Dinheiro</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDashboard;