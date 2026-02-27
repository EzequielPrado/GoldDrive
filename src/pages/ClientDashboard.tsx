import React, { useState, useEffect, useRef } from "react";
import GoogleMapComponent from "@/components/GoogleMapComponent";
import { 
  MapPin, Car, Navigation, Loader2, Star, AlertTriangle, XCircle, ChevronRight, Clock, Wallet, User, ArrowLeft, BellRing, History, X, Flag, CreditCard, Banknote, MessageCircle, CheckCircle2, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import FloatingDock from "@/components/FloatingDock";
import RideChat from "@/components/RideChat";
import { Textarea } from "@/components/ui/textarea";
import GoogleLocationSearch from "@/components/GoogleLocationSearch";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ride, requestRide, cancelRide, rateRide, clearRide, currentUserId } = useRide();
  
  const [activeTab, setActiveTab] = useState("home");
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting' | 'rating' | 'cancelled'>('search');
  
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, address: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, address: string } | null>(null);
  const [routeDistance, setRouteDistance] = useState<number>(0); 
  
  const [formErrors, setFormErrors] = useState({ pickup: false, dest: false });
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [hasAskedLocation, setHasAskedLocation] = useState(false);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'CASH'>('WALLET');
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [missingAmount, setMissingAmount] = useState(0);
  const [loadingCats, setLoadingCats] = useState(true);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  
  const [popupState, setPopupState] = useState({ arrival: false, start: false, accepted: false });
  const seenPopupsRef = useRef<{ [key: string]: boolean }>({});
  const [showChat, setShowChat] = useState(false);
  
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [adminConfig, setAdminConfig] = useState<any>({});
  const [appSettings, setAppSettings] = useState({ enableCash: true, enableWallet: true });
  
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  useEffect(() => {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  useEffect(() => {
    if (pickupLocation && destLocation) {
        setCalculatingRoute(true);
        // O Google Maps no componente GoogleMapComponent já calculará a rota visualmente.
        // Aqui usamos apenas para pegar a distância para cálculo de preço se necessário.
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins: [{ lat: pickupLocation.lat, lng: pickupLocation.lon }],
            destinations: [{ lat: destLocation.lat, lng: destLocation.lon }],
            travelMode: google.maps.TravelMode.DRIVING
        }, (response, status) => {
            if (status === 'OK' && response?.rows[0].elements[0].distance) {
                setRouteDistance(response.rows[0].elements[0].distance.value / 1000);
            }
            setCalculatingRoute(false);
        });
    }
  }, [pickupLocation, destLocation]);

  useEffect(() => {
    if (ride) {
      if (ride.status === 'CANCELLED') setStep('cancelled');
      else if (ride.status === 'COMPLETED') setStep('rating');
      else if (['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) setStep('waiting');

      const hasSeen = (type: string) => seenPopupsRef.current[`${ride.id}_${type}`];
      const markAsSeen = (type: string) => { seenPopupsRef.current[`${ride.id}_${type}`] = true; };

      if (ride.status === 'ACCEPTED' && !hasSeen('accepted')) { setPopupState(p => ({ ...p, accepted: true })); markAsSeen('accepted'); }
      if (ride.status === 'ARRIVED' && !hasSeen('arrival')) { setPopupState(p => ({ ...p, arrival: true })); markAsSeen('arrival'); }
      if (ride.status === 'IN_PROGRESS' && !hasSeen('start')) { setPopupState(p => ({ ...p, start: true })); markAsSeen('start'); }
    } else {
      if (step !== 'search') setStep('search');
    }
  }, [ride?.status, ride?.id]);

  const fetchInitialData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return; 
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single(); 
        if (profile) setUserProfile(profile); 

        if (activeTab === 'home') {
            const { data: cats } = await supabase.from('car_categories').select('*').eq('active', true).order('base_fare', { ascending: true });
            if (cats) {
                setCategories(cats); 
                if (!selectedCategoryId) setSelectedCategoryId(cats[0].id);
            }
            const { data: tiers } = await supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true });
            if (tiers) setPricingTiers(tiers);
            const { data: configData } = await supabase.from('admin_config').select('*');
            const conf: any = {};
            configData?.forEach((c: any) => conf[c.key] = c.value);
            setAdminConfig(conf);
            const { data: settings } = await supabase.from('app_settings').select('*');
            const cash = settings?.find((s: any) => s.key === 'enable_cash');
            const wallet = settings?.find((s: any) => s.key === 'enable_wallet');
            setAppSettings({ enableCash: cash?.value ?? true, enableWallet: wallet?.value ?? true });
        } 
        if (activeTab === 'history') {
            const { data: history } = await supabase.from('rides').select(`*, driver:profiles!public_rides_driver_id_fkey(*)`).eq('customer_id', user.id).order('created_at', { ascending: false });
            setHistoryItems(history || []);
        }
    } catch (error) { console.error(error); } finally { setLoadingCats(false); }
  };

  const calculatePrice = (catId?: string) => {
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
  };

  const confirmRide = async () => {
    if (isRequesting || !pickupLocation || !destLocation) return;
    const price = calculatePrice();
    if (paymentMethod === 'WALLET' && (userProfile?.balance || 0) < price) { setMissingAmount(price - userProfile.balance); setShowBalanceAlert(true); return; }
    setIsRequesting(true);
    try { 
        await requestRide(pickupLocation.address, destLocation.address, { lat: pickupLocation.lat, lng: pickupLocation.lon }, { lat: destLocation.lat, lng: destLocation.lon }, price, `${routeDistance.toFixed(1)} km`, categories.find(c => c.id === selectedCategoryId).name, paymentMethod); 
    } catch (e: any) { showError(e.message); } finally { setIsRequesting(false); }
  };

  const getCurrentLocation = () => {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                  setPickupLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, address: results[0].formatted_address });
                  showSuccess("Localização encontrada!");
              }
              setGpsLoading(false);
          });
      }, () => { setGpsLoading(false); showError("Erro ao obter GPS."); });
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-gray-100">
      <img src="/logo-goldmobile-2.png" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-6 opacity-80 z-50 drop-shadow-md" />
      <div className="absolute inset-0 z-0">
         <GoogleMapComponent pickupLocation={pickupLocation} destinationLocation={destLocation} />
      </div>
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none mt-4">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-xl p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback className="bg-yellow-500 text-black font-bold">{userProfile?.first_name?.[0]}</AvatarFallback></Avatar>
             <div><p className="text-xs text-gray-500 font-bold">Olá,</p><p className="text-sm text-slate-900 font-black">{userProfile?.first_name}</p></div>
          </div>
          {appSettings.enableWallet && (<div className="pointer-events-auto bg-black text-white px-4 py-2.5 rounded-full flex items-center gap-2 shadow-xl" onClick={() => navigate('/wallet')}><span className="font-bold text-sm">R$ {userProfile?.balance?.toFixed(2) || '0.00'}</span></div>)}
      </div>
      <div className={`absolute inset-0 z-10 flex flex-col items-center p-4 pointer-events-none ${step === 'search' ? 'justify-center bg-black/10 backdrop-blur-sm' : 'justify-end pb-32 md:justify-center'}`}>
        {activeTab === 'home' && (
            <div className="w-full max-w-md pointer-events-auto">
                {step === 'search' && (
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl">
                        <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Para onde vamos?</h2>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <GoogleLocationSearch placeholder="Local de embarque" onSelect={(l) => setPickupLocation(l)} initialValue={pickupLocation?.address} className="flex-1" error={formErrors.pickup} />
                                <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0" onClick={getCurrentLocation} disabled={gpsLoading}>{gpsLoading ? <Loader2 className="animate-spin" /> : <MapPin className="w-5 h-5" />}</Button>
                            </div>
                            <GoogleLocationSearch placeholder="Digite o destino..." onSelect={(l) => setDestLocation(l)} initialValue={destLocation?.address} error={formErrors.dest} />
                        </div>
                        <Button className="w-full mt-6 h-14 text-lg font-bold rounded-2xl bg-black text-white" onClick={() => { if(!pickupLocation || !destLocation) showError("Selecione os endereços."); else setStep('confirm'); }} disabled={calculatingRoute}>Continuar <ChevronRight className="ml-2 w-5 h-5" /></Button>
                    </div>
                )}
                {step === 'confirm' && (
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl">
                        <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setStep('search')}><ArrowLeft className="w-5 h-5" /><h2 className="text-xl font-bold">Escolha a Categoria</h2></div>
                        <div className="space-y-3 mb-4 max-h-[30vh] overflow-y-auto">{categories.map(cat => (<div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${selectedCategoryId === cat.id ? 'border-yellow-500 bg-yellow-50' : 'bg-gray-50'}`}><div className="flex items-center gap-4"><div><h4 className="font-bold">{cat.name}</h4><p className="text-xs text-gray-500">{cat.description}</p></div></div><span className="font-black">R$ {calculatePrice(cat.id).toFixed(2)}</span></div>))}</div>
                        <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-black text-white" onClick={confirmRide} disabled={isRequesting}>{isRequesting ? <Loader2 className="animate-spin" /> : "Confirmar Viagem"}</Button>
                    </div>
                )}
                {step === 'waiting' && (
                     <div className="bg-white p-6 rounded-[32px] shadow-2xl text-center">
                         {ride?.status === 'ACCEPTED' || ride?.status === 'IN_PROGRESS' || ride?.status === 'ARRIVED' ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border">
                                    <Avatar className="w-16 h-16"><AvatarImage src={ride.driver_details?.avatar_url} /><AvatarFallback>M</AvatarFallback></Avatar>
                                    <div className="text-left"><h3 className="font-black text-xl">{ride.driver_details?.name}</h3><p className="text-sm text-gray-500">{ride.driver_details?.car_model} • {ride.driver_details?.car_plate}</p></div>
                                </div>
                                <Button className="w-full h-14 bg-black text-white rounded-2xl" onClick={() => setShowChat(true)}><MessageCircle className="mr-2" /> Chat com Motorista</Button>
                                <Button variant="ghost" className="text-red-600 font-bold" onClick={() => setShowCancelAlert(true)}>Cancelar</Button>
                            </div>
                         ) : (<div className="py-8"><Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-yellow-500" /><h3 className="text-2xl font-black">Buscando Motorista...</h3><Button variant="ghost" className="mt-4" onClick={() => setShowCancelAlert(true)}>Cancelar</Button></div>)}
                     </div>
                )}
            </div>
        )}
      </div>
      <FloatingDock activeTab={activeTab} onTabChange={tab => tab === 'profile' ? navigate('/profile') : tab === 'wallet' ? navigate('/wallet') : setActiveTab(tab)} role="client" />
      {showChat && ride && currentUserId && (<RideChat rideId={ride.id} currentUserId={currentUserId} role="client" otherUserName={ride.driver_details?.name || 'Motorista'} onClose={() => setShowChat(false)} />)}
    </div>
  );
};

export default ClientDashboard;