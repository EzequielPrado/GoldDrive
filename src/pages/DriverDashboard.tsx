"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Wallet, MapPin, Navigation, DollarSign, Star, History, Car, ArrowRight, MessageCircle, Phone, Smartphone, Map, Flag, CheckCircle2, UserPlus, Clock, X, MousePointer2, Loader2, ChevronRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
        <div className="w-full mb-4">
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
  const { ride, availableRides, acceptRide, rejectRide, confirmArrival, finishRide, startRide, cancelRide, rateRide, clearRide, currentUserId, createManualRide } = useRide();
  
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [showManualRide, setShowManualRide] = useState(false);
  
  // Estados para Corrida Manual
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [pickupLocation, setPickupLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [destLocation, setDestLocation] = useState<{ lat: number, lon: number, display_name: string } | null>(null);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [manualLoading, setManualLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  
  // Localização para Google Maps
  const [pickupCoord, setPickupCoord] = useState<{lat: number, lon: number} | null>(null);
  const [destCoord, setDestCoord] = useState<{lat: number, lon: number} | null>(null);

  useEffect(() => {
    if (ride) {
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
          const [catsRes, tiersRes] = await Promise.all([
              supabase.from('car_categories').select('*').eq('active', true),
              supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true })
          ]);
          if (catsRes.data) setCategories(catsRes.data);
          if (tiersRes.data) setPricingTiers(tiersRes.data);
      };
      fetchPricing();
  }, []);

  const calculateRouteDistance = useCallback(() => {
      if (!pickupLocation || !destLocation) return;
      setManualLoading(true);
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix({
          origins: [{ lat: pickupLocation.lat, lng: pickupLocation.lon }],
          destinations: [{ lat: destLocation.lat, lng: destLocation.lon }],
          travelMode: google.maps.TravelMode.DRIVING
      }, (response, status) => {
          if (status === 'OK' && response?.rows[0].elements[0].distance) {
              setRouteDistance(response.rows[0].elements[0].distance.value / 1000);
          }
          setManualLoading(false);
      });
  }, [pickupLocation, destLocation]);

  useEffect(() => {
      if (pickupLocation && destLocation && showManualRide) {
          calculateRouteDistance();
      }
  }, [pickupLocation, destLocation, showManualRide, calculateRouteDistance]);

  const calculatePrice = useCallback(() => {
      if (routeDistance <= 0) return 0;
      const tier = pricingTiers.find(t => routeDistance <= Number(t.max_distance)) || pricingTiers[pricingTiers.length - 1];
      return Number(tier?.price || 15);
  }, [pricingTiers, routeDistance]);

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
      if (driverProfile?.id) await supabase.from('profiles').update({ is_online: val, last_active: new Date().toISOString() }).eq('id', driverProfile.id);
  };

  const handleCreateManual = async () => {
      if (!pickupLocation || !destLocation || !passengerName) return;
      setManualLoading(true);
      try {
          const price = calculatePrice();
          await createManualRide(
              passengerName, passengerPhone,
              pickupLocation.display_name, destLocation.display_name,
              { lat: pickupLocation.lat, lng: pickupLocation.lon },
              { lat: destLocation.lat, lng: destLocation.lon },
              price, `${routeDistance.toFixed(1)} km`, 'Manual'
          );
          setShowManualRide(false);
          setPassengerName("");
          setPassengerPhone("");
          setPickupLocation(null);
          setDestLocation(null);
          setRouteDistance(0);
      } catch (e: any) {
          showError("Erro ao lançar corrida.");
      } finally {
          setManualLoading(false);
      }
  };

  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride?.status || '');
  const isCompleted = ride?.status === 'COMPLETED';

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      <img src="/app-logo.jpg" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-50 pointer-events-none drop-shadow-md rounded-lg" />
      
      <div className="absolute inset-0 z-0">
          <GoogleMapComponent className="h-full w-full" pickupLocation={pickupCoord} destinationLocation={destCoord} />
      </div>

      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none mt-4">
          {!isOnTrip && !isCompleted && (
              <div className={`pointer-events-auto backdrop-blur-xl border border-white/20 p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg ${isOnline ? 'bg-black/80' : 'bg-white/80'}`}>
                 <Switch checked={isOnline} onCheckedChange={toggleOnline} />
                 <span className={`text-xs font-bold uppercase ${isOnline ? 'text-white' : 'text-slate-500'}`}>{isOnline ? 'Online' : 'Offline'}</span>
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

                {!ride && isOnline && (
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

                        {availableRides.length > 0 && (
                            <div className="w-full bg-white p-6 rounded-[32px] shadow-2xl mt-4 border border-gray-100 animate-in slide-in-from-bottom-4">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Nova Corrida Disponível!</h4>
                                {availableRides.map(r => (
                                    <div key={r.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="w-10 h-10 border-2 border-white"><AvatarImage src={r.client_details?.avatar_url} /><AvatarFallback>{r.client_details?.first_name?.[0]}</AvatarFallback></Avatar>
                                                <div><p className="font-bold text-slate-900">{r.client_details?.first_name}</p><p className="text-[10px] text-gray-500 font-bold uppercase">{r.distance}</p></div>
                                            </div>
                                            <span className="text-xl font-black text-green-600">R$ {Number(r.price).toFixed(2)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" className="flex-1 text-red-500 font-bold" onClick={() => rejectRide(r.id)}>Ignorar</Button>
                                            <Button className="flex-[2] bg-slate-900 text-white font-bold h-12 rounded-xl" onClick={() => acceptRide(r.id)}>Aceitar</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
                        {ride?.status === 'ACCEPTED' && <NavigationBlock label="Buscar Passageiro" lat={ride.pickup_lat} lng={ride.pickup_lng} address={ride.pickup_address} />}
                        {ride?.status === 'ARRIVED' && <div className="bg-green-50 p-6 rounded-2xl text-center mb-4 border border-green-100 animate-pulse"><p className="font-black text-green-800">Aguardando passageiro embarcar...</p></div>}
                        {ride?.status === 'IN_PROGRESS' && <NavigationBlock label="Destino Final" lat={ride.destination_lat} lng={ride.destination_lng} address={ride.destination_address} icon={Flag} />}
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
                             <Avatar className="w-12 h-12 border-2 border-white"><AvatarImage src={ride?.client_details?.avatar_url} /><AvatarFallback>{ride?.client_details?.first_name?.[0]}</AvatarFallback></Avatar>
                             <div className="flex-1"><h3 className="font-black text-slate-900 leading-tight">{ride?.client_details?.first_name} {ride?.client_details?.last_name}</h3><p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Nota: 5.0 ⭐</p></div>
                             <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={() => setShowChat(true)}><MessageCircle className="w-4 h-4" /></Button>
                             {ride?.client_details?.phone && <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={() => window.open(`tel:${ride.client_details.phone}`)}><Phone className="w-4 h-4" /></Button>}
                        </div>
                        {ride?.status === 'ACCEPTED' && <Button className="w-full h-16 bg-slate-900 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => confirmArrival(ride.id)}>CHEGUEI NO LOCAL</Button>}
                        {ride?.status === 'ARRIVED' && <Button className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => startRide(ride.id)}>INICIAR VIAGEM</Button>}
                        {ride?.status === 'IN_PROGRESS' && <Button className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl" onClick={() => finishRide(ride.id)}>FINALIZAR CORRIDA</Button>}
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

      {/* MODAL DE CORRIDA MANUAL CORRIGIDO */}
      <Dialog open={showManualRide} onOpenChange={setShowManualRide}>
          <DialogContent className="max-w-md bg-white rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="p-6 bg-slate-900 text-white">
                  <DialogTitle className="text-2xl font-black">Lançar Viagem</DialogTitle>
                  <DialogDescription className="text-slate-400">Preencha os dados da corrida manual abaixo.</DialogDescription>
              </DialogHeader>
              
              <div className="p-6 space-y-6 bg-white">
                  {/* Dados do Passageiro */}
                  <div className="space-y-4">
                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Nome do Passageiro</Label>
                          <Input 
                            placeholder="Ex: João Silva" 
                            value={passengerName} 
                            onChange={e => setPassengerName(e.target.value)} 
                            className="h-12 rounded-xl bg-slate-50 border-slate-200 text-slate-900 focus:bg-white transition-all font-bold placeholder:text-slate-300" 
                          />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Celular (Opcional)</Label>
                          <Input 
                            placeholder="(00) 00000-0000" 
                            value={passengerPhone} 
                            onChange={e => setPassengerPhone(e.target.value)} 
                            className="h-12 rounded-xl bg-slate-50 border-slate-200 text-slate-900 focus:bg-white transition-all font-bold placeholder:text-slate-300" 
                          />
                      </div>
                  </div>

                  {/* Rota */}
                  <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Local de Embarque</Label>
                          <GoogleLocationSearch placeholder="Onde o passageiro está?" onSelect={setPickupLocation} initialValue={pickupLocation?.display_name} />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Para onde ele vai?</Label>
                          <GoogleLocationSearch placeholder="Destino final" onSelect={setDestLocation} initialValue={destLocation?.display_name} />
                      </div>
                  </div>

                  {/* Resumo e Botão */}
                  <div className="pt-4 space-y-4">
                      {pickupLocation && destLocation && (
                          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 text-center animate-in zoom-in-95">
                              {manualLoading ? (
                                  <div className="flex flex-col items-center gap-2">
                                      <Loader2 className="animate-spin text-yellow-600 w-6 h-6" />
                                      <p className="text-[10px] font-bold text-yellow-700 uppercase">Calculando...</p>
                                  </div>
                              ) : (
                                  <>
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