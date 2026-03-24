"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import GoogleMapComponent from "@/components/GoogleMapComponent";
import { 
  MapPin, Car, Loader2, Star, ChevronRight, Clock, Wallet, ArrowLeft, History, MessageCircle, CheckCircle2, AlertTriangle, Banknote, XCircle, Ticket, Plus, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [isInitialSync, setIsInitialSync] = useState(true);
  
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [stops, setStops] = useState<any[]>([]); 

  const [routeDistance, setRouteDistance] = useState<number>(0); 
  const [routeDuration, setRouteDuration] = useState<number>(0); 
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'CASH'>('CASH');
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
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

            dataFetched.current = true;
            setIsInitialSync(false);
        } catch (error) { 
            setIsInitialSync(false);
        }
    };
    fetchInitialData();
  }, [navigate]);

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
      if (ride.status === 'CANCELLED') {
          setStep('cancelled');
      } else if (ride.status === 'COMPLETED') {
        if (!ride.driver_rating) setStep('rating');
        else { clearRide(); setStep('search'); }
      } else {
        setStep('waiting');
      }
    } else {
      // Evita voltar para 'search' bruscamente se estivermos no meio de uma solicitação
      if (!isRequesting && (step === 'waiting' || step === 'rating' || step === 'cancelled')) {
          setStep('search');
      }
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
            travelMode: google.maps.TravelMode.DRIVING
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

  const calculatePrice = useCallback((catId?: string) => {
      const category = categories.find(c => c.id === (catId || selectedCategoryId));
      if (!category || routeDistance <= 0) return 0;
      
      let price = 0;
      
      if (category.name === 'Gold Driver' && pricingTiers.length > 0) {
          const tier = pricingTiers.find(t => routeDistance <= Number(t.max_distance)) || pricingTiers[pricingTiers.length - 1];
          price = Number(tier?.price || 15);
      } else {
          const rules = categoryRules[category.name] || {};
          let isNight = false;
          
          if (rules.night_start && rules.night_end) {
              const currentHour = new Date().getHours();
              const currentMinute = new Date().getMinutes();
              const currentTime = currentHour + (currentMinute / 60);

              const startParts = rules.night_start.split(':');
              const endParts = rules.night_end.split(':');
              const start = parseInt(startParts[0]) + parseInt(startParts[1]) / 60;
              const end = parseInt(endParts[0]) + parseInt(endParts[1]) / 60;

              if (start > end) { 
                  isNight = currentTime >= start || currentTime <= end;
              } else {
                  isNight = currentTime >= start && currentTime <= end;
              }
          }

          let appliedKmPrice = Number(category.cost_per_km);
          const baseFare = Number(category.base_fare);
          const costPerMinute = Number(category.cost_per_minute || 0);
          
          if (isNight && rules.night_km) {
              appliedKmPrice = Number(rules.night_km);
          } else {
              const dist1 = Number(rules.dist_1 || 4.5);
              const price1 = rules.price_1 ? Number(rules.price_1) : (rules.km_over_45 ? Number(rules.km_over_45) : null);
              const dist2 = Number(rules.dist_2 || 10);
              const price2 = rules.price_2 ? Number(rules.price_2) : (rules.km_over_10 ? Number(rules.km_over_10) : null);

              let thresholds = [];
              if (price1 !== null) thresholds.push({ dist: dist1, price: price1 });
              if (price2 !== null) thresholds.push({ dist: dist2, price: price2 });
              thresholds.sort((a, b) => b.dist - a.dist);

              for (const t of thresholds) {
                  if (routeDistance > t.dist) {
                      appliedKmPrice = t.price;
                      break;
                  }
              }
          }

          price = baseFare + (routeDistance * appliedKmPrice) + (routeDuration * costPerMinute);
      }

      const validStops = stops.filter(s => s && s.lat && s.lon);
      price += validStops.length * costPerStop;

      price = price * globalMultiplier;

      if (price < Number(category.min_fare)) {
          price = Number(category.min_fare);
      }

      if (appliedCoupon) {
          if (appliedCoupon.discount_type === 'PERCENTAGE') {
              price = price - (price * (Number(appliedCoupon.discount_value) / 100));
          } else {
              price = price - Number(appliedCoupon.discount_value);
          }
      }

      return parseFloat(Math.max(price, 0).toFixed(2));
  }, [categories, pricingTiers, routeDistance, routeDuration, selectedCategoryId, categoryRules, globalMultiplier, appliedCoupon, stops, costPerStop]);

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
            validStops
        ); 
        
        if (success) {
            showSuccess("Motorista solicitado!");
            if (appliedCoupon) {
                await supabase.from('coupons').update({ current_uses: appliedCoupon.current_uses + 1 }).eq('id', appliedCoupon.id);
            }
            setStep('waiting'); // Só muda o step se realmente der sucesso
        }
    } catch (e: any) { 
        showError(e.message); 
    } finally { 
        setIsRequesting(false); 
    }
  };

  const getCurrentLocation = () => {
      setGpsLoading(true);
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
                  showSuccess("Sua localização atualizada!");
              } else {
                  showError("Não foi possível identificar seu endereço.");
              }
              setGpsLoading(false);
          });
      }, (error) => { 
          setGpsLoading(false); 
          if (error.code === 1) showError("Permissão de localização negada.");
          else showError("Erro ao obter GPS. Ative a localização.");
      }, { enableHighAccuracy: true, timeout: 5000 });
  };

  const addStop = () => {
      if (stops.length >= 2) {
          showError("Você só pode adicionar até 2 paradas.");
          return;
      }
      setStops([...stops, null]);
  };

  const removeStop = (index: number) => {
      const newStops = [...stops];
      newStops.splice(index, 1);
      setStops(newStops);
  };

  const updateStopLocation = (index: number, location: any) => {
      const newStops = [...stops];
      newStops[index] = location;
      setStops(newStops);
  };

  if (isInitialSync) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-zinc-950">
              <Loader2 className="w-10 h-10 animate-spin text-yellow-500" />
          </div>
      );
  }

  const showRouteOnMap = step === 'confirm' || step === 'waiting';
  const driverLiveLocation = ride?.driver_details?.current_lat ? { lat: ride.driver_details.current_lat, lon: ride.driver_details.current_lng } : null;

  return (
    <div className="h-screen w-full overflow-hidden bg-gray-100 font-sans text-slate-900 relative">
      <div className="absolute inset-0 z-0">
        <GoogleMapComponent 
            pickupLocation={showRouteOnMap ? pickupLocation : null} 
            destinationLocation={showRouteOnMap ? destLocation : null} 
            driverLocation={driverLiveLocation}
            stops={showRouteOnMap ? stops : null}
        />
      </div>

      <img src="/app-logo.png" alt="Gold" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-[100] drop-shadow-md rounded-lg" />
      <div className="absolute top-0 left-0 right-0 p-6 z-50 flex justify-between items-start pointer-events-none mt-4">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-xl p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg border border-white/20 cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 border-2 border-white shadow-sm"><AvatarImage src={userProfile?.avatar_url} /><AvatarFallback className="bg-yellow-500 text-black font-bold">{userProfile?.first_name?.[0]}</AvatarFallback></Avatar>
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

      <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-end pb-32 md:justify-center p-4">
        {activeTab === 'home' && (
            <div className="w-full max-w-md mx-auto pointer-events-auto">
                {step === 'search' && (
                    <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 animate-in fade-in zoom-in-95 duration-300 max-h-[80vh] flex flex-col">
                        <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Para onde vamos?</h2>
                        <ScrollArea className="flex-1 -mr-2 pr-4 space-y-4">
                            <div className="flex gap-2 mb-4">
                                <GoogleLocationSearch placeholder="Local de embarque" onSelect={(l) => setPickupLocation(l)} initialValue={pickupLocation?.display_name} className="flex-1" />
                                <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-slate-200 bg-slate-50 hover:bg-slate-100" onClick={getCurrentLocation} disabled={gpsLoading}>
                                    {gpsLoading ? <Loader2 className="animate-spin text-slate-400" /> : <MapPin className="w-5 h-5 text-slate-600" />}
                                </Button>
                            </div>
                            
                            {/* Paradas */}
                            {stops.map((stop, index) => (
                                <div key={index} className="flex gap-2 mb-4 animate-in slide-in-from-left">
                                    <div className="relative flex-1">
                                        <GoogleLocationSearch 
                                            placeholder={`Parada ${index + 1}`} 
                                            onSelect={(l) => updateStopLocation(index, l)} 
                                            initialValue={stop?.display_name} 
                                        />
                                    </div>
                                    <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-red-200 bg-red-50 text-red-500 hover:bg-red-100" onClick={() => removeStop(index)}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                            ))}

                            <GoogleLocationSearch placeholder="Para onde você vai?" onSelect={(l) => setDestLocation(l)} initialValue={destLocation?.display_name} className="mb-4" />
                            
                            {stops.length < 2 && (
                                <Button variant="ghost" className="w-full text-slate-500 font-bold border border-dashed border-slate-200 rounded-xl h-12 mt-2" onClick={addStop}>
                                    <Plus className="w-4 h-4 mr-2" /> Adicionar Parada
                                </Button>
                            )}
                        </ScrollArea>
                        <Button className="w-full mt-6 h-14 text-lg font-bold rounded-2xl bg-black text-white hover:bg-zinc-800 shadow-xl shrink-0" onClick={() => { if(!pickupLocation || !destLocation) showError("Defina os pontos da viagem."); else setStep('confirm'); }}>
                            Ver Preços <ChevronRight className="ml-1 w-5 h-5" />
                        </Button>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 flex flex-col max-h-[75vh] animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setStep('search')}>
                            <div className="bg-gray-100 p-2 rounded-full"><ArrowLeft className="w-5 h-5" /></div>
                            <h2 className="text-xl font-black text-slate-900">Confirmar Pedido</h2>
                        </div>
                        
                        <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 space-y-2 text-[13px]">
                            <p className="font-medium text-slate-600 line-clamp-1 truncate flex items-center gap-2">📍 {pickupLocation?.display_name}</p>
                            {stops.filter(s => s).map((stop, idx) => (
                                <p key={idx} className="font-medium text-slate-600 line-clamp-1 truncate flex items-center gap-2 text-[11px] pl-6 border-l-2 border-dashed border-slate-200 ml-1.5">🛑 {stop.display_name}</p>
                            ))}
                            <p className="font-bold text-slate-900 line-clamp-1 truncate flex items-center gap-2">🏁 {destLocation?.display_name}</p>
                        </div>

                        {calculatingRoute ? (
                            <div className="py-12 flex flex-col items-center gap-3">
                                <Loader2 className="animate-spin text-yellow-500 w-8 h-8" />
                                <p className="text-sm font-bold text-gray-500">Calculando melhor preço...</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 mb-4 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                    {(globalMultiplier > 1.0 || stops.filter(s=>s).length > 0) && (
                                        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold p-3 rounded-xl flex flex-col gap-1 mb-2 animate-pulse">
                                            {globalMultiplier > 1.0 && <p className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Demanda Alta: Preços ajustados.</p>}
                                            {stops.filter(s=>s).length > 0 && <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Inclui taxa de R$ {costPerStop.toFixed(2)} por parada extra.</p>}
                                        </div>
                                    )}

                                    {categories.map(cat => {
                                        const price = calculatePrice(cat.id);
                                        const isSelected = selectedCategoryId === cat.id;
                                        return (
                                            <div key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-yellow-500 bg-yellow-50 shadow-md scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-slate-400'}`}><Car className="w-6 h-6" /></div>
                                                    <div><h4 className="font-black text-slate-900">{cat.name}</h4><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{cat.description || 'Premium'}</p></div>
                                                </div>
                                                <div className="text-right">
                                                    {appliedCoupon && isSelected && <span className="block text-[10px] font-bold text-green-600 mb-0.5 line-through opacity-60">Cupom Aplicado</span>}
                                                    <span className="font-black text-lg text-slate-900">R$ {price.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* CUPOM */}
                                <div className="mb-4">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input placeholder="Código de desconto" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="uppercase bg-white pl-9 h-12 rounded-xl font-bold" disabled={!!appliedCoupon} />
                                        </div>
                                        {appliedCoupon ? (
                                            <Button variant="outline" className="text-red-500 font-bold border-red-200 bg-red-50 h-12 rounded-xl" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>Remover</Button>
                                        ) : (
                                            <Button variant="secondary" className="font-bold bg-slate-900 text-white hover:bg-black h-12 rounded-xl" onClick={applyCoupon} disabled={!couponCode || applyingCoupon}>{applyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}</Button>
                                        )}
                                    </div>
                                    {appliedCoupon && <p className="text-[10px] font-bold text-green-600 mt-2 ml-1 animate-in slide-in-from-top-2">✅ Cupom aplicado com sucesso!</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {appSettings.enableWallet && <button onClick={() => setPaymentMethod('WALLET')} className={`h-12 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'WALLET' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-gray-200 text-slate-500'}`}><Wallet className="w-4 h-4" /> Carteira</button>}
                                    <button onClick={() => setPaymentMethod('CASH')} className={`h-12 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${paymentMethod === 'CASH' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-gray-200 text-slate-500'}`}><Banknote className="w-4 h-4" /> Dinheiro</button>
                                </div>
                                <Button className="w-full h-14 text-lg font-black rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black shadow-xl" onClick={confirmRide} disabled={isRequesting}>{isRequesting ? <Loader2 className="animate-spin" /> : "PEDIR AGORA"}</Button>
                            </>
                        )}
                    </div>
                )}

                {(step === 'waiting' || isRequesting) && (
                     <div className="bg-white p-6 rounded-[32px] shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
                         {(ride?.status === 'SEARCHING' || isRequesting) ? (
                             <div className="py-8 text-center">
                                 <div className="relative w-24 h-24 mx-auto mb-6">
                                    <div className="absolute inset-0 bg-yellow-500 rounded-full animate-ping opacity-20" />
                                    <div className="relative w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center text-black shadow-lg"><Car className="w-10 h-10" /></div>
                                 </div>
                                 <h3 className="text-2xl font-black text-slate-900">Buscando motorista</h3>
                                 <p className="text-gray-500 text-sm mt-2">Estamos localizando o parceiro Gold mais próximo.</p>
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
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Você Chegou!</h2>
                        <p className="text-gray-500 mb-8">Avalie sua experiência com o motorista:</p>
                        <div className="flex justify-center gap-3 mb-8">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => setRating(star)} className="transition-transform active:scale-90"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200'}`} /></button>))}</div>
                        <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl shadow-xl" onClick={async () => { if (ride) await rateRide(ride.id, rating || 5, false); setStep('search'); }}>Finalizar e Voltar</Button>
                    </div>
                )}
                
                {step === 'cancelled' && (
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><XCircle className="w-10 h-10 text-red-600" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Corrida Cancelada</h2>
                        <p className="text-gray-500 mb-8">Esta viagem foi cancelada recentemente.</p>
                        <Button className="w-full h-14 bg-slate-900 text-white font-bold rounded-2xl shadow-xl" onClick={() => { clearRide(); setStep('search'); }}>Fazer Nova Busca</Button>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'history' && (
            <div className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 pointer-events-auto h-[60vh] flex flex-col animate-in fade-in duration-300">
                <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2"><History className="w-6 h-6" /> Suas Viagens</h2>
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
              <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black text-slate-900">Cancelar Viagem?</AlertDialogTitle><AlertDialogDescription className="text-gray-500">O cancelamento pode gerar cobrança de taxa se o motorista já estiver chegando.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter className="mt-4 flex gap-3"><AlertDialogCancel className="rounded-xl h-12 flex-1 font-bold">Voltar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 flex-1 font-bold" onClick={async () => { if(ride) await cancelRide(ride.id); setShowCancelAlert(false); setStep('search'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showBalanceAlert} onOpenChange={setShowBalanceAlert}>
          <DialogContent className="rounded-[32px] border-0 text-center p-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600"><AlertTriangle className="w-10 h-10" /></div>
              <DialogTitle className="text-2xl font-black text-slate-900 mb-2">Saldo Insuficiente</DialogTitle>
              <DialogDescription className="text-gray-500 mb-6">Faltam R$ {missingAmount.toFixed(2)} na sua carteira.</DialogDescription>
              <div className="flex flex-col gap-3">
                  <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl" onClick={() => navigate('/wallet')}>Adicionar Crédito</Button>
                  <Button variant="ghost" className="w-full h-12 text-gray-500 font-bold" onClick={() => { setShowBalanceAlert(false); setPaymentMethod('CASH'); }}>Pagar com Dinheiro</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDashboard;