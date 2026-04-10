"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Wallet, MapPin, Navigation, DollarSign, Star, History, Car, ArrowRight, 
  MessageCircle, Phone, Smartphone, Map, Flag, CheckCircle2, UserPlus, 
  Clock, X, MousePointer2, Loader2, ChevronRight, Banknote, XCircle, 
  Zap, Plus, StickyNote, TrendingUp, Calendar, Filter, ShieldAlert, 
  Target, Check, Pencil, User 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

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
  
  // Estados para Marcação no Mapa (Motorista)
  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'destination' | null>(null);
  const [isReversingGeocode, setIsReversingGeocode] = useState(false);

  // Metas de Ganhos
  const [dailyGoal, setDailyGoal] = useState(() => Number(localStorage.getItem('driver_daily_goal')) || 200);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(dailyGoal.toString());

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
  const [categoryRules, setCategoryRules] = useState<Record<string, any>>({});

  // Driver Stats
  const [stats, setStats] = useState({
      todayEarnings: 0,
      todayRides: 0,
      weekEarnings: 0,
      totalRides: 0,
      avgRating: 5.0
  });
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'all'>('all');

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

  const fetchStats = useCallback(async () => {
      if (!currentUserId) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const { data: rides } = await supabase.from('rides')
          .select('price, driver_earnings, created_at, status, customer_rating')
          .eq('driver_id', currentUserId)
          .eq('status', 'COMPLETED');

      if (rides) {
          let todayE = 0;
          let todayR = 0;
          let weekE = 0;
          let totalR = rides.length;
          let ratings = rides.filter(r => r.customer_rating).map(r => r.customer_rating);
          let avgR = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0;

          rides.forEach(r => {
              const rideDate = new Date(r.created_at);
              const earnings = Number(r.driver_earnings || r.price * 0.8);
              
              if (rideDate >= today) {
                  todayE += earnings;
                  todayR += 1;
              }
              if (rideDate >= weekAgo) {
                  weekE += earnings;
              }
          });

          setStats({
              todayEarnings: todayE,
              todayRides: todayR,
              weekEarnings: weekE,
              totalRides: totalR,
              avgRating: avgR
          });
      }
  }, [currentUserId]);

  useEffect(() => {
      if (currentUserId) fetchStats();
  }, [currentUserId, fetchStats, ride?.status]);

  useEffect(() => {
      if (activeTab === 'history' && driverProfile?.id) {
          const fetchHistory = async () => {
               let query = supabase.from('rides')
                  .select('*, client_details:profiles!public_rides_customer_id_fkey(*)')
                  .eq('driver_id', driverProfile.id)
                  .order('created_at', { ascending: false });

               if (historyFilter === 'today') {
                   const today = new Date();
                   today.setHours(0, 0, 0, 0);
                   query = query.gte('created_at', today.toISOString());
               } else if (historyFilter === 'week') {
                   const weekAgo = new Date();
                   weekAgo.setDate(weekAgo.getDate() - 7);
                   weekAgo.setHours(0, 0, 0, 0);
                   query = query.gte('created_at', weekAgo.toISOString());
               }

               const { data } = await query;
               if (data) setHistoryItems(data);
          };
          fetchHistory();
      }
  }, [activeTab, driverProfile?.id, historyFilter]);

  useEffect(() => {
      const fetchPricing = async () => {
          const [catsRes, adminConfigRes] = await Promise.all([
              supabase.from('car_categories').select('*').eq('active', true).order('base_fare', { ascending: true }),
              supabase.from('admin_config').select('*')
          ]);
          if (catsRes.data) setCategories(catsRes.data);
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

  const handleMapClick = async (lat: number, lng: number) => {
      if (!mapSelectionMode) return;
      
      if (!window.google || !window.google.maps) {
          showError("Aguarde o mapa carregar ou verifique sua conexão.");
          return;
      }
      
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
              setShowManualRide(true);
              showSuccess("Local definido pelo mapa!");
          } else {
              showError("Não foi possível identificar este endereço.");
          }
      });
  };

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
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
          drivingOptions: {
              departureTime: new Date(),
              trafficModel: google.maps.TrafficModel.BEST_GUESS
          }
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
      let baseFare = Number(category.base_fare);
      let appliedMinFare = Number(category.min_fare);

      // Aplicando a mesma regra flexível e dinâmica do aplicativo de clientes!
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

          if (start > end) { 
              return currentTime >= start || currentTime <= end;
          } else {
              return currentTime >= start && currentTime <= end;
          }
      };

      if (checkNightPeriod(rules.night_start_2, rules.night_end_2, rules.night_km_2)) {
          isNight = true;
          nightKmPrice = Number(rules.night_km_2);
          if (rules.night_min_fare_2) appliedMinFare = Number(rules.night_min_fare_2);
      } else if (checkNightPeriod(rules.night_start, rules.night_end, rules.night_km)) {
          isNight = true;
          nightKmPrice = Number(rules.night_km);
          if (rules.night_min_fare) appliedMinFare = Number(rules.night_min_fare);
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

          for (const t of thresholds) {
              if (routeDistance >= t.dist) {
                  appliedKmPrice = t.price;
                  break;
              }
          }
      }

      price = baseFare + (routeDistance * appliedKmPrice) + (routeDuration * costPerMinute);

      const validStops = stops.filter(s => s && s.lat && s.lon);
      price += validStops.length * costPerStop;

      price = price * globalMultiplier;

      if (price < appliedMinFare) {
          price = appliedMinFare;
      }
      
      return parseFloat(price.toFixed(2));
  }, [categories, routeDistance, routeDuration, categoryRules, globalMultiplier, stops, costPerStop]);

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
      unlockAudio();
      if (driverProfile?.id) {
          await supabase.from('profiles').update({ is_online: val, last_active: new Date().toISOString() }).eq('id', driverProfile.id);
      }
      if (val) {
          await refreshAvailableRides();
          showSuccess("Você está Online!");
          if ('Notification' in window) Notification.requestPermission();
      }
  };

  const handleSaveGoal = () => {
      const newGoal = Number(tempGoal);
      if (isNaN(newGoal) || newGoal <= 0) {
          showError("Insira um valor válido.");
          return;
      }
      setDailyGoal(newGoal);
      localStorage.setItem('driver_daily_goal', newGoal.toString());
      setIsEditingGoal(false);
      showSuccess("Meta diária atualizada!");
  };

  const handleCreateManual = async () => {
      if (!pickupLocation || !destLocation || !passengerName) {
          showError("Preencha todos os campos.");
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
          showSuccess("Viagem iniciada!");
      } catch (e: any) {
          showError(e.message);
      } finally {
          setManualLoading(false);
      }
  };

  const getCurrentLocation = () => {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                  setPickupLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, display_name: results[0].formatted_address });
              }
              setGpsLoading(false);
          });
      }, (error) => { setGpsLoading(false); showError("GPS desativado."); }, { enableHighAccuracy: true });
  };

  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride?.status || '');
  const isCompleted = ride?.status === 'COMPLETED';
  const isCancelled = ride?.status === 'CANCELLED';
  const hasAvailableRides = availableRides.length > 0;
  
  const currentStops = ride?.stops && Array.isArray(ride.stops) ? ride.stops : [];
  const nextStopIndex = currentStops.findIndex((s: any) => !s.completed);
  const nextStop = nextStopIndex !== -1 ? currentStops[nextStopIndex] : null;

  const goalProgress = Math.min(100, Math.round((stats.todayEarnings / dailyGoal) * 100));

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      <img src="/app-logo.png" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-50 pointer-events-none drop-shadow-md rounded-lg" />
      
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
                    onClick={() => { setMapSelectionMode(null); setShowManualRide(true); }}
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

      <div className="absolute inset-0 z-0">
          <GoogleMapComponent 
            className="h-full w-full" 
            pickupLocation={mapSelectionMode === 'pickup' ? pickupLocation : pickupCoord} 
            destinationLocation={mapSelectionMode === 'destination' ? destLocation : destCoord} 
            stops={isOnTrip ? currentStops : (showManualRide && stops.length > 0 ? stops : null)}
            onMapClick={handleMapClick}
            interactive={!!mapSelectionMode}
          />
      </div>

      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none mt-4">
          {isOnline && !isOnTrip && !isCompleted && !isCancelled ? (
              <div className="pointer-events-auto backdrop-blur-xl border border-white/20 p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg bg-black/80">
                 <Switch checked={isOnline} onCheckedChange={toggleOnline} />
                 <span className="text-xs font-bold uppercase text-white">Online</span>
                 {trackingActive && <Zap className="w-3 h-3 text-yellow-500 animate-pulse" />}
              </div>
          ) : <div />}

          <div className="pointer-events-auto bg-white/10 backdrop-blur-xl p-1 rounded-full shadow-lg cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 border-2 border-white"><AvatarImage src={driverProfile?.avatar_url} /><AvatarFallback className="bg-slate-900 text-white font-bold">{driverProfile?.first_name?.[0]}</AvatarFallback></Avatar>
          </div>
      </div>

      {isOnTrip && (
          <div className="absolute top-24 right-4 z-40 pointer-events-auto animate-in fade-in zoom-in">
              <Button 
                variant="destructive" 
                size="icon" 
                className="w-14 h-14 rounded-full shadow-2xl border-4 border-white animate-pulse"
                onClick={() => showError("🚨 ALERTA SOS ENVIADO! A central de segurança foi notificada.")}
              >
                  <ShieldAlert className="w-7 h-7" />
              </Button>
          </div>
      )}

      {activeTab === 'home' && !isOnTrip && !isCompleted && !isCancelled && isOnline && !mapSelectionMode && (
          <div className="absolute top-24 left-4 right-4 z-20 pointer-events-auto animate-in slide-in-from-top-4">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/50">
                  <div className="flex justify-between items-center mb-4">
                      <div className="flex flex-col">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ganhos Hoje</p>
                          <p className="text-xl font-black text-slate-900">R$ {stats.todayEarnings.toFixed(2)}</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div className="flex flex-col items-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viagens</p>
                          <p className="text-xl font-black text-slate-900">{stats.todayRides}</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div className="flex flex-col items-end">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avaliação</p>
                          <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                              <p className="text-xl font-black text-slate-900">{stats.avgRating.toFixed(1)}</p>
                          </div>
                      </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                              <Target className="w-3 h-3 text-blue-600" />
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta Diária: R$ {dailyGoal}</p>
                              <button onClick={() => { setTempGoal(dailyGoal.toString()); setIsEditingGoal(true); }} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                                  <Pencil className="w-3 h-3 text-slate-400" />
                              </button>
                          </div>
                          <p className="text-[10px] font-black text-blue-600 uppercase">{goalProgress}%</p>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", goalProgress >= 100 ? "bg-green-500" : "bg-blue-600")} 
                            style={{ width: `${goalProgress}%` }}
                          />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isOnline && !isOnTrip && !isCompleted && !isCancelled && !mapSelectionMode && (
          <div className="absolute bottom-28 left-4 z-40 pointer-events-auto flex flex-col gap-3">
              <Button 
                onClick={() => setShowManualRide(true)} 
                className="w-16 h-16 rounded-full bg-yellow-500 text-black shadow-2xl border-4 border-white hover:bg-yellow-400 transition-all active:scale-90 flex items-center justify-center group"
              >
                  <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
              </Button>
          </div>
      )}

      {!mapSelectionMode && (
          <div className="absolute bottom-28 right-4 z-40 pointer-events-auto">
              <Button size="icon" className="w-14 h-14 rounded-full bg-white text-slate-700 shadow-2xl border border-slate-100 hover:bg-slate-50" onClick={getCurrentLocation}>
                  {gpsLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Navigation className="w-6 h-6 text-blue-600 fill-blue-600/20" />}
              </Button>
          </div>
      )}

      <div className="absolute inset-0 z-10 flex flex-col justify-end pb-32 pointer-events-none p-4">
         {activeTab === 'home' && !mapSelectionMode && (
            <div className="w-full max-w-md mx-auto pointer-events-auto flex flex-col h-full">
                {!ride && !isOnline && (
                    <div className="flex flex-col items-center w-full mt-auto mb-10 animate-in zoom-in-95">
                        <div className="bg-white/95 backdrop-blur-xl px-6 py-3 rounded-full shadow-lg mb-8 text-sm font-black text-slate-800 uppercase tracking-widest border border-slate-100 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                            VOCÊ ESTÁ OFFLINE
                        </div>
                        <button onClick={() => toggleOnline(true)} className="w-28 h-28 bg-[#276ef1] rounded-full flex flex-col items-center justify-center text-white font-black shadow-[0_10px_40px_rgba(39,110,241,0.6)] border-[6px] border-white transition-transform active:scale-90">
                            <span className="text-xl tracking-widest mt-1">INICIAR</span>
                        </button>
                    </div>
                )}

                {!ride && isOnline && !hasAvailableRides && (
                    <div className="flex flex-col gap-4 items-center w-full mt-auto mb-10">
                        <div className="bg-black/80 backdrop-blur-xl px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-pulse border border-white/10 text-white font-black uppercase text-xs">
                            <div className="w-3 h-3 bg-green-500 rounded-full" /> PROCURANDO PEDIDOS...
                        </div>
                    </div>
                )}

                {isCancelled && (
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center border border-gray-100 mt-auto animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><XCircle className="w-10 h-10 text-red-600" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Corrida Cancelada</h2>
                        <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl shadow-xl" onClick={() => clearRide()}>VOLTAR</Button>
                    </div>
                )}

                {isCompleted && (
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center border border-gray-100 mt-auto animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><DollarSign className="w-10 h-10 text-green-600" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">R$ {Number(ride.price).toFixed(2)}</h2>
                        <div className="flex justify-center gap-3 mb-6">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => setRating(star)} className="transition-transform active:scale-90"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200'}`} /></button>))}</div>
                        <Button className="w-full h-14 bg-black text-white font-bold rounded-2xl shadow-xl" onClick={async () => { await rateRide(ride.id, rating || 5, true); clearRide(); setRating(0); }}>PRÓXIMA CORRIDA</Button>
                    </div>
                )}

                {isOnTrip && (
                    <div className="bg-white p-6 rounded-[32px] shadow-2xl border border-gray-100 mt-auto animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <Badge className="bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] px-3 py-1">{ride?.status === 'ACCEPTED' ? 'A CAMINHO' : ride?.status === 'ARRIVED' ? 'NO LOCAL' : 'EM VIAGEM'}</Badge>
                            <span className="font-black text-lg">R$ {Number(ride?.price).toFixed(2)}</span>
                        </div>
                        <ScrollArea className="max-h-[35vh]">
                            {ride?.status === 'ACCEPTED' && <NavigationBlock label="Embarque" lat={ride.pickup_lat} lng={ride.pickup_lng} address={ride.pickup_address} />}
                            {ride?.status === 'ARRIVED' && <div className="bg-green-50 p-4 rounded-2xl text-center mb-4 border border-green-100 font-black text-green-800 text-sm animate-pulse">Aguardando passageiro...</div>}
                            {ride?.status === 'IN_PROGRESS' && (
                                nextStop ? <NavigationBlock label={`Parada (${nextStopIndex + 1})`} lat={nextStop.lat} lng={nextStop.lon || nextStop.lng} address={nextStop.display_name} />
                                : <NavigationBlock label="Destino" lat={ride.destination_lat} lng={ride.destination_lng} address={ride.destination_address} icon={Flag} />
                            )}
                        </ScrollArea>
                        
                        {ride?.ride_notes && (
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 flex items-start gap-3">
                                <StickyNote className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Nota do Passageiro</p>
                                    <p className="text-sm font-bold text-blue-900">{ride.ride_notes}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 mt-4">
                             <Avatar className="w-12 h-12 border-2 border-white"><AvatarImage src={ride?.client_details?.avatar_url} /><AvatarFallback>{ride?.client_details?.first_name?.[0] || 'P'}</AvatarFallback></Avatar>
                             <div className="flex-1"><h3 className="font-black text-slate-900 leading-tight">{ride?.client_details?.first_name || ride?.guest_name}</h3><p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Nota: 5.0 ⭐</p></div>
                             <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={() => setShowChat(true)}><MessageCircle className="w-4 h-4" /></Button>
                        </div>
                        {ride?.status === 'ACCEPTED' && <Button className="w-full h-16 bg-slate-900 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => confirmArrival(ride.id)}>CHEGUEI NO LOCAL</Button>}
                        {ride?.status === 'ARRIVED' && <Button className="w-full h-16 bg-green-600 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => startRide(ride.id)}>INICIAR VIAGEM</Button>}
                        {ride?.status === 'IN_PROGRESS' && (
                            nextStop ? <Button className="w-full h-16 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => completeStop(ride.id, nextStopIndex, currentStops)}>PARADA {nextStopIndex + 1} CONCLUÍDA</Button>
                            : <Button className="w-full h-16 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => finishRide(ride.id)}>FINALIZAR CORRIDA</Button>
                        )}
                    </div>
                )}
            </div>
         )}

         {activeTab === 'history' && (
             <div className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl p-6 rounded-[32px] shadow-2xl border border-white/40 h-[75vh] flex flex-col animate-in slide-in-from-bottom-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><History className="w-6 h-6" /> Meu Histórico</h2>
                    <Button variant="ghost" size="icon" onClick={() => setActiveTab('home')} className="rounded-full"><X className="w-5 h-5" /></Button>
                </div>

                <div className="flex gap-2 mb-6">
                    {(['today', 'week', 'all'] as const).map(f => (
                        <button key={f} onClick={() => setHistoryFilter(f)} className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", historyFilter === f ? "bg-slate-900 text-white shadow-lg" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                            {f === 'today' ? 'Hoje' : f === 'week' ? 'Semana' : 'Tudo'}
                        </button>
                    ))}
                </div>

                <ScrollArea className="flex-1">
                    {historyItems.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center"><History className="w-8 h-8 opacity-20" /></div>
                            <p className="text-sm font-medium">Nenhuma viagem encontrada.</p>
                        </div>
                    ) : historyItems.map(item => (
                        <div key={item.id} className="mb-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-slate-200 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    <p className="font-black text-slate-900 text-sm mt-0.5">{item.client_details?.first_name || item.guest_name || 'Passageiro'}</p>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-green-600 block">R$ {Number(item.driver_earnings || item.price * 0.8).toFixed(2)}</span>
                                    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase border-0 px-2 py-0.5", item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{item.status}</Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 text-[11px] text-gray-500 truncate">
                                <Flag className="w-3 h-3 shrink-0 text-slate-400" /> {item.destination_address}
                            </div>
                        </div>
                    ))}
                </ScrollArea>
             </div>
         )}
      </div>

      <Dialog open={isEditingGoal} onOpenChange={setIsEditingGoal}>
          <DialogContent className="max-w-xs bg-white rounded-[32px] border-0 shadow-2xl p-6">
              <DialogHeader>
                  <DialogTitle className="text-xl font-black text-slate-900">Meta Diária</DialogTitle>
                  <DialogDescription className="text-sm font-medium text-slate-500">Quanto você deseja ganhar hoje?</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                      <Input 
                        type="number" 
                        value={tempGoal} 
                        onChange={e => setTempGoal(e.target.value)} 
                        className="h-14 pl-12 rounded-2xl bg-slate-50 border-slate-100 font-black text-xl"
                      />
                  </div>
              </div>
              <DialogFooter className="flex gap-2">
                  <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold text-slate-400" onClick={() => setIsEditingGoal(false)}>Cancelar</Button>
                  <Button className="flex-1 h-12 bg-blue-600 text-white font-black rounded-xl shadow-lg" onClick={handleSaveGoal}>SALVAR</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={hasAvailableRides && isOnline && !ride} onOpenChange={() => {}}>
          <DialogContent className="max-w-md bg-white rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden outline-none">
              <DialogTitle className="sr-only">Nova Solicitação</DialogTitle>
              <div className="bg-yellow-500 p-6 text-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Car className="w-10 h-10 text-black" /></div>
                  <h2 className="text-2xl font-black text-black">Nova Solicitação!</h2>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50">
                  {availableRides.map(r => (
                      <div key={r.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <Avatar className="w-12 h-12 border-2 border-yellow-500"><AvatarImage src={r.client_details?.avatar_url} /><AvatarFallback className="font-bold bg-slate-100">{r.client_details?.first_name?.[0]}</AvatarFallback></Avatar>
                                  <div><p className="font-black text-slate-900 text-lg leading-tight">{r.client_details?.first_name}</p><Badge className="bg-slate-900 text-white text-[9px] px-2 py-0.5 uppercase">{r.category}</Badge></div>
                              </div>
                              <div className="text-right"><p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Valor</p><span className="text-2xl font-black text-green-600">R$ {Number(r.price).toFixed(2)}</span></div>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                              <p className="text-xs font-bold text-slate-700 line-clamp-1">📍 {r.pickup_address}</p>
                              <p className="text-xs font-black text-slate-900 line-clamp-1">🏁 {r.destination_address}</p>
                          </div>
                          <div className="flex gap-3 mt-2">
                              <Button variant="ghost" className="flex-1 text-red-500 font-bold h-14 rounded-2xl bg-red-50" onClick={() => rejectRide(r.id)}>Ignorar</Button>
                              <Button className="flex-[2] bg-slate-900 text-white font-black h-14 rounded-2xl text-lg shadow-xl" onClick={() => acceptRide(r.id)}>ACEITAR</Button>
                          </div>
                      </div>
                  ))}
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={showManualRide && !mapSelectionMode} onOpenChange={setShowManualRide}>
          <DialogContent className="max-w-md bg-white rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden outline-none">
              <DialogHeader className="p-6 bg-slate-900 text-white">
                  <DialogTitle className="text-2xl font-black">Nova Viagem de Rua</DialogTitle>
                  <DialogDescription className="text-slate-400 font-medium">Inicie uma corrida direto com o passageiro.</DialogDescription>
              </DialogHeader>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-white custom-scrollbar">
                  <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Nome do Passageiro</Label>
                      <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                            placeholder="Digite o nome do passageiro..." 
                            value={passengerName} 
                            onChange={e => setPassengerName(e.target.value)} 
                            className="h-14 pl-12 rounded-2xl bg-slate-50 border-slate-200 font-bold text-slate-900 focus:bg-white transition-all" 
                          />
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Local de Embarque</Label>
                          <div className="flex gap-2">
                              <GoogleLocationSearch placeholder="Onde o passageiro entrou?" onSelect={setPickupLocation} initialValue={pickupLocation?.display_name} className="flex-1" />
                              <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-500" onClick={() => { setShowManualRide(false); setMapSelectionMode('pickup'); }}><Map className="w-5 h-5" /></Button>
                              <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-slate-200 bg-slate-50" onClick={getCurrentLocation} disabled={gpsLoading}>
                                  {gpsLoading ? <Loader2 className="animate-spin" /> : <MapPin className="w-5 h-5 text-slate-600" />}
                              </Button>
                          </div>
                      </div>

                      {stops.map((stop, index) => (
                          <div key={index} className="flex gap-2 items-center animate-in slide-in-from-left">
                              <div className="w-10 flex justify-center shrink-0"><div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-slate-100" /></div>
                              <GoogleLocationSearch placeholder={`Parada ${index + 1}`} onSelect={(l) => { const newStops = [...stops]; newStops[index] = l; setStops(newStops); }} initialValue={stop?.display_name} className="flex-1" />
                              <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400" onClick={() => { const newStops = [...stops]; newStops.splice(index, 1); setStops(newStops); }}><X className="w-4 h-4" /></Button>
                          </div>
                      ))}

                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Destino Final</Label>
                          <div className="flex gap-2 items-center">
                              <GoogleLocationSearch placeholder="Para onde vamos?" onSelect={setDestLocation} initialValue={destLocation?.display_name} className="flex-1" />
                              <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-500" onClick={() => { setShowManualRide(false); setMapSelectionMode('destination'); }}><Map className="w-5 h-5" /></Button>
                              {stops.length < 2 && (
                                  <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl shrink-0 border-slate-200 bg-slate-50" onClick={() => setStops([...stops, null])}>
                                      <Plus className="w-5 h-5 text-slate-600" />
                                  </Button>
                              )}
                          </div>
                      </div>
                  </div>

                  {pickupLocation && destLocation && (
                      <div className="bg-yellow-50 p-6 rounded-[28px] border-2 border-yellow-200 text-center animate-in zoom-in-95">
                          {manualLoading ? (
                              <div className="flex flex-col items-center gap-3 py-2">
                                  <Loader2 className="animate-spin text-yellow-600 w-8 h-8" />
                                  <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest">Calculando Trajeto...</p>
                              </div>
                          ) : (
                              <>
                                  <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">Valor da Corrida</p>
                                  <h3 className="text-5xl font-black text-black tracking-tighter">R$ {calculatePrice().toFixed(2)}</h3>
                                  <div className="flex justify-center gap-3 mt-3">
                                      <Badge className="bg-white/50 text-yellow-800 font-bold border-yellow-200">{routeDistance.toFixed(1)} km</Badge>
                                      <Badge className="bg-white/50 text-yellow-800 font-bold border-yellow-200">{Math.round(routeDuration)} min</Badge>
                                  </div>
                              </>
                          )}
                      </div>
                  )}
              </div>
              <DialogFooter className="p-6 pt-0 bg-white">
                  <div className="flex gap-3 w-full">
                      <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold text-slate-400" onClick={() => setShowManualRide(false)}>CANCELAR</Button>
                      <Button 
                        className="flex-[2] h-14 bg-black text-white font-black rounded-2xl shadow-xl text-lg disabled:opacity-50" 
                        onClick={handleCreateManual} 
                        disabled={manualLoading || !destLocation || !passengerName || !pickupLocation}
                      >
                          INICIAR AGORA
                      </Button>
                  </div>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {!mapSelectionMode && <FloatingDock activeTab={activeTab} onTabChange={tab => { if(tab === 'profile') navigate('/profile'); else if(tab === 'wallet') navigate('/wallet'); else setActiveTab(tab); }} role="driver" />}
      
      {showChat && ride && currentUserId && (<RideChat rideId={ride.id} currentUserId={currentUserId} role="driver" otherUserName={ride.client_details?.first_name || 'Passageiro'} otherUserAvatar={ride.client_details?.avatar_url} onClose={() => setShowChat(false)} />)}
    </div>
  );
};

export default DriverDashboard;