import React, { useState, useEffect } from "react";
import MapComponent from "@/components/MapComponent";
import { 
  MapPin, Car, Navigation, Loader2, Star, AlertTriangle, XCircle, ChevronRight, Clock, Wallet, User, ArrowLeft, BellRing, History, X, Flag, CreditCard, Banknote, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import FloatingDock from "@/components/FloatingDock";
import RideChat from "@/components/RideChat";
import { Textarea } from "@/components/ui/textarea";
import LocationSearch from "@/components/LocationSearch";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { ride, requestRide, cancelRide, rateRide, clearRide, currentUserId } = useRide();
  
  // Tabs Navigation
  const [activeTab, setActiveTab] = useState("home");
  
  // Ride Flow States
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting' | 'rating' | 'cancelled'>('search');
  
  // Locations Real Data
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, address: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, address: string } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState<number>(0); // em KM
  
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
  const [showArrivalPopup, setShowArrivalPopup] = useState(false);
  const [showStartPopup, setShowStartPopup] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Dados de Preço Dinâmico e Configs
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [adminConfig, setAdminConfig] = useState<any>({});
  const [appSettings, setAppSettings] = useState({ enableCash: true, enableWallet: true });
  
  // Data
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, [activeTab]);

  // Efeito para calcular rota quando Origem e Destino mudam
  useEffect(() => {
      const calculateRoute = async () => {
          if (pickupLocation && destLocation) {
              setCalculatingRoute(true);
              try {
                  // Chama OSRM para rota de carro
                  const response = await fetch(
                      `https://router.project-osrm.org/route/v1/driving/${pickupLocation.lon},${pickupLocation.lat};${destLocation.lon},${destLocation.lat}?overview=full&geometries=geojson`
                  );
                  const data = await response.json();
                  
                  if (data.routes && data.routes.length > 0) {
                      const route = data.routes[0];
                      // Distância vem em metros, converter para KM
                      const distanceKm = route.distance / 1000;
                      setRouteDistance(distanceKm);
                      
                      // Converter geometria para formato do Leaflet [lat, lon]
                      const coords = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
                      setRouteCoords(coords);
                  }
              } catch (error) {
                  console.error("Erro ao calcular rota:", error);
                  // Fallback para linha reta se falhar
                  setRouteCoords([
                      [pickupLocation.lat, pickupLocation.lon], 
                      [destLocation.lat, destLocation.lon]
                  ]);
              } finally {
                  setCalculatingRoute(false);
              }
          } else {
              setRouteCoords([]);
              setRouteDistance(0);
          }
      };
      
      calculateRoute();
  }, [pickupLocation, destLocation]);

  useEffect(() => {
    if (ride) {
      if (ride.status === 'CANCELLED') setStep('cancelled');
      else if (ride.status === 'COMPLETED') setStep('rating');
      else if (['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) setStep('waiting');

      if (ride.status === 'ARRIVED') setShowArrivalPopup(true); else setShowArrivalPopup(false);
      if (ride.status === 'IN_PROGRESS') setShowStartPopup(true); else setShowStartPopup(false);

    } else {
      if (step !== 'search') setStep('search');
      setShowArrivalPopup(false);
      setShowStartPopup(false);
    }
  }, [ride]);

  const fetchInitialData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return; 

        // Busca Perfil
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single(); 
        if (profile) setUserProfile(profile); 

        if (activeTab === 'home') {
            const { data: cats } = await supabase.from('car_categories').select('*').eq('active', true).order('base_fare', { ascending: true });
            
            if (cats && cats.length > 0) {
                const sortedCats = cats.sort((a, b) => {
                    if (a.name === 'Gold Driver') return -1;
                    if (b.name === 'Gold Driver') return 1;
                    return a.base_fare - b.base_fare;
                });
                setCategories(sortedCats); 
                if (!selectedCategoryId) setSelectedCategoryId(sortedCats[0].id);
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
            
            const newSettings = {
                enableCash: cash ? cash.value : true,
                enableWallet: wallet ? wallet.value : true
            };
            setAppSettings(newSettings);
            
            if (!newSettings.enableWallet && newSettings.enableCash) setPaymentMethod('CASH');
            else if (newSettings.enableWallet) setPaymentMethod('WALLET');
        } 
        
        if (activeTab === 'history') {
            const { data: history } = await supabase.from('rides')
                .select(`*, driver:profiles!public_rides_driver_id_fkey(first_name, last_name, car_model, car_plate)`)
                .eq('customer_id', user.id)
                .order('created_at', { ascending: false });
            setHistoryItems(history || []);
        }
    } catch (error) {
        console.error("Erro fetch:", error);
    } finally {
        setLoadingCats(false);
    }
  };

  const handleTabChange = (tab: string) => {
      if (tab === 'profile') navigate('/profile');
      else if (tab === 'wallet') navigate('/wallet');
      else setActiveTab(tab);
  };

  const handleRequest = () => { if (!pickupLocation || !destLocation) { showError("Preencha origem e destino"); return; } setStep('confirm'); };

  // --- LÓGICA DE PREÇO HÍBRIDA (REAL) ---
  const calculatePrice = (catId?: string) => {
      const targetCatId = catId || selectedCategoryId;
      const category = categories.find(c => c.id === targetCatId);
      
      // Usa a distância real calculada pela API
      const distanceKm = routeDistance;
      
      if (!category || distanceKm <= 0) return 0;

      let finalPrice = 0;
      
      if (category.name === 'Gold Driver') {
          // Tabela Fixa
          const tier = pricingTiers.find(t => t.max_distance >= distanceKm);
          if (tier) {
              finalPrice = Number(tier.price);
          } else {
              const maxTier = pricingTiers[pricingTiers.length - 1];
              if (maxTier) finalPrice = Number(maxTier.price);
              else finalPrice = 15; // Fallback
          }
      } else {
          // Dinâmico: Base + (KM * Custo)
          const baseFare = Number(category.base_fare || 0);
          const costPerKm = Number(category.cost_per_km || 0);
          const minFare = Number(category.min_fare || 0);
          
          finalPrice = baseFare + (distanceKm * costPerKm);
          if (finalPrice < minFare) finalPrice = minFare;
      }
      
      // Taxa Noturna
      if (adminConfig.night_active === 'true') {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const parseTime = (timeStr: string) => { if(!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
          const nowMinutes = currentHour * 60 + currentMinute;
          const startNight = adminConfig.night_start ? parseTime(adminConfig.night_start) : 21 * 60;
          
          if (nowMinutes >= startNight || currentHour < 5) {
              finalPrice += Number(adminConfig.night_increase || 0);
          }
          if (currentHour >= 0 && currentHour < 5) {
               const minMidnight = Number(adminConfig.midnight_min_price || 0);
               if (finalPrice < minMidnight) finalPrice = minMidnight;
          }
      }

      return parseFloat(finalPrice.toFixed(2));
  };

  const currentPrice = calculatePrice(selectedCategoryId);
  const isSinglePaymentMethod = (appSettings.enableCash && !appSettings.enableWallet) || (!appSettings.enableCash && appSettings.enableWallet);

  const confirmRide = async () => {
    if (isRequesting) return;
    const cat = categories.find(c => c.id === selectedCategoryId);
    if (!pickupLocation || !destLocation || !cat) return;
    
    // Verificação de saldo só se for WALLET
    if (paymentMethod === 'WALLET' && (userProfile?.balance || 0) < currentPrice) { 
        setMissingAmount(currentPrice - (userProfile?.balance || 0)); 
        setShowBalanceAlert(true); 
        return; 
    }

    setIsRequesting(true);
    try { 
        // Envia endereço completo e distância real formatada
        await requestRide(
            pickupLocation.address, 
            destLocation.address, 
            currentPrice, 
            `${routeDistance.toFixed(1)} km`, 
            cat.name, 
            paymentMethod
        ); 
    } 
    catch (e: any) { showError(e.message); } 
    finally { setIsRequesting(false); }
  };

  // Pega localização GPS do navegador
  const getCurrentLocation = () => {
      setGpsLoading(true);
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
              async (pos) => {
                  try {
                      // Reverse Geocoding para pegar o nome da rua
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                      const data = await res.json();
                      const address = data.address.road || "Minha Localização Atual";
                      
                      setPickupLocation({
                          lat: pos.coords.latitude,
                          lon: pos.coords.longitude,
                          address: address
                      });
                      showSuccess("Localização encontrada!");
                  } catch (e) {
                      setPickupLocation({
                          lat: pos.coords.latitude,
                          lon: pos.coords.longitude,
                          address: "Localização GPS"
                      });
                  } finally {
                      setGpsLoading(false);
                  }
              }, 
              (error) => {
                  setGpsLoading(false);
                  console.error("GPS Error:", error);
                  let msg = "Erro ao obter GPS";
                  if (error.code === 1) msg = "Permissão de GPS negada. Ative nas configurações do navegador.";
                  else if (error.code === 2) msg = "Sinal de GPS indisponível.";
                  else if (error.code === 3) msg = "Tempo limite do GPS esgotado.";
                  showError(msg);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
      } else {
          setGpsLoading(false);
          showError("GPS não suportado neste navegador");
      }
  };

  const cardBaseClasses = "bg-white/90 backdrop-blur-xl border border-white/40 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom duration-500 w-full";

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans bg-gray-100">
      
      {/* MAPA DE FUNDO ATUALIZADO */}
      <div className="absolute inset-0 z-0">
         <MapComponent 
            pickupLocation={pickupLocation} 
            destinationLocation={destLocation}
            routeCoordinates={routeCoords}
         />
      </div>

      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-white/20 p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg animate-in slide-in-from-top duration-500 cursor-pointer hover:scale-105 transition-transform" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 ring-2 ring-gray-100">
                 <AvatarImage src={userProfile?.avatar_url} />
                 <AvatarFallback className="bg-yellow-500 text-black font-bold">{userProfile?.first_name?.[0]}</AvatarFallback>
             </Avatar>
             <div>
                 <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Olá,</p>
                 <p className="text-sm text-slate-900 font-black leading-none">{userProfile?.first_name}</p>
             </div>
          </div>

          {appSettings.enableWallet && (
              <div className="pointer-events-auto bg-black text-white px-4 py-2.5 rounded-full flex items-center gap-2 shadow-xl animate-in slide-in-from-top duration-500 delay-100 cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => navigate('/wallet')}>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-bold text-sm tracking-tight">R$ {userProfile?.balance?.toFixed(2) || '0.00'}</span>
              </div>
          )}
      </div>

      {/* CONTAINER PRINCIPAL DINÂMICO - Centraliza ou vai p/ fundo */}
      <div 
        className={`absolute inset-0 z-10 flex flex-col items-center p-4 transition-all duration-700 pointer-events-none ${
            step === 'search' 
            ? 'justify-center bg-black/10 backdrop-blur-sm' 
            : 'justify-end pb-32 md:pb-10 md:justify-center'
        }`}
      >
        
        {activeTab === 'home' && (
            <div className="w-full max-w-md pointer-events-auto transition-all duration-500">
                {/* SEARCH REAL */}
                {step === 'search' && (
                    <div className={`${cardBaseClasses} shadow-[0_20px_50px_rgba(0,0,0,0.2)]`}>
                        <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Para onde vamos?</h2>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <LocationSearch 
                                    placeholder="Local de embarque" 
                                    icon={Navigation}
                                    initialValue={pickupLocation?.address}
                                    onSelect={(item) => setPickupLocation({ lat: item.lat, lon: item.lon, address: item.display_name.split(',')[0] })}
                                    className="flex-1"
                                />
                                <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" onClick={getCurrentLocation} disabled={gpsLoading}>
                                    {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                                </Button>
                            </div>

                            <div className="relative group">
                                <div className="absolute left-[27px] -top-6 w-0.5 h-8 bg-gray-300 z-0"></div>
                                <LocationSearch 
                                    placeholder="Digite o destino..." 
                                    initialValue={destLocation?.address}
                                    onSelect={(item) => setDestLocation({ lat: item.lat, lon: item.lon, address: item.display_name.split(',')[0] })}
                                />
                            </div>
                        </div>

                        {calculatingRoute && (
                            <div className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> Calculando melhor rota...
                            </div>
                        )}

                        <Button 
                            className="w-full mt-6 h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800 shadow-xl shadow-black/10 transition-transform active:scale-95" 
                            onClick={handleRequest} 
                            disabled={!pickupLocation || !destLocation || calculatingRoute}
                        >
                            Continuar <ChevronRight className="ml-2 w-5 h-5 opacity-50" />
                        </Button>
                    </div>
                )}

                {/* CONFIRM */}
                {step === 'confirm' && (
                    <div className={cardBaseClasses}>
                        <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setStep('search')}>
                            <div className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><ArrowLeft className="w-5 h-5 text-slate-900" /></div>
                            <h2 className="text-xl font-bold text-slate-900">Escolha a Categoria</h2>
                        </div>
                        
                        {/* Resumo da Rota */}
                        <div className="flex justify-between items-center mb-4 px-2">
                             <Badge variant="outline" className="text-xs bg-white">{routeDistance.toFixed(1)} km</Badge>
                             <span className="text-xs text-gray-400">Tempo est: {(routeDistance * 2).toFixed(0)} min</span>
                        </div>

                        {loadingCats ? <div className="py-10 text-center flex flex-col items-center gap-3"><Loader2 className="animate-spin text-yellow-500 w-8 h-8" /><p className="text-gray-400 text-sm">Buscando categorias...</p></div> : 
                         categories.length === 0 ? <div className="py-10 text-center"><p className="text-red-500 font-bold">Nenhuma categoria disponível.</p></div> : 
                        (
                            <div className="space-y-3 mb-4 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                                {categories.map((cat) => (
                                    <div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden group ${selectedCategoryId === cat.id ? 'border-yellow-500 bg-yellow-50/50 shadow-md' : 'border-transparent bg-gray-50 hover:bg-white'}`}>
                                        <div className="flex items-center gap-4 z-10">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedCategoryId === cat.id ? 'bg-yellow-500 text-black' : 'bg-white text-gray-500'}`}><Car className="w-6 h-6" /></div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-lg text-slate-900">{cat.name}</h4>
                                                    {cat.name === 'Gold Driver' && <Badge className="text-[10px] bg-yellow-500 text-black border-0 px-1.5 py-0">FIXO</Badge>}
                                                </div>
                                                <p className="text-xs text-gray-500 font-medium">{cat.description}</p>
                                            </div>
                                        </div>
                                        <span className="font-black text-lg text-slate-900 z-10">R$ {calculatePrice(cat.id).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagamento Seletor (Condicional) */}
                        <div 
                            className={`mb-4 bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center justify-center transition-colors ${!isSinglePaymentMethod ? 'cursor-pointer hover:bg-white' : ''}`}
                            onClick={() => {
                                if (!isSinglePaymentMethod) {
                                    setPaymentMethod(prev => prev === 'WALLET' ? 'CASH' : 'WALLET');
                                }
                            }}
                        >
                             <div className="flex items-center gap-3 w-full justify-between">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center">
                                         {paymentMethod === 'WALLET' ? <Wallet className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
                                     </div>
                                     <div className="text-left">
                                         <p className="text-xs text-gray-400 font-bold uppercase">Pagamento</p>
                                         <p className="font-bold text-slate-900">{paymentMethod === 'WALLET' ? 'Saldo da Carteira' : 'Dinheiro / PIX'}</p>
                                     </div>
                                 </div>
                                 {/* Só mostra botão de trocar se ambos estiverem ativos */}
                                 {!isSinglePaymentMethod && (
                                     <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Trocar</div>
                                 )}
                             </div>
                        </div>

                        <Button className="w-full h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800" onClick={confirmRide} disabled={!selectedCategoryId || isRequesting || loadingCats}>{isRequesting ? <Loader2 className="animate-spin" /> : "Confirmar Gold Mobile"}</Button>
                    </div>
                )}

                {/* STATUS */}
                {step === 'waiting' && (
                     <div className={`${cardBaseClasses} text-center`}>
                         {ride?.status === 'ACCEPTED' || ride?.status === 'IN_PROGRESS' || ride?.status === 'ARRIVED' ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                    <div className="relative"><Avatar className="w-16 h-16 border-2 border-yellow-500"><AvatarImage src={ride.driver_details?.avatar_url} /><AvatarFallback>{ride.driver_details?.name?.[0]}</AvatarFallback></Avatar><div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><Star className="w-2 h-2 fill-black" /> {ride.driver_details?.rating?.toFixed(1)}</div></div>
                                    <div className="text-left flex-1"><h3 className="font-black text-xl text-slate-900 leading-tight">{ride.driver_details?.name}</h3><p className="text-sm text-gray-500">{ride.driver_details?.car_model} • {ride.driver_details?.car_color}</p><div className="bg-slate-900 text-white text-xs font-mono font-bold px-2 py-1 rounded-md inline-block mt-2">{ride.driver_details?.car_plate}</div></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4"><div className="bg-blue-50 p-3 rounded-2xl text-center"><p className="text-xs text-blue-600 font-bold uppercase mb-1">Status</p><p className="font-black text-blue-900">{ride.status === 'ARRIVED' ? 'Chegou!' : ride.status === 'IN_PROGRESS' ? 'Em Viagem' : 'A Caminho'}</p></div><div className="bg-gray-50 p-3 rounded-2xl text-center"><p className="text-xs text-gray-500 font-bold uppercase mb-1">Chegada</p><p className="font-black text-gray-900">{ride.status === 'ACCEPTED' ? '2 min' : '--'}</p></div></div>
                                
                                {/* BOTÃO DE CHAT EMBUTIDO */}
                                <div 
                                    className="bg-gray-100 hover:bg-gray-200 p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors"
                                    onClick={() => setShowChat(true)}
                                >
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-sm">
                                        <MessageCircle className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Mensagem para motorista</p>
                                        <p className="text-sm font-medium text-slate-900">Enviar mensagem...</p>
                                    </div>
                                </div>

                                {ride?.status !== 'IN_PROGRESS' && (
                                    <div className="pt-2">
                                        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-bold w-full rounded-xl" onClick={() => setShowCancelAlert(true)}>
                                            Cancelar Corrida
                                        </Button>
                                    </div>
                                )}
                            </div>
                         ) : (
                            <div className="py-8"><div className="w-24 h-24 bg-yellow-50 rounded-full mx-auto flex items-center justify-center mb-6 relative"><div className="absolute inset-0 border-4 border-yellow-500 rounded-full animate-ping opacity-20"></div><Loader2 className="w-10 h-10 text-yellow-600 animate-spin" /></div><h3 className="text-2xl font-black text-slate-900 mb-2">Buscando Motorista...</h3><p className="text-gray-500 mb-8">Estamos encontrando o parceiro ideal para você.</p><Button variant="secondary" className="w-full rounded-2xl h-12 font-bold" onClick={() => setShowCancelAlert(true)}>Cancelar</Button></div>
                         )}
                     </div>
                )}
                
                {/* RATING */}
                {step === 'rating' && (
                     <div className={`${cardBaseClasses} text-center`}>
                         <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6"><User className="w-10 h-10 text-green-600" /></div>
                         <h2 className="text-2xl font-black text-slate-900 mb-2">Chegamos!</h2>
                         <p className="text-gray-500 mb-6">Como foi sua experiência?</p>
                         <div className="flex justify-center gap-2 mb-6">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-125 focus:outline-none"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} /></button>))}</div>
                         <div className="mb-6 text-left">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Observação (Opcional)</label>
                            <Textarea 
                                placeholder="O carro estava limpo? O motorista foi educado?" 
                                className="bg-gray-50 border-gray-100 rounded-2xl resize-none mt-1" 
                                value={ratingComment}
                                onChange={e => setRatingComment(e.target.value)}
                            />
                         </div>
                         <Button className="w-full h-14 text-lg font-bold bg-black text-white rounded-2xl hover:bg-zinc-800" onClick={() => { rateRide(ride!.id, rating || 5, false, ratingComment); setStep('search'); setRatingComment(""); setRating(0); }}>Enviar Avaliação</Button>
                     </div>
                )}

                {/* CANCELLED */}
                {step === 'cancelled' && (
                     <div className={`${cardBaseClasses} text-center`}><div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-6"><XCircle className="w-10 h-10 text-red-600" /></div><h2 className="text-2xl font-black text-slate-900 mb-2">Cancelado</h2><p className="text-gray-500 mb-8">A corrida foi cancelada.</p><Button className="w-full h-14 text-lg font-bold bg-black text-white rounded-2xl hover:bg-zinc-800" onClick={() => { clearRide(); setStep('search'); }}>Voltar</Button></div>
                )}
            </div>
        )}
        
        {/* VIEW: HISTÓRICO (AGORA UM CARD FLUTUANTE) */}
        {activeTab === 'history' && (
            <div className={`w-full max-w-md pointer-events-auto h-[60vh] flex flex-col ${cardBaseClasses}`}>
                <h2 className="text-2xl font-black text-slate-900 mb-4 flex items-center gap-2">
                    <History className="w-6 h-6" /> Suas Viagens
                </h2>
                <ScrollArea className="flex-1 -mr-4 pr-4 custom-scrollbar">
                    {historyItems.length === 0 ? <p className="text-center text-gray-400 py-10">Nenhuma viagem realizada.</p> : 
                    historyItems.map(item => (
                        <div key={item.id} onClick={() => setSelectedHistoryItem(item)} className="mb-3 p-4 bg-white/50 border border-white/60 rounded-2xl hover:bg-white hover:scale-[1.02] transition-all cursor-pointer shadow-sm">
                            <div className="flex justify-between mb-1">
                                <span className="font-bold text-sm text-slate-900">{new Date(item.created_at).toLocaleDateString()}</span>
                                <Badge variant="outline" className={`h-5 text-[10px] ${item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.status}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-gray-500" /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate text-sm text-slate-900">{item.destination_address}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • R$ {Number(item.price).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </div>
        )}
      </div>

      {/* POPUP: MOTORISTA CHEGOU */}
      <Dialog open={showArrivalPopup} onOpenChange={setShowArrivalPopup}>
          <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-[40px] p-0 overflow-hidden">
              <div className="bg-yellow-400 h-32 relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/5 pattern-dots" />
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
                      <BellRing className="w-10 h-10 text-black fill-black" />
                  </div>
              </div>
              <div className="px-8 pb-8 pt-4 text-center">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">Motorista Chegou!</h2>
                  <p className="text-gray-500 mb-6 text-lg">Seu motorista está aguardando no local de embarque.</p>
                  
                  <div className="bg-gray-50 p-4 rounded-3xl flex items-center gap-4 mb-6 text-left border border-gray-100">
                       <Avatar className="w-14 h-14 border-2 border-white shadow-sm"><AvatarImage src={ride?.driver_details?.avatar_url} /><AvatarFallback>M</AvatarFallback></Avatar>
                       <div>
                           <p className="font-bold text-lg text-slate-900">{ride?.driver_details?.name}</p>
                           <p className="text-sm text-gray-500">{ride?.driver_details?.car_model} • {ride?.driver_details?.car_plate}</p>
                       </div>
                  </div>
                  
                  <Button className="w-full h-14 rounded-2xl text-lg font-bold bg-black text-white hover:bg-zinc-800" onClick={() => setShowArrivalPopup(false)}>Estou indo!</Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* POPUP: CORRIDA INICIADA */}
      <Dialog open={showStartPopup} onOpenChange={setShowStartPopup}>
          <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-[40px] p-8 text-center">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                  <Flag className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Corrida Iniciada</h2>
              <p className="text-gray-500">Aproveite sua viagem com conforto e segurança.</p>
          </DialogContent>
      </Dialog>

      {/* MODAIS GERAIS */}
      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}><DialogContent className="sm:max-w-md bg-white rounded-3xl border-0"><DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><Wallet /> Saldo Insuficiente</DialogTitle></DialogHeader><div className="text-center py-6"><p className="text-gray-500 mb-1">Faltam</p><h2 className="text-5xl font-black text-slate-900">R$ {missingAmount.toFixed(2)}</h2></div><DialogFooter><Button className="w-full rounded-xl h-12 font-bold bg-black text-white" onClick={() => navigate('/wallet')}>Recarregar Agora</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}><AlertDialogContent className="rounded-3xl bg-white border-0"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> Cancelar Corrida?</AlertDialogTitle><AlertDialogDescription>Deseja realmente cancelar? Uma taxa pode ser cobrada.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl h-12">Voltar</AlertDialogCancel><AlertDialogAction onClick={() => { cancelRide(ride!.id); setShowCancelAlert(false); }} className="bg-red-600 hover:bg-red-700 rounded-xl h-12 font-bold text-white">Sim, Cancelar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      {/* MODAL DETALHES HISTÓRICO */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={(o) => !o && setSelectedHistoryItem(null)}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0">
              <DialogHeader><DialogTitle>Detalhes da Viagem</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                      <div className="flex items-start gap-3"><div className="w-2 h-2 mt-2 bg-slate-900 rounded-full"/><div><p className="text-xs text-gray-400 uppercase font-bold">Origem</p><p className="font-medium text-slate-900">{selectedHistoryItem?.pickup_address}</p></div></div>
                      <div className="h-4 border-l-2 border-dashed border-gray-200 ml-1"></div>
                      <div className="flex items-start gap-3"><div className="w-2 h-2 mt-2 bg-yellow-500 rounded-full"/><div><p className="text-xs text-gray-400 uppercase font-bold">Destino</p><p className="font-medium text-slate-900">{selectedHistoryItem?.destination_address}</p></div></div>
                  </div>
                  {selectedHistoryItem?.driver && (
                      <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
                          <Avatar><AvatarFallback>{selectedHistoryItem.driver.first_name?.[0]}</AvatarFallback></Avatar>
                          <div><p className="font-bold text-slate-900">{selectedHistoryItem.driver.first_name} {selectedHistoryItem.driver.last_name}</p><p className="text-xs text-gray-500">{selectedHistoryItem.driver.car_model} • {selectedHistoryItem.driver.car_plate}</p></div>
                      </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <div className="text-left">
                          <p className="text-xs text-gray-500 font-bold uppercase">Data/Hora</p>
                          <p className="text-sm font-medium text-slate-900">{selectedHistoryItem ? new Date(selectedHistoryItem.created_at).toLocaleString('pt-BR') : '--'}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-xs text-gray-500 font-bold uppercase">Total Pago</p>
                          <span className="font-black text-2xl text-slate-900">R$ {Number(selectedHistoryItem?.price).toFixed(2)}</span>
                      </div>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* CHAT FLUTUANTE */}
      {showChat && ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status) && currentUserId && (
          <RideChat 
            rideId={ride.id} 
            currentUserId={currentUserId} 
            role="client"
            otherUserName={ride.driver_details?.name || 'Motorista'}
            otherUserAvatar={ride.driver_details?.avatar_url}
            onClose={() => setShowChat(false)}
          />
      )}
      
      <div className="relative z-[100]">
         <FloatingDock activeTab={activeTab} onTabChange={handleTabChange} role="client" />
      </div>
    </div>
  );
};

export default ClientDashboard;