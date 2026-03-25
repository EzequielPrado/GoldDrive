"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Wallet, MapPin, Navigation, DollarSign, Star, History, Car, ArrowRight, MessageCircle, Phone, Smartphone, Map, Flag, CheckCircle2, UserPlus, Clock, X, MousePointer2, Loader2, ChevronRight, Banknote, XCircle, Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import GoogleMapComponent from "@/components/GoogleMapComponent";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import FloatingDock from "@/components/FloatingDock";
import { ScrollArea } from "@/components/ui/scroll-area";
import RideChat from "@/components/RideChat";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleLocationSearch from "@/components/GoogleLocationSearch";

const NavigationBlock = ({ label, lat, lng, address, icon: Icon = MapPin }: any) => {
    const openMap = (app: 'waze' | 'google') => {
        if (!lat || !lng) return;
        const url = app === 'waze' 
            ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
            : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        window.open(url, '_blank');
    };
    return (
        <div className="w-full mb-4 animate-in fade-in slide-in-from-bottom-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
            <div className="flex gap-3 mb-2">
                <Button className="flex-1 bg-[#3b82f6] text-white font-bold rounded-xl h-12" onClick={() => openMap('waze')}><Navigation className="w-4 h-4 mr-2" /> Waze</Button>
                <Button className="flex-1 bg-[#22c55e] text-white font-bold rounded-xl h-12" onClick={() => openMap('google')}><Map className="w-4 h-4 mr-2" /> Maps</Button>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-xs font-medium text-slate-700 line-clamp-2">{address}</p></div>
        </div>
    );
};

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ride, availableRides, acceptRide, rejectRide, confirmArrival, finishRide, startRide, completeStop, rateRide, clearRide, currentUserId, createManualRide, refreshAvailableRides, unlockAudio } = useRide();
  
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [showManualRide, setShowManualRide] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  
  const [pickupCoord, setPickupCoord] = useState<{lat: number, lon: number} | null>(null);
  const [destCoord, setDestCoord] = useState<{lat: number, lon: number} | null>(null);

  const [passengerName, setPassengerName] = useState("");
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [stops, setStops] = useState<any[]>([]);
  
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  const [globalMultiplier, setGlobalMultiplier] = useState(1.0);
  const [costPerStop, setCostPerStop] = useState(2.50);

  const [manualLoading, setManualLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [categoryRules, setCategoryRules] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!isOnline || !currentUserId) {
        setTrackingActive(false);
        return;
    }

    const updateLocation = () => {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { error } = await supabase.from('profiles').update({
                current_lat: pos.coords.latitude,
                current_lng: pos.coords.longitude,
                last_active: new Date().toISOString()
            }).eq('id', currentUserId);
            
            if (!error) setTrackingActive(true);
        }, (err) => {
            console.error("Erro GPS:", err);
            setTrackingActive(false);
        }, { enableHighAccuracy: true });
    };

    updateLocation();
    const interval = setInterval(updateLocation, 5000);
    return () => clearInterval(interval);
  }, [isOnline, currentUserId]);

  useEffect(() => {
    if (ride && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED') {
        setPickupCoord({ lat: Number(ride.pickup_lat), lon: Number(ride.pickup_lng) });
        setDestCoord({ lat: Number(ride.destination_lat), lon: Number(ride.destination_lng) });
    } else if (pickupLocation && destLocation && showManualRide) {
        setPickupCoord({ lat: pickupLocation.lat, lon: pickupLocation.lon });
        setDestCoord({ lat: destLocation.lat, lon: destLocation.lon });
    } else {
        setPickupCoord(null);
        setDestCoord(null);
    }
  }, [ride, pickupLocation, destLocation, showManualRide]);

  useEffect(() => {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => { checkProfile(); }, [activeTab]);

  useEffect(() => {
      if (activeTab === 'history' && driverProfile?.id) {
          const fetchHistory = async () => {
               const { data } = await supabase.from('rides')
                  .select('*, client_details:profiles!public_rides_customer_id_fkey(*)')
                  .eq('driver_id', driverProfile.id)
                  .order('created_at', { ascending: false });
               if (data) setHistoryItems(data);
          };
          fetchHistory();
      }
  }, [activeTab, driverProfile?.id]);

  useEffect(() => {
      const fetchPricing = async () => {
          const [catsRes, tiersRes, adminConfigRes] = await Promise.all([
              supabase.from('car_categories').select('*').eq('active', true).order('base_fare', { ascending: true }),
              supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true }),
              supabase.from('admin_config').select('*')
          ]);
          if (catsRes.data) setCategories(catsRes.data);
          if (tiersRes.data) setPricingTiers(tiersRes.data);
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
      };
      fetchPricing();
  }, []);

  const calculateRouteDistance = useCallback(() => {
      if (!pickupLocation || !destLocation) return;
      setManualLoading(true);
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
      }, (response, status) => {
          if (status === 'OK' && response) {
              let totalDist = 0;
              let totalDur = 0;
              response.routes[0].legs.forEach(leg => {
                  totalDist += leg.distance?.value || 0;
                  totalDur += leg.duration?.value || 0;
              });
              setRouteDistance(totalDist / 1000);
              setRouteDuration(totalDur / 60);
          }
          setManualLoading(false);
      });
  }, [pickupLocation, destLocation, stops]);

  useEffect(() => {
      if (pickupLocation && destLocation && showManualRide) {
          calculateRouteDistance();
      }
  }, [pickupLocation, destLocation, stops, showManualRide, calculateRouteDistance]);

  const calculatePrice = useCallback(() => {
      if (routeDistance <= 0 || categories.length === 0) return 0;
      const category = categories.find(c => c.name === 'Gold Driver') || categories.find(c => c.name.toLowerCase().includes('go')) || categories[0];
      if (!category) return 15;

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

          // Base + (KM) + (Tempo)
          price = baseFare + (routeDistance * appliedKmPrice) + (routeDuration * costPerMinute);
      }

      // Adiciona o custo das paradas
      const validStops = stops.filter(s => s && s.lat && s.lon);
      price += validStops.length * costPerStop;

      price = price * globalMultiplier;

      if (price < Number(category.min_fare)) {
          price = Number(category.min_fare);
      }
      
      return parseFloat(price.toFixed(2));
  }, [categories, pricingTiers, routeDistance, routeDuration, categoryRules, globalMultiplier, stops, costPerStop]);

  const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if(user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (data?.is_blocked) { await supabase.auth.signOut(); window.location.href = '/login/driver?blocked=true'; return; }
          if (data?.driver_status === 'PENDING') { navigate('/driver-pending'); return; }
          setDriverProfile(data);
          if (data.is_online !== undefined) setIsOnline(data.is_online);
      }
  };

  const toggleOnline = async (val: boolean) => { 
      setIsOnline(val);
      
      if (val) {
          // Destrava as políticas de áudio do navegador ao clicar
          unlockAudio();
          
          if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
              Notification.requestPermission();
          }
      }
      
      if (driverProfile?.id) {
          await supabase.from('profiles').update({ is_online: val, last_active: new Date().toISOString() }).eq('id', driverProfile.id);
      }
      if (val) {
          await refreshAvailableRides();
          showSuccess("Você está Online! Ative o GPS se solicitado.");
      }
  };

  const handleCreateManual = async () => {
      if (!pickupLocation || !destLocation || !passengerName) {
          showError("Preencha todos os campos da viagem.");
          return;
      }
      setManualLoading(true);
      try {
          const price = calculatePrice();
          const category = categories.find(c => c.name === 'Gold Driver') || categories.find(c => c.name.toLowerCase().includes('go')) || categories[0];
          const validStops = stops.filter(s => s && s.lat && s.lon);

          await createManualRide(
              passengerName, "", 
              pickupLocation.display_name, destLocation.display_name,
              { lat: pickupLocation.lat, lng: pickupLocation.lon },
              { lat: destLocation.lat, lng: destLocation.lon },
              price, `${routeDistance.toFixed(1)} km`, category?.name || 'Manual',
              validStops
          );
          
          setShowManualRide(false);
          setPassengerName("");
          setPickupLocation(null);
          setDestLocation(null);
          setStops([]);
          setRouteDistance(0);
          showSuccess("Viagem manual iniciada!");
      } catch (e: any) {
          console.error("Erro manual:", e);
          showError(e.message || "Erro ao iniciar corrida manual.");
      } finally {
          setManualLoading(false);
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
                  showError("Não foi possível identificar o endereço.");
              }
              setGpsLoading(false);
          });
      }, (error) => { 
          setGpsLoading(false); 
          showError("Ative o GPS do celular."); 
      }, { enableHighAccuracy: true, timeout: 5000 });
  };

  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride?.status || '');
  const isCompleted = ride?.status === 'COMPLETED';
  const isCancelled = ride?.status === 'CANCELLED';
  const hasAvailableRides = availableRides.length > 0;
  
  // Lógica das Paradas
  const currentStops = ride?.stops && Array.isArray(ride.stops) ? ride.stops : [];
  const nextStopIndex = currentStops.findIndex((s: any) => !s.completed);
  const nextStop = nextStopIndex !== -1 ? currentStops[nextStopIndex] : null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      <img src="/app-logo.png" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-50 pointer-events-none drop-shadow-md rounded-lg" />
      
      <div className="absolute inset-0 z-0">
          <GoogleMapComponent 
            className="h-full w-full" 
            pickupLocation={pickupCoord} 
            destinationLocation={destCoord} 
            stops={isOnTrip ? currentStops : null}
          />
      </div>

      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none mt-4">
          {!isOnTrip && !isCompleted && !isCancelled && (
              <div className={`pointer-events-auto backdrop-blur-xl border border-white/20 p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg transition-colors ${isOnline ? 'bg-black/80' : 'bg-white/80'}`}>
                 <Switch checked={isOnline} onCheckedChange={toggleOnline} />
                 <span className={`text-xs font-bold uppercase ${isOnline ? 'text-white' : 'text-slate-500'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                 {isOnline && trackingActive && <Zap className="w-3 h-3 text-yellow-500 animate-pulse" />}
              </div>
          )}
          <div className="pointer-events-auto bg-white/10 backdrop-blur-xl p-1 rounded-full shadow-lg cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 border-2 border-white"><AvatarImage src={driverProfile?.avatar_url} /><AvatarFallback className="bg-slate-900 text-white font-bold">{driverProfile?.first_name?.[0]}</AvatarFallback></Avatar>
          </div>
      </div>

      <div className="absolute inset-0 z-10 flex flex-col justify-end pb-32 pointer-events-none p-4">
         {activeTab === 'home' && (
            <div className="w-full max-w-md mx-auto pointer-events-auto">
                {!ride && !isOnline && (
                    <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl text-center border border-white/40">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-400"><Car className="w-8 h-8" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Bora rodar hoje?</h2>
                        <p className="text-gray-500 mb-8">Fique online para começar a receber pedidos de corridas próximas.</p>
                        <Button size="lg" className="w-full h-14 bg-slate-900 text-white font-bold rounded-2xl shadow-xl" onClick={() => toggleOnline(true)}>FICAR ONLINE</Button>
                    </div>
                )}

                {!ride && isOnline && !hasAvailableRides && (
                    <div className="flex flex-col gap-4 items-center">
                        <div className="bg-black/80 backdrop-blur-xl px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-pulse border border-white/10">
                            <div className="w-3 h-3 bg-green-500 rounded-full" />
                            <p className="text-white font-black uppercase tracking-widest text-xs">Procurando pedidos...</p>
                        </div>

                        <Button 
                            onClick={() => setShowManualRide(true)}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black h-16 w-16 rounded-full shadow-2xl shadow-yellow-500/40 animate-in zoom-in-50"
                        >
                            <UserPlus className="w-7 h-7" />
                        </Button>
                    </div>
                )}

                {isCancelled && (
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center animate-in zoom-in-95 duration-300 border border-gray-100">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><XCircle className="w-10 h-10 text-red-600" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Corrida Cancelada</h2>
                        <p className="text-gray-500 mb-6 font-medium">O passageiro cancelou a solicitação desta corrida.</p>
                        <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl shadow-xl" onClick={() => clearRide()}>VOLTAR AO MAPA</Button>
                    </div>
                )}

                {isCompleted && (
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center animate-in zoom-in-95 duration-300 border border-gray-100">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><DollarSign className="w-10 h-10 text-green-600" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">R$ {Number(ride.price).toFixed(2)}</h2>
                        <p className="text-gray-500 mb-6 font-medium">Corrida finalizada com sucesso!</p>
                        <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Avalie o Passageiro</p>
                            <div className="flex justify-center gap-3">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => setRating(star)} className="transition-transform active:scale-90"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200'}`} /></button>))}</div>
                        </div>
                        <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl shadow-xl" onClick={async () => { await rateRide(ride.id, rating || 5, true); clearRide(); setRating(0); }}>LIBERAR PARA NOVAS CORRIDAS</Button>
                    </div>
                )}

                {isOnTrip && (
                    <div className="bg-white p-6 rounded-[32px] shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <Badge className="bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] px-3 py-1">{ride?.status === 'ACCEPTED' ? 'A CAMINHO' : ride?.status === 'ARRIVED' ? 'NO LOCAL' : 'EM VIAGEM'}</Badge>
                            <span className="font-black text-lg">R$ {Number(ride?.price).toFixed(2)}</span>
                        </div>
                        
                        <ScrollArea className="max-h-[35vh] custom-scrollbar -mr-4 pr-4">
                            {ride?.status === 'ACCEPTED' && <NavigationBlock label="Buscar Passageiro" lat={ride.pickup_lat} lng={ride.pickup_lng} address={ride.pickup_address} />}
                            
                            {ride?.status === 'ARRIVED' && (
                                <>
                                    <div className="bg-green-50 p-4 rounded-2xl text-center mb-4 border border-green-100 animate-pulse">
                                        <p className="font-black text-green-800 text-sm">Aguardando passageiro embarcar...</p>
                                        {trackingActive && <p className="text-[10px] text-green-600 mt-1">Rastreamento ativo</p>}
                                    </div>
                                    <NavigationBlock label="Destino Final" lat={ride.destination_lat} lng={ride.destination_lng} address={ride.destination_address} icon={Flag} />
                                </>
                            )}
                            
                            {ride?.status === 'IN_PROGRESS' && (
                                <>
                                    {currentStops.length > 0 && (
                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4 animate-in fade-in">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Roteiro da Viagem</p>
                                            {currentStops.map((stop: any, idx: number) => (
                                                <p key={idx} className={`text-xs font-bold line-clamp-1 flex items-center gap-2 mb-2 ${stop.completed ? 'text-green-600 line-through opacity-60' : 'text-slate-700'}`}>
                                                    {stop.completed ? (
                                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                                    ) : (
                                                        <span className="w-4 h-4 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-[9px] shrink-0">{idx+1}</span>
                                                    )}
                                                    {stop.display_name}
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    {nextStop ? (
                                        <NavigationBlock 
                                            label={`Próxima Parada (${nextStopIndex + 1})`} 
                                            lat={nextStop.lat} 
                                            lng={nextStop.lon || nextStop.lng} 
                                            address={nextStop.display_name} 
                                            icon={MapPin} 
                                        />
                                    ) : (
                                        <NavigationBlock 
                                            label="Destino Final" 
                                            lat={ride.destination_lat} 
                                            lng={ride.destination_lng} 
                                            address={ride.destination_address} 
                                            icon={Flag} 
                                        />
                                    )}
                                </>
                            )}
                        </ScrollArea>
                        
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 mt-4">
                             <Avatar className="w-12 h-12 border-2 border-white"><AvatarImage src={ride?.client_details?.avatar_url} /><AvatarFallback>{ride?.client_details?.first_name?.[0] || 'G'}</AvatarFallback></Avatar>
                             <div className="flex-1"><h3 className="font-black text-slate-900 leading-tight">{ride?.client_details?.first_name || ride?.guest_name || 'Passageiro'} {ride?.client_details?.last_name}</h3><p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Nota: 5.0 ⭐</p></div>
                             <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={() => setShowChat(true)}><MessageCircle className="w-4 h-4" /></Button>
                             {ride?.client_details?.phone && <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={() => window.open(`tel:${ride.client_details.phone}`)}><Phone className="w-4 h-4" /></Button>}
                        </div>
                        
                        {ride?.status === 'ACCEPTED' && <Button className="w-full h-16 bg-slate-900 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => confirmArrival(ride.id)}>CHEGUEI NO LOCAL</Button>}
                        {ride?.status === 'ARRIVED' && <Button className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => startRide(ride.id)}>INICIAR VIAGEM</Button>}
                        {ride?.status === 'IN_PROGRESS' && (
                            nextStop ? (
                                <Button className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl transition-all active:scale-95" onClick={() => completeStop(ride.id, nextStopIndex, currentStops)}>
                                    CHEGUEI NA PARADA {nextStopIndex + 1}
                                </Button>
                            ) : (
                                <Button className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl transition-all active:scale-95" onClick={() => finishRide(ride.id)}>
                                    FINALIZAR CORRIDA
                                </Button>
                            )
                        )}
                    </div>
                )}
            </div>
         )}

         {activeTab === 'history' && (
             <div className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 h-[60vh] flex flex-col">
                <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2"><History className="w-6 h-6" /> Histórico</h2>
                <ScrollArea className="flex-1 pr-4">
                    {historyItems.length === 0 ? <div className="py-12 text-center text-gray-400"><Clock className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>Sem viagens.</p></div> : historyItems.map(item => (<div key={item.id} className="mb-3 p-4 bg-gray-50 rounded-2xl border border-gray-100"><div className="flex justify-between items-start mb-2"><div><p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(item.created_at).toLocaleDateString()}</p><p className="font-black text-slate-900 text-sm mt-0.5">{item.client_details?.first_name || item.guest_name || 'Passageiro'}</p></div><span className="font-black text-green-600">R$ {Number(item.price).toFixed(2)}</span></div><div className="flex items-center gap-2 mt-3 text-xs text-gray-500 truncate"><MapPin className="w-3 h-3 shrink-0" /> {item.destination_address}</div></div>))}
                </ScrollArea>
             </div>
         )}
      </div>

      <Dialog open={hasAvailableRides && isOnline && !ride} onOpenChange={() => {}}>
          <DialogContent className="max-w-md bg-white rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden outline-none">
              <DialogTitle className="sr-only">Nova Solicitação</DialogTitle>
              <div className="bg-yellow-500 p-6 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                  <div className="relative w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce shadow-xl">
                      <Car className="w-10 h-10 text-black" />
                  </div>
                  <h2 className="relative text-2xl font-black text-black">Nova Solicitação!</h2>
                  <p className="relative text-black/80 font-bold mt-1 text-sm">Passageiro aguardando motorista</p>
              </div>
              
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50">
                  {availableRides.map(r => (
                      <div key={r.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <Avatar className="w-12 h-12 border-2 border-yellow-500 shadow-sm">
                                      <AvatarImage src={r.client_details?.avatar_url} />
                                      <AvatarFallback className="font-bold bg-slate-100 text-slate-900">{r.client_details?.first_name?.[0]}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                      <p className="font-black text-slate-900 text-lg leading-tight">{r.client_details?.first_name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                          <Badge className="bg-slate-900 text-white text-[9px] px-2 py-0.5 uppercase tracking-wider">{r.category || 'Premium'}</Badge>
                                          <span className="text-[10px] text-gray-500 font-bold uppercase">{r.distance}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Valor</p>
                                  <span className="text-2xl font-black text-green-600">R$ {Number(r.price).toFixed(2)}</span>
                              </div>
                          </div>
                          
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                              <div className="flex items-start gap-3">
                                  <div className="p-1.5 bg-white rounded-full shadow-sm mt-0.5"><MapPin className="w-3.5 h-3.5 text-slate-500" /></div>
                                  <div>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Embarque</p>
                                      <p className="text-xs font-bold text-slate-700 line-clamp-1">{r.pickup_address}</p>
                                  </div>
                              </div>
                              {r.stops && Array.isArray(r.stops) && r.stops.length > 0 && (
                                  <div className="flex items-start gap-3 border-l-2 border-dashed border-slate-200 ml-3 pl-3">
                                      <div>
                                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Paradas Extra</p>
                                          {r.stops.map((stop: any, idx: number) => (
                                              <p key={idx} className="text-[10px] font-bold text-slate-600 line-clamp-1">🛑 {stop.display_name}</p>
                                          ))}
                                      </div>
                                  </div>
                              )}
                              <div className="flex items-start gap-3">
                                  <div className="p-1.5 bg-yellow-100 rounded-full shadow-sm mt-0.5"><Flag className="w-3.5 h-3.5 text-yellow-600" /></div>
                                  <div>
                                      <p className="text-[9px] font-bold text-yellow-600/60 uppercase tracking-widest">Destino</p>
                                      <p className="text-xs font-black text-slate-900 line-clamp-1">{r.destination_address}</p>
                                  </div>
                              </div>
                          </div>

                          <div className="flex gap-3 mt-2">
                              <Button variant="ghost" className="flex-1 text-red-500 font-bold h-14 rounded-2xl bg-red-50 hover:bg-red-100 transition-colors" onClick={() => rejectRide(r.id)}>
                                  <X className="w-5 h-5 mr-1" /> Ignorar
                              </Button>
                              <Button className="flex-[2] bg-slate-900 hover:bg-black text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-slate-900/20 transition-all active:scale-95" onClick={() => acceptRide(r.id)}>
                                  ACEITAR CORRIDA
                              </Button>
                          </div>
                      </div>
                  ))}
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={showManualRide} onOpenChange={setShowManualRide}>
          <DialogContent className="max-w-md bg-white rounded-[32px] border-0 shadow-2xl p-0 overflow-visible">
              <DialogHeader className="p-6 bg-slate-900 text-white rounded-t-[32px]">
                  <DialogTitle className="text-2xl font-black">Lançar Viagem</DialogTitle>
                  <DialogDescription className="text-slate-400">Preencha os dados da corrida manual abaixo.</DialogDescription>
              </DialogHeader>
              
              <div className="p-6 bg-white rounded-b-[32px] max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="space-y-4 mb-4">
                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Nome do Passageiro</Label>
                          <Input 
                            placeholder="Ex: João Silva" 
                            value={passengerName} 
                            onChange={e => setPassengerName(e.target.value)} 
                            className="h-12 rounded-xl bg-slate-50 border-slate-200 text-slate-900 focus:bg-white transition-all font-bold placeholder:text-slate-300" 
                          />
                      </div>
                  </div>

                  <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Local de Embarque</Label>
                          <div className="flex gap-2">
                              <GoogleLocationSearch 
                                placeholder="Onde o passageiro está?" 
                                onSelect={setPickupLocation} 
                                initialValue={pickupLocation?.display_name} 
                                className="flex-1"
                              />
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-14 w-14 rounded-2xl shrink-0 border-slate-200 bg-slate-50" 
                                onClick={getCurrentLocation} 
                                disabled={gpsLoading}
                              >
                                {gpsLoading ? <Loader2 className="animate-spin text-slate-400" /> : <MapPin className="w-5 h-5 text-slate-600" />}
                              </Button>
                          </div>
                      </div>

                      {/* Paradas */}
                      {stops.map((stop, index) => (
                          <div key={index} className="flex gap-2 animate-in slide-in-from-left">
                              <div className="relative flex-1">
                                  <GoogleLocationSearch 
                                      placeholder={`Parada ${index + 1}`} 
                                      onSelect={(l) => {
                                          const newStops = [...stops];
                                          newStops[index] = l;
                                          setStops(newStops);
                                      }} 
                                      initialValue={stop?.display_name} 
                                  />
                              </div>
                              <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-red-200 bg-red-50 text-red-500 hover:bg-red-100" onClick={() => {
                                  const newStops = [...stops];
                                  newStops.splice(index, 1);
                                  setStops(newStops);
                              }}>
                                  <X className="w-5 h-5" />
                              </Button>
                          </div>
                      ))}

                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Destino Final</Label>
                          <GoogleLocationSearch placeholder="Para onde ele vai?" onSelect={setDestLocation} initialValue={destLocation?.display_name} />
                      </div>

                      {stops.length < 2 && (
                          <Button variant="ghost" className="w-full text-slate-500 font-bold border border-dashed border-slate-200 rounded-xl h-12 mt-2" onClick={() => setStops([...stops, null])}>
                              <Plus className="w-4 h-4 mr-2" /> Adicionar Parada
                          </Button>
                      )}
                  </div>

                  <div className="pt-6 space-y-4">
                      {pickupLocation && destLocation && (
                          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 text-center animate-in zoom-in-95">
                              {manualLoading ? (
                                  <div className="flex flex-col items-center gap-2">
                                      <Loader2 className="animate-spin text-yellow-600 w-6 h-6" />
                                      <p className="text-[10px] font-bold text-yellow-700 uppercase">Calculando...</p>
                                  </div>
                              ) : (
                                  <>
                                      {globalMultiplier > 1.0 && <Badge className="mb-2 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">Tarifa Dinâmica Ativa</Badge>}
                                      {stops.filter(s=>s).length > 0 && <p className="text-[9px] font-bold text-yellow-700 uppercase mb-1">Inclui taxa de parada</p>}
                                      <p className="text-[10px] font-bold text-yellow-700 uppercase mb-1 tracking-widest">Valor da Corrida</p>
                                      <h3 className="text-4xl font-black text-black tracking-tighter">R$ {calculatePrice().toFixed(2)}</h3>
                                      <p className="text-[10px] text-yellow-600 font-bold mt-1">Distância: {routeDistance.toFixed(1)} km</p>
                                  </>
                              )}
                          </div>
                      )}
                      
                      <div className="flex gap-3">
                          <Button 
                            variant="ghost" 
                            className="flex-1 h-14 rounded-2xl font-bold text-slate-400" 
                            onClick={() => setShowManualRide(false)}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            className="flex-[2] h-14 bg-black hover:bg-zinc-800 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50" 
                            onClick={handleCreateManual} 
                            disabled={manualLoading || !destLocation || !passengerName || !pickupLocation}
                          >
                              {manualLoading ? <Loader2 className="animate-spin" /> : "INICIAR CORRIDA"}
                          </Button>
                      </div>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      <FloatingDock activeTab={activeTab} onTabChange={tab => { if(tab === 'profile') navigate('/profile'); else if(tab === 'wallet') navigate('/wallet'); else setActiveTab(tab); }} role="driver" />
      {showChat && ride && currentUserId && (<RideChat rideId={ride.id} currentUserId={currentUserId} role="driver" otherUserName={ride.client_details?.first_name || 'Passageiro'} otherUserAvatar={ride.client_details?.avatar_url} onClose={() => setShowChat(false)} />)}
    </div>
  );
};

export default DriverDashboard;