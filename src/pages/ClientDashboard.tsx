"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import GoogleMapComponent from "@/components/GoogleMapComponent";
import { 
  MapPin, Car, Loader2, Star, ChevronRight, Clock, Wallet, ArrowLeft, History, MessageCircle, CheckCircle2, AlertTriangle, Banknote, XCircle, Ticket, Plus, X, Search, MousePointer2, Gift, Phone, Flag, User, ArrowRight, Navigation, LocateFixed, SearchCode, Map as MapIcon, ShieldAlert, Home, Briefcase, Share2, Info, StickyNote, SeparatorHorizontal, TrendingUp, Map as MapView
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import FloatingDock from "@/components/FloatingDock";
import RideChat from "@/components/RideChat";
import GoogleLocationSearch from "@/components/GoogleLocationSearch";
import { cn } from "@/lib/utils";

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ride, loading: rideLoading, requestRide, cancelRide, rateRide, clearRide, currentUserId, unlockAudio } = useRide();
  
  const [activeTab, setActiveTab] = useState("home");
  const [step, setStep] = useState<'search' | 'confirm' | 'waiting' | 'active' | 'rating'>('search');
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSearchingFull, setIsSearchingFull] = useState(false);
  
  // Estados para localização
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [stops, setStops] = useState<any[]>([]); 
  const [rideNotes, setRideNotes] = useState("");

  // Modo Seleção no Mapa
  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination' | null>(null);
  const [isReversingGeocode, setIsReversingGeocode] = useState(false);

  const [routeDistance, setRouteDistance] = useState<number>(0); 
  const [routeDuration, setRouteDuration] = useState<number>(0); 
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'CASH'>('CASH');
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [missingAmount, setMissingAmount] = useState(0);

  const [globalMultiplier, setGlobalMultiplier] = useState(1.0);
  const [costPerStop, setCostPerStop] = useState(2.50);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState({ enableCash: true, enableWallet: true });
  const [categoryRules, setCategoryRules] = useState<Record<string, any>>({});
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [rating, setRating] = useState(0);

  const dataFetched = useRef(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const getCurrentLocation = useCallback((silent = false) => {
      if (!silent) setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ 
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude } 
          }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                  setPickupLocation({ 
                      lat: pos.coords.latitude, 
                      lon: pos.coords.longitude, 
                      display_name: results[0].formatted_address 
                  });
                  if (!silent) showSuccess("Sua localização atualizada!");
              }
              setGpsLoading(false);
          });
      }, (error) => { 
          setGpsLoading(false); 
          if (!silent) showError("Ative a localização.");
      }, { enableHighAccuracy: true, timeout: 5000 });
  }, []);

  // Lógica de Geocodificação Reversa (Coordenada -> Endereço)
  const handleMapClick = async (lat: number, lng: number) => {
    if (!mapSelectionMode) return;
    
    setIsReversingGeocode(true);
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setIsReversingGeocode(false);
        if (status === 'OK' && results?.[0]) {
            const address = results[0].formatted_address;
            const locationData = { lat, lon: lng, display_name: address };
            
            if (mapSelectionMode === 'pickup') {
                setPickupLocation(locationData);
            } else {
                setDestLocation(locationData);
            }
            
            setMapSelectionMode(null);
            setIsSearchingFull(true);
            showSuccess("Local definido pelo mapa!");
        } else {
            showError("Não foi possível identificar este endereço.");
        }
    });
  };

  useEffect(() => {
    if (dataFetched.current) return;
    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) { navigate('/login'); return; }
            
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); 
            if (profile) setUserProfile(profile); 
            
            const [catsRes, tiersRes, settingsRes, adminConfigRes] = await Promise.all([
                supabase.from('car_categories').select('*').eq('active', true).order('base_fare', { ascending: true }),
                supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true }),
                supabase.from('app_settings').select('*'),
                supabase.from('admin_config').select('*')
            ]);

            if (catsRes.data) {
                setCategories(catsRes.data); 
                if (catsRes.data.length > 0) setSelectedCategoryId(catsRes.data[0].id);
            }
            if (tiersRes.data) setPricingTiers(tiersRes.data);
            
            if (settingsRes.data) {
                const cash = settingsRes.data.find((s: any) => s.key === 'enable_cash');
                const wallet = settingsRes.data.find((s: any) => s.key === 'enable_wallet');
                setAppSettings({ enableCash: cash?.value ?? true, enableWallet: wallet?.value ?? true });
            }

            if (adminConfigRes.data) {
                const rules = adminConfigRes.data.find((c: any) => c.key === 'category_rules');
                if (rules && rules.value) {
                    try { setCategoryRules(JSON.parse(rules.value)); } catch(e) {}
                }
                const multRes = adminConfigRes.data.find((c: any) => c.key === 'global_multiplier');
                if (multRes && multRes.value) setGlobalMultiplier(Number(multRes.value) || 1.0);

                const stopRes = adminConfigRes.data.find((c: any) => c.key === 'cost_per_stop');
                if (stopRes && stopRes.value) setCostPerStop(Number(stopRes.value) || 2.50);
            }

            getCurrentLocation(true);

            dataFetched.current = true;
            setIsInitialSync(false);
        } catch (error) { 
            setIsInitialSync(false);
        }
    };
    fetchInitialData();
  }, [navigate, getCurrentLocation]);

  useEffect(() => {
    if (activeTab === 'history' && userProfile?.id) {
        const fetchHistory = async () => {
            const { data } = await supabase.from('rides')
                .select(`*, driver:profiles!public_rides_driver_id_fkey(*)`)
                .eq('customer_id', userProfile.id)
                .order('created_at', { ascending: false });
            if (data) setHistoryItems(data);
        };
        fetchHistory();
    }
  }, [activeTab, userProfile?.id]);

  useEffect(() => {
    if (rideLoading || isInitialSync) return;

    if (ride) {
      if (ride.status === 'SEARCHING') setStep('waiting');
      else if (['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status)) setStep('active');
      else if (ride.status === 'COMPLETED') setStep('rating');
      else if (ride.status === 'CANCELLED') setStep('search');
    } else {
      if (!isRequesting) setStep('search');
    }
  }, [ride, rideLoading, isInitialSync, isRequesting]);

  useEffect(() => {
    if (pickupLocation && destLocation && step === 'confirm') {
        setCalculatingRoute(true);
        const service = new google.maps.DirectionsService();
        
        const validStops = stops.filter(s => s && s.lat && s.lon);
        const waypoints = validStops.map(s => ({
            location: { lat: s.lat, lng: s.lon },
            stopover: true
        }));

        service.route({
            origin: { lat: pickupLocation.lat, lng: pickupLocation.lon },
            destination: { lat: destLocation.lat, lng: destLocation.lon },
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: true,
            drivingOptions: {
                departureTime: new Date(),
                trafficModel: google.maps.TrafficModel.BEST_GUESS
            }
        }, (result, status) => {
            if (status === 'OK' && result) {
                let totalDist = 0;
                let totalDur = 0;
                result.routes[0].legs.forEach(leg => {
                    totalDist += leg.distance?.value || 0;
                    totalDur += leg.duration?.value || 0;
                });
                setRouteDistance(totalDist / 1000);
                setRouteDuration(totalDur / 60);
            } else {
                showError("Localização inacessível para veículos.");
                setStep('search');
            }
            setCalculatingRoute(false);
        });
    }
  }, [pickupLocation, destLocation, stops, step]);

  const applyCoupon = async () => {
      setApplyingCoupon(true);
      try {
          const { data, error } = await supabase.from('coupons').select('*').eq('code', couponCode.toUpperCase()).eq('active', true).maybeSingle();
          if (error || !data) throw new Error("Cupom inválido ou expirado.");
          if (data.current_uses >= data.max_uses) throw new Error("Cupom esgotado.");
          setAppliedCoupon(data);
          showSuccess("Cupom aplicado!");
      } catch (e: any) {
          showError(e.message);
          setAppliedCoupon(null);
      } finally {
          setApplyingCoupon(false);
      }
  };

  const calculatePriceDetails = useCallback((catId?: string) => {
      const category = categories.find(c => c.id === (catId || selectedCategoryId));
      if (!category || routeDistance <= 0) return { total: 0, base: 0, km: 0, time: 0, stops: 0, multiplier: 1 };
      
      let price = 0;
      let baseFare = Number(category.base_fare);
      let kmPrice = 0;
      let timePrice = 0;
      let stopsPrice = 0;

      if (category.name === 'Gold Driver' && pricingTiers.length > 0) {
          const tier = pricingTiers.find(t => routeDistance <= Number(t.max_distance)) || pricingTiers[pricingTiers.length - 1];
          price = Number(tier?.price || 15);
          baseFare = price;
      } else {
          const rules = categoryRules[category.name] || {};
          let isNight = false;
          let nightKmPrice = 0;

          const checkNightPeriod = (startStr: string, endStr: string, kmVal: any) => {
              if (!startStr || !endStr || !kmVal) return false;
              const currentHour = new Date().getHours();
              const currentMinute = new Date().getMinutes();
              const currentTime = currentHour + (currentMinute / 60);
              const startParts = startStr.split(':');
              const endParts = endStr.split(':');
              const start = parseInt(startParts[0]) + parseInt(startParts[1]) / 60;
              const end = parseInt(endParts[0]) + parseInt(endParts[1]) / 60;
              return start > end ? (currentTime >= start || currentTime <= end) : (currentTime >= start && currentTime <= end);
          };

          if (checkNightPeriod(rules.night_start_2, rules.night_end_2, rules.night_km_2)) {
              isNight = true;
              nightKmPrice = Number(rules.night_km_2);
          } else if (checkNightPeriod(rules.night_start, rules.night_end, rules.night_km)) {
              isNight = true;
              nightKmPrice = Number(rules.night_km);
          }

          let appliedKmPrice = Number(category.cost_per_km);
          const costPerMinute = Number(category.cost_per_minute || 0);
          
          if (isNight) {
              appliedKmPrice = nightKmPrice;
          } else {
              const dist1 = Number(rules.dist_1 || 0);
              const price1 = (rules.price_1 || rules.km_over_45) ? Number(rules.price_1 || rules.km_over_45) : null;
              const dist2 = Number(rules.dist_2 || 0);
              const price2 = (rules.price_2 || rules.km_over_10) ? Number(rules.price_2 || rules.km_over_10) : null;
              let thresholds = [];
              if (price1 !== null && dist1 > 0) thresholds.push({ dist: dist1, price: price1 });
              if (price2 !== null && dist2 > 0) thresholds.push({ dist: dist2, price: price2 });
              thresholds.sort((a, b) => b.dist - a.dist);
              for (const t of thresholds) { if (routeDistance >= t.dist) { appliedKmPrice = t.price; break; } }
          }

          kmPrice = routeDistance * appliedKmPrice;
          timePrice = routeDuration * costPerMinute;
          price = baseFare + kmPrice + timePrice;
      }

      const validStops = stops.filter(s => s && s.lat && s.lon);
      stopsPrice = validStops.length * costPerStop;
      price += stopsPrice;
      price = price * globalMultiplier;

      if (price < Number(category.min_fare)) price = Number(category.min_fare);

      if (appliedCoupon) {
          if (appliedCoupon.discount_type === 'PERCENTAGE') price = price - (price * (Number(appliedCoupon.discount_value) / 100));
          else price = price - Number(appliedCoupon.discount_value);
      }

      return {
          total: parseFloat(Math.max(price, 0).toFixed(2)),
          base: baseFare,
          km: kmPrice,
          time: timePrice,
          stops: stopsPrice,
          multiplier: globalMultiplier
      };
  }, [categories, pricingTiers, routeDistance, routeDuration, selectedCategoryId, categoryRules, globalMultiplier, appliedCoupon, stops, costPerStop]);

  const calculatePrice = (catId?: string) => calculatePriceDetails(catId).total;

  const confirmRide = async () => {
    if (isRequesting || !pickupLocation || !destLocation || !selectedCategoryId) return;
    const validStops = stops.filter(s => s && s.lat && s.lon);
    const price = calculatePrice();
    const category = categories.find(c => c.id === selectedCategoryId);
    if (paymentMethod === 'WALLET' && (userProfile?.balance || 0) < price) { 
        setMissingAmount(price - (userProfile?.balance || 0)); 
        setShowBalanceAlert(true); 
        return; 
    }
    setIsRequesting(true);
    try { 
        const success = await requestRide(
            pickupLocation.display_name, 
            destLocation.display_name, 
            { lat: pickupLocation.lat, lng: pickupLocation.lon }, 
            { lat: destLocation.lat, lng: destLocation.lon }, 
            price, 
            `${routeDistance.toFixed(1)} km`, 
            category.name, 
            paymentMethod,
            validStops,
            rideNotes
        ); 
        if (success) {
            showSuccess("Motorista solicitado!");
            if (appliedCoupon) await supabase.from('coupons').update({ current_uses: appliedCoupon.current_uses + 1 }).eq('id', appliedCoupon.id);
        } else setIsRequesting(false);
    } catch (e: any) { setIsRequesting(false); showError(e.message); }
  };

  const handleSOS = () => showError("🚨 ALERTA DE SEGURANÇA ENVIADO! Nossa central entrará em contato.");

  const handleFavoriteClick = (type: 'home' | 'work') => {
    if (!userProfile) return;
    const address = type === 'home' ? userProfile.home_address : userProfile.work_address;
    const lat = type === 'home' ? userProfile.home_lat : userProfile.work_lat;
    const lng = type === 'home' ? userProfile.home_lng : userProfile.work_lng;
    if (!address) { showError(`Você ainda não definiu o endereço de ${type === 'home' ? 'casa' : 'trabalho'}. Vá ao seu perfil para configurar.`); navigate('/profile'); return; }
    setDestLocation({ lat, lon: lng, display_name: address });
    setIsSearchingFull(false);
    unlockAudio();
    setStep('confirm');
  };

  const handleShareRoute = () => {
      if (navigator.share) {
          navigator.share({ title: 'Minha Viagem Gold', text: `Estou a caminho em um Gold! Acompanhe minha rota:`, url: window.location.href })
          .catch(console.error);
      } else showError("Compartilhamento não suportado neste navegador.");
  };

  if (isInitialSync) return <div className="h-screen w-full flex items-center justify-center bg-zinc-950"><Loader2 className="w-10 h-10 animate-spin text-yellow-500" /></div>;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-gray-100 font-sans text-slate-900 relative">
      <div className="absolute inset-0 z-0">
        <GoogleMapComponent 
            pickupLocation={step === 'confirm' || step === 'active' || mapSelectionMode === 'pickup' ? pickupLocation : null} 
            destinationLocation={step === 'confirm' || step === 'active' || mapSelectionMode === 'destination' ? destLocation : null} 
            driverLocation={ride?.driver_details?.current_lat ? { lat: ride.driver_details.current_lat, lon: ride.driver_details.current_lng } : null}
            stops={stops.length > 0 ? stops : null}
            onMapClick={handleMapClick}
            interactive={!!mapSelectionMode}
        />
      </div>

      <img src="/app-logo.png" alt="Gold" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-[100] drop-shadow-md rounded-lg" />
      
      {/* Overlay de Seleção no Mapa */}
      {mapSelectionMode && (
          <div className="absolute inset-0 z-[200] pointer-events-none flex flex-col">
              <div className="bg-slate-900/90 backdrop-blur-md p-6 text-white text-center pt-12 animate-in slide-in-from-top">
                  <h3 className="text-lg font-black uppercase tracking-widest">
                      {mapSelectionMode === 'pickup' ? 'Toque no local de embarque' : 'Toque no local de destino'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Toque no mapa para selecionar o ponto exato.</p>
              </div>
              <div className="flex-1 flex items-center justify-center">
                  <div className="relative mb-10 animate-bounce">
                      <MapPin className={cn("w-12 h-12 stroke-[3px]", mapSelectionMode === 'pickup' ? "text-green-500" : "text-red-500")} />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 rounded-full blur-[2px]" />
                  </div>
              </div>
              <div className="p-6 bg-white/10 backdrop-blur-sm pointer-events-auto flex justify-center">
                  <Button 
                    className="h-14 px-10 rounded-2xl bg-white text-black font-black shadow-2xl hover:bg-slate-100"
                    onClick={() => { setMapSelectionMode(null); setIsSearchingFull(true); }}
                  >
                      VOLTAR PARA BUSCA
                  </Button>
              </div>
              {isReversingGeocode && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-[210]">
                      <div className="bg-white p-6 rounded-3xl flex flex-col items-center gap-3 shadow-2xl">
                          <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">Identificando local...</p>
                      </div>
                  </div>
              )}
          </div>
      )}

      <div className="absolute top-4 left-4 z-20">
          <Button variant="ghost" size="icon" className="bg-white/80 backdrop-blur-xl h-10 w-10 rounded-xl shadow-lg border border-white/20" onClick={() => navigate('/profile')}>
              <User className="h-5 w-5 text-slate-700" />
          </Button>
      </div>

      {step === 'active' && (
          <div className="absolute top-24 right-4 z-20 flex flex-col gap-3">
              <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full shadow-2xl animate-pulse border-4 border-white" onClick={handleSOS}><ShieldAlert className="w-6 h-6" /></Button>
              <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-2xl bg-white border-4 border-white" onClick={handleShareRoute}><Share2 className="w-5 h-5 text-blue-600" /></Button>
          </div>
      )}

      {activeTab === 'home' && step === 'search' && !isSearchingFull && !mapSelectionMode && (
          <div className="absolute bottom-32 left-4 right-4 z-20 pointer-events-auto max-w-md mx-auto animate-in slide-in-from-bottom-10">
              <div className="bg-white rounded-[32px] p-2 shadow-2xl shadow-black/20 border border-slate-100 flex items-center">
                  <button onClick={() => setIsSearchingFull(true)} className="flex-1 h-14 flex items-center px-6 gap-4 text-left">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                      <span className="text-slate-400 font-black text-lg">Para onde vamos?</span>
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => getCurrentLocation()} className="h-14 w-14 rounded-full text-slate-400">{gpsLoading ? <Loader2 className="animate-spin" /> : <LocateFixed className="w-6 h-6" />}</Button>
              </div>
              <div className="flex gap-2 mt-4 justify-center">
                  <button onClick={() => handleFavoriteClick('home')} className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/20 flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-white transition-colors"><Home className="w-3 h-3 text-blue-500" /> Casa</button>
                  <button onClick={() => handleFavoriteClick('work')} className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/20 flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-white transition-colors"><Briefcase className="w-3 h-3 text-yellow-600" /> Trabalho</button>
              </div>
          </div>
      )}

      {activeTab === 'home' && step === 'search' && isSearchingFull && !mapSelectionMode && (
          <div className="absolute inset-0 z-[150] bg-white pointer-events-auto flex flex-col animate-in fade-in duration-300">
              <div className="p-4 pt-12 space-y-4">
                  <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" onClick={() => setIsSearchingFull(false)}><ArrowLeft className="w-6 h-6" /></Button>
                      <h2 className="text-2xl font-black text-slate-900">Configure sua viagem</h2>
                  </div>
                  <div className="space-y-3 relative">
                      <div className="absolute left-[34px] top-10 bottom-10 w-0.5 bg-slate-100 -z-10" />
                      
                      <div className="flex gap-2 items-center">
                        <div className="w-10 flex justify-center shrink-0"><div className="w-3 h-3 rounded-full bg-blue-500" /></div>
                        <GoogleLocationSearch placeholder="Local de embarque" onSelect={setPickupLocation} initialValue={pickupLocation?.display_name} className="flex-1" />
                        <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-500" onClick={() => { setIsSearchingFull(false); setMapSelectionMode('pickup'); }}><MapView className="w-5 h-5" /></Button>
                      </div>

                      {stops.map((stop, index) => (
                          <div key={index} className="flex gap-2 items-center animate-in slide-in-from-left">
                              <div className="w-10 flex justify-center shrink-0"><div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white" /></div>
                              <GoogleLocationSearch placeholder={`Parada ${index + 1}`} onSelect={(l) => { const newStops = [...stops]; newStops[index] = l; setStops(newStops); }} initialValue={stop?.display_name} className="flex-1" />
                              <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400" onClick={() => { const newStops = [...stops]; newStops.splice(index, 1); setStops(newStops); }}><X className="w-4 h-4" /></Button>
                          </div>
                      ))}

                      <div className="flex gap-2 items-center">
                          <div className="w-10 flex justify-center shrink-0"><div className="w-3 h-3 bg-yellow-500 rounded-sm" /></div>
                          <GoogleLocationSearch placeholder="Seu destino final" onSelect={setDestLocation} initialValue={destLocation?.display_name} className="flex-1" />
                          <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-500" onClick={() => { setIsSearchingFull(false); setMapSelectionMode('destination'); }}><MapView className="w-5 h-5" /></Button>
                          {stops.length < 2 && <Button size="icon" variant="ghost" className="h-12 w-12 rounded-full text-slate-400" onClick={() => setStops([...stops, null])}><Plus className="w-5 h-5" /></Button>}
                      </div>
                  </div>
              </div>

              <div className="flex-1 bg-slate-50 overflow-y-auto px-4 py-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Dica: Se não encontrar o endereço, use "Selecionar no Mapa"</h3>
                  <div className="space-y-4">
                      {historyItems.length > 0 ? historyItems.slice(0, 5).map((h, i) => (
                          <button key={i} className="w-full flex items-center gap-4 p-2 text-left hover:bg-white rounded-2xl transition-colors" onClick={() => setDestLocation({ lat: Number(h.destination_lat), lon: Number(h.destination_lng), display_name: h.destination_address })}>
                              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><History className="w-5 h-5" /></div>
                              <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-900 truncate">{h.destination_address.split(',')[0]}</p><p className="text-xs text-slate-500 truncate">{h.destination_address}</p></div>
                          </button>
                      )) : <div className="text-center py-10 opacity-40"><MapIcon className="w-12 h-12 mx-auto mb-2" /><p className="text-sm font-medium">Busque por um destino acima ou use o mapa</p></div>}
                  </div>
              </div>
              {pickupLocation && destLocation && (
                  <div className="p-4 bg-white border-t border-slate-100">
                      <Button className="w-full h-16 bg-yellow-500 text-black hover:bg-yellow-400 font-black text-xl rounded-[24px] shadow-2xl" onClick={() => { setIsSearchingFull(false); unlockAudio(); setStep('confirm'); }}>CONFIRMAR ROTA</Button>
                  </div>
              )}
          </div>
      )}

      <Drawer open={step === 'confirm'} onOpenChange={(open) => { if(!open) setStep('search'); }}>
          <DrawerContent className="bg-white/95 backdrop-blur-xl border-t-0 p-0 rounded-t-[40px] max-h-[85vh]">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4" />
              <DrawerHeader className="px-6 py-2 text-left">
                  <div className="flex justify-between items-center">
                    <div>
                        <DrawerTitle className="text-2xl font-black text-slate-900">Escolha seu Gold</DrawerTitle>
                        <DrawerDescription className="font-bold text-slate-500">{routeDistance.toFixed(1)} km • {Math.round(routeDuration)} min</DrawerDescription>
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-slate-100"><Info className="w-5 h-5 text-slate-500" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 rounded-2xl p-4 shadow-2xl border-slate-100">
                            <h4 className="font-black text-sm mb-3 uppercase tracking-widest">Detalhes do Preço</h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between"><span>Tarifa Base</span><span className="font-bold">R$ {calculatePriceDetails().base.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>Distância ({routeDistance.toFixed(1)}km)</span><span className="font-bold">R$ {calculatePriceDetails().km.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>Tempo ({Math.round(routeDuration)}min)</span><span className="font-bold">R$ {calculatePriceDetails().time.toFixed(2)}</span></div>
                                {calculatePriceDetails().stops > 0 && <div className="flex justify-between"><span>Paradas</span><span className="font-bold">R$ {calculatePriceDetails().stops.toFixed(2)}</span></div>}
                                <Separator className="my-2" />
                                <div className="flex justify-between text-sm font-black"><span>Total Estimado</span><span>R$ {calculatePriceDetails().total.toFixed(2)}</span></div>
                            </div>
                        </PopoverContent>
                    </Popover>
                  </div>
              </DrawerHeader>
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                  <div className="flex flex-col gap-3">
                    {categories.map(cat => (
                        <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={cn("flex items-center gap-4 p-4 rounded-[28px] border-2 transition-all text-left", selectedCategoryId === cat.id ? "border-yellow-500 bg-yellow-50/50 ring-4 ring-yellow-500/10 shadow-lg scale-[1.02]" : "border-slate-100 hover:border-slate-200")}>
                            <div className={cn("p-3 rounded-2xl transition-colors", selectedCategoryId === cat.id ? "bg-yellow-500 text-black" : "bg-slate-100 text-slate-400")}><Car className="w-8 h-8" /></div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2"><p className="font-black text-slate-900 text-lg leading-tight">{cat.name}</p><Badge className="bg-slate-100 text-slate-500 text-[9px] font-black border-0">{Math.floor(Math.random() * 5) + 2} min</Badge></div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{cat.description || 'Premium'}</p>
                            </div>
                            <div className="text-right"><p className="font-black text-2xl text-slate-900">R$ {calculatePrice(cat.id).toFixed(2)}</p></div>
                        </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nota para o motorista (Opcional)</Label>
                      <div className="relative">
                          <StickyNote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input placeholder="Ex: Estou na porta do mercado..." value={rideNotes} onChange={e => setRideNotes(e.target.value)} className="h-12 pl-10 rounded-2xl bg-slate-50 border-slate-100 font-medium text-sm text-slate-900 placeholder:text-slate-400" />
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pagamento</Label>
                          <div className="flex gap-2">
                              {appSettings.enableCash && <button onClick={() => setPaymentMethod('CASH')} className={cn("flex-1 h-12 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all", paymentMethod === 'CASH' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 text-slate-400')}><Banknote className="w-4 h-4" /> <span className="text-[10px] font-black">DINHEIRO</span></button>}
                              {appSettings.enableWallet && <button onClick={() => setPaymentMethod('WALLET')} className={cn("flex-1 h-12 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all", paymentMethod === 'WALLET' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 text-slate-400')}><Wallet className="w-4 h-4" /> <span className="text-[10px] font-black">CARTEIRA</span></button>}
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Cupom</Label>
                          <div className="flex gap-2 h-12">
                              <Input placeholder="CÓDIGO" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="uppercase rounded-2xl border-slate-100 bg-slate-50 font-black text-xs h-full text-slate-900 placeholder:text-slate-400" />
                              <Button variant="outline" className="rounded-2xl h-full border-slate-100 px-3 shrink-0 text-slate-900 bg-white hover:bg-slate-100" onClick={applyCoupon} disabled={applyingCoupon}>{applyingCoupon ? <Loader2 className="animate-spin w-4 h-4" /> : <Ticket className="w-4 h-4" />}</Button>
                          </div>
                      </div>
                  </div>
                  {appliedCoupon && <div className="bg-green-50 border border-green-100 p-4 rounded-[20px] flex items-center justify-between animate-in zoom-in-95"><div className="flex items-center gap-3 text-green-800"><div className="bg-green-100 p-2 rounded-lg"><Gift className="w-4 h-4" /></div><p className="text-xs font-black uppercase tracking-wider">Desconto Ativado: {appliedCoupon.code}</p></div><button onClick={() => setAppliedCoupon(null)} className="text-green-600 p-1"><XCircle className="w-5 h-5" /></button></div>}
                  <Button className="w-full h-18 bg-yellow-500 text-black font-black text-2xl rounded-[28px] shadow-2xl shadow-yellow-500/20 transition-all active:scale-95 py-8 hover:bg-yellow-400" onClick={confirmRide} disabled={isRequesting || calculatingRoute}>{isRequesting ? <Loader2 className="animate-spin w-8 h-8 text-black" /> : "PEDIR AGORA"}</Button>
              </div>
          </DrawerContent>
      </Drawer>

      <div className="absolute inset-0 z-10 flex flex-col justify-end pb-28 pointer-events-none px-4">
        {step === 'waiting' && (
          <Card className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white/40 text-center animate-in zoom-in-95">
              <div className="relative w-32 h-32 mx-auto mb-8"><div className="absolute inset-0 bg-yellow-400/20 rounded-full animate-ping"></div><div className="relative bg-yellow-400 w-full h-full rounded-full flex items-center justify-center shadow-2xl shadow-yellow-500/50"><Search className="w-16 h-16 text-black animate-pulse" /></div></div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">Buscando Motorista</h2>
              <p className="text-slate-500 font-medium mb-6">Enviando sua solicitação para os parceiros mais próximos...</p>
              <Button variant="ghost" className="text-red-500 font-bold h-14 rounded-2xl w-full" onClick={() => { if (ride) cancelRide(ride.id); setIsRequesting(false); setStep('search'); }}>CANCELAR SOLICITAÇÃO</Button>
          </Card>
        )}
        {step === 'active' && ride && (
          <Card className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl p-0 rounded-[32px] shadow-2xl border border-white/40 overflow-hidden animate-in slide-in-from-bottom-8">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <Badge className="bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] px-3 py-1">{ride.status === 'ACCEPTED' ? 'A CAMINHO' : ride.status === 'ARRIVED' ? 'NO LOCAL' : 'EM VIAGEM'}</Badge>
                  <span className="text-xs font-bold text-slate-400">#{ride.id.slice(0, 4)}</span>
              </div>
              <div className="p-6">
                  <div className="flex items-center gap-5 mb-6">
                      <Avatar className="w-20 h-20 border-4 border-white shadow-xl"><AvatarImage src={ride.driver_details?.avatar_url} /><AvatarFallback className="bg-slate-200 text-slate-500 font-bold">{ride.driver_details?.first_name?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1">
                          <h3 className="text-2xl font-black text-slate-900 leading-tight">{ride.driver_details?.first_name}</h3>
                          <Badge variant="outline" className="mt-1 border-slate-200 text-slate-500 font-bold uppercase tracking-widest">{ride.driver_details?.car_model} • {ride.driver_details?.car_plate}</Badge>
                      </div>
                      <div className="flex flex-col gap-3">
                          <Button 
                            size="icon" 
                            className="h-14 w-14 rounded-2xl shadow-lg bg-yellow-500 hover:bg-yellow-400 text-black border-0" 
                            onClick={() => setShowChat(true)}
                          >
                              <MessageCircle className="w-7 h-7" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-12 w-12 rounded-2xl shadow-sm bg-white" 
                            onClick={() => window.open(`tel:${ride.driver_details?.phone}`)}
                          >
                              <Phone className="w-5 h-5 text-green-600" />
                          </Button>
                      </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pagamento</p><p className="font-black text-slate-900">{ride.payment_method}</p></div>
                      <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p><p className="text-3xl font-black text-slate-900">R$ {Number(ride.price).toFixed(2)}</p></div>
                  </div>
              </div>
          </Card>
        )}
        {step === 'rating' && ride && (
          <Card className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white/40 text-center animate-in zoom-in-95">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-12 h-12 text-green-600" /></div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">Chegou ao Destino!</h2>
              <p className="text-slate-500 mb-6">Como foi sua viagem com o parceiro?</p>
              <div className="bg-slate-50 p-6 rounded-[32px] mb-8 mt-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Avalie {ride.driver_details?.first_name}</p>
                  <div className="flex justify-center gap-2">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => { setRating(star); rateRide(ride.id, star, false); }} className="transition-transform active:scale-90"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200'}`} /></button>))}</div>
              </div>
              <Button className="w-full h-16 bg-yellow-500 text-black hover:bg-yellow-400 font-black rounded-[24px]" onClick={() => { clearRide(); setStep('search'); }}>FECHAR E CONTINUAR</Button>
          </Card>
        )}

        {activeTab === 'history' && (
             <div className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 h-[75vh] flex flex-col animate-in slide-in-from-bottom-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><History className="w-6 h-6" /> Minhas Viagens</h2>
                    <Button variant="ghost" size="icon" onClick={() => setActiveTab('home')} className="rounded-full"><X className="w-5 h-5" /></Button>
                </div>

                <ScrollArea className="flex-1">
                    {historyItems.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center"><History className="w-8 h-8 opacity-20" /></div>
                            <p className="text-sm font-medium">Você ainda não realizou viagens.</p>
                        </div>
                    ) : historyItems.map(item => (
                        <div key={item.id} className="mb-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-slate-200 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    <p className="font-black text-slate-900 text-sm mt-0.5">{item.driver?.first_name || 'Motorista Gold'}</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-slate-900 block">R$ {Number(item.price).toFixed(2)}</span>
                                    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase border-0 px-2 py-0.5", item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{item.status}</Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 text-[11px] text-gray-500 truncate">
                                <MapPin className="w-3 h-3 shrink-0 text-slate-400" /> {item.destination_address}
                            </div>
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                                <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-blue-500" /><span className="text-[10px] font-bold">{item.distance}</span></div>
                                {item.driver_rating && <div className="flex items-center gap-1 ml-auto"><Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /><span className="text-[10px] font-bold">{item.driver_rating}</span></div>}
                            </div>
                        </div>
                    ))}
                </ScrollArea>
             </div>
         )}
      </div>

      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}>
          <DialogContent className="max-w-sm rounded-[32px] border-0 shadow-2xl p-8">
              <div className="text-center">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><Wallet className="w-10 h-10 text-red-600" /></div>
                  <DialogTitle className="text-2xl font-black text-slate-900 mb-2">Saldo Insuficiente</DialogTitle>
                  <DialogDescription className="font-medium text-slate-500 mb-6">Faltam R$ {missingAmount.toFixed(2)} para realizar esta corrida. Deseja recarregar?</DialogDescription>
                  <div className="space-y-3">
                      <Button className="w-full h-14 bg-black text-white font-black rounded-2xl" onClick={() => navigate('/wallet')}>RECARREGAR AGORA</Button>
                      <Button variant="ghost" className="w-full h-14 text-slate-500 font-bold" onClick={() => { setPaymentMethod('CASH'); setShowBalanceAlert(false); }}>ALTERAR PARA DINHEIRO</Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {!mapSelectionMode && <FloatingDock activeTab={activeTab} onTabChange={tab => { if(tab === 'profile') navigate('/profile'); else if(tab === 'wallet') navigate('/wallet'); else setActiveTab(tab); }} role="client" />}

      {showChat && ride && currentUserId && (
          <RideChat 
            rideId={ride.id} 
            currentUserId={currentUserId} 
            role="client" 
            otherUserName={ride.driver_details?.first_name || 'Motorista'} 
            otherUserAvatar={ride.driver_details?.avatar_url}
            onClose={() => setShowChat(false)} 
          />
      )}
    </div>
  );
};

export default ClientDashboard;