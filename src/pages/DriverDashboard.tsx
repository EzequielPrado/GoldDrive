import React, { useState, useEffect } from "react";
import { Wallet, MapPin, Navigation, Shield, DollarSign, Star, Menu, History, CheckCircle, Car, Calendar, ArrowRight, AlertTriangle, ChevronRight, TrendingUp, MessageCircle, Phone, XCircle, UserPlus, Clock, MousePointer2, User, X, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import MapComponent from "@/components/MapComponent";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import FloatingDock from "@/components/FloatingDock";
import { ScrollArea } from "@/components/ui/scroll-area";
import RideChat from "@/components/RideChat";
import { Input } from "@/components/ui/input";
import LocationSearch from "@/components/LocationSearch";
import { Label } from "@/components/ui/label";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ride, availableRides, acceptRide, rejectRide, confirmArrival, finishRide, startRide, cancelRide, rateRide, clearRide, currentUserId, createManualRide } = useRide();
  
  // Tabs & State
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<any | null>(null);
  const [timer, setTimer] = useState(30);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  
  // Maçaneta (Manual Ride) State
  const [showManualRideModal, setShowManualRideModal] = useState(false);
  const [manualForm, setManualForm] = useState({
      name: "", phone: "", pickup: null as any, dest: null as any
  });
  const [manualRoute, setManualRoute] = useState<{distance: number, price: number} | null>(null);
  const [calculatingManual, setCalculatingManual] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [gpsLoadingManual, setGpsLoadingManual] = useState(false);
  const [driverGps, setDriverGps] = useState<{lat: number, lon: number} | null>(null);
  
  // Modals Control
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [showFinishScreen, setShowFinishScreen] = useState(false);
  const [finishedRideData, setFinishedRideData] = useState<any>(null);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  
  // Rating
  const [rating, setRating] = useState(0);

  // Forms & Data
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Config Data
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [goldCategory, setGoldCategory] = useState<any>(null);

  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride?.status || '');

  // Inicializa tab com base na URL
  useEffect(() => {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) {
          setActiveTab(tabParam);
      }
  }, [searchParams]);

  useEffect(() => {
      // Pega GPS silenciosamente para melhorar busca
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setDriverGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          }, (err) => console.log("GPS silent check failed", err));
      }
  }, []);

  useEffect(() => {
      if (!currentUserId) return;

      const channel = supabase.channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUserId}`,
        },
        async (payload) => {
          if (payload.new.is_blocked) {
            await supabase.auth.signOut();
            window.location.href = '/login/driver?blocked=true';
          }
        }
      )
      .subscribe();

      // Busca configs para calculo da manual
      supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true }).then(({data}) => {
          if(data) setPricingTiers(data);
      });
      supabase.from('car_categories').select('*').eq('name', 'Gold Driver').single().then(({data}) => {
          if(data) setGoldCategory(data);
      });

      return () => {
        supabase.removeChannel(channel);
      };
  }, [currentUserId]);

  useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isOnline && driverProfile?.id) {
          const sendHeartbeat = async () => {
              await supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', driverProfile.id);
          };
          sendHeartbeat();
          interval = setInterval(sendHeartbeat, 120000);
      }
      return () => clearInterval(interval);
  }, [isOnline, driverProfile?.id]);

  useEffect(() => { checkProfile(); }, [activeTab]);

  // Efeito para calcular preço da manual
  useEffect(() => {
      const calc = async () => {
          if (manualForm.pickup && manualForm.dest && showManualRideModal) {
              setCalculatingManual(true);
              try {
                  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${manualForm.pickup.lon},${manualForm.pickup.lat};${manualForm.dest.lon},${manualForm.dest.lat}?overview=false`);
                  const data = await response.json();
                  if (data.routes && data.routes.length > 0) {
                      const distanceKm = data.routes[0].distance / 1000;
                      
                      // Calculo Simples Baseado na Tabela Gold
                      let price = 15;
                      const tier = pricingTiers.find(t => distanceKm <= Number(t.max_distance));
                      if (tier) price = Number(tier.price);
                      else if (pricingTiers.length > 0) price = Number(pricingTiers[pricingTiers.length - 1].price);
                      
                      setManualRoute({ distance: distanceKm, price });
                  }
              } catch (e) {
                  console.error(e);
              } finally {
                  setCalculatingManual(false);
              }
          } else {
              setManualRoute(null);
          }
      };
      calc();
  }, [manualForm.pickup, manualForm.dest, showManualRideModal]);

  const handleStartManualRide = async () => {
      if (!manualRoute || !manualForm.name || !manualForm.pickup || !manualForm.dest) {
          showError("Preencha todos os dados.");
          return;
      }
      
      setSubmittingManual(true);
      try {
          await createManualRide(
              manualForm.name,
              manualForm.phone,
              manualForm.pickup.display_name,
              manualForm.dest.display_name,
              { lat: manualForm.pickup.lat, lng: manualForm.pickup.lon },
              { lat: manualForm.dest.lat, lng: manualForm.dest.lon },
              manualRoute.price,
              `${manualRoute.distance.toFixed(1)} km`,
              'Gold Driver'
          );
          setShowManualRideModal(false);
          setManualForm({ name: "", phone: "", pickup: null, dest: null });
          setManualRoute(null);
      } catch (e: any) {
          showError(e.message);
      } finally {
          setSubmittingManual(false);
      }
  };

  const getManualGPS = () => {
      setGpsLoadingManual(true);
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
              async (pos) => {
                  try {
                      // Reverse geocode para pegar o endereço
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                      const data = await res.json();
                      const address = data.display_name || "Minha Localização Atual";
                      
                      setDriverGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });

                      setManualForm(prev => ({
                          ...prev,
                          pickup: {
                              lat: pos.coords.latitude,
                              lon: pos.coords.longitude,
                              display_name: address
                          }
                      }));
                      showSuccess("Localização atual definida!");
                  } catch (e) {
                      // Fallback se falhar reverse
                      setManualForm(prev => ({
                          ...prev,
                          pickup: {
                              lat: pos.coords.latitude,
                              lon: pos.coords.longitude,
                              display_name: "Localização Atual (GPS)"
                          }
                      }));
                  } finally {
                      setGpsLoadingManual(false);
                  }
              },
              (err) => {
                  console.error(err);
                  showError("Erro ao obter GPS.");
                  setGpsLoadingManual(false);
              },
              { enableHighAccuracy: true }
          );
      } else {
          showError("GPS não suportado.");
          setGpsLoadingManual(false);
      }
  };

  const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if(user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          
          if (data?.is_blocked) {
              await supabase.auth.signOut();
              window.location.href = '/login/driver?blocked=true';
              return;
          }

          if (data?.driver_status === 'PENDING') {
              navigate('/driver-pending');
              return;
          }

          setDriverProfile(data);
          
          if (data.is_online !== undefined) {
              setIsOnline(data.is_online);
          }
          
          if (activeTab === 'history') {
               const { data: rides } = await supabase.from('rides')
                .select(`*, customer:profiles!public_rides_customer_id_fkey(first_name, last_name, avatar_url, phone)`)
                .eq('driver_id', user.id)
                .order('created_at', { ascending: false });
               setHistory(rides || []);
          }
          if (activeTab === 'wallet') {
               const { data: trans } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
               setTransactions(trans || []);
          }
      }
  };

  // Gerenciamento Inteligente de Corridas Recebidas
  useEffect(() => {
    if (isOnline && !ride && activeTab === 'home') {
        const nextRide = availableRides[0]; 

        if (nextRide) {
            if (!incomingRide || incomingRide.id !== nextRide.id) {
                setIncomingRide(nextRide);
                setTimer(30); 
            }
        } else {
            if (incomingRide) setIncomingRide(null);
        }
    } else {
        if (incomingRide) setIncomingRide(null);
    }
  }, [availableRides, isOnline, ride, activeTab, incomingRide]);

  // Timer Regressivo
  useEffect(() => { 
      if (incomingRide && timer > 0) { 
          const i = setInterval(() => setTimer(t => t - 1), 1000); 
          return () => clearInterval(i); 
      } else if (timer === 0 && incomingRide) { 
          handleReject(); 
      } 
  }, [incomingRide, timer]);

  const handleAccept = async () => { if (incomingRide) { await acceptRide(incomingRide.id); setIncomingRide(null); } };
  
  const handleReject = async () => { 
      if (incomingRide) { 
          await rejectRide(incomingRide.id); 
          setIncomingRide(null); 
      } 
  };
  
  const handleCancelClick = () => setShowCancelAlert(true);
  
  const confirmCancel = async () => {
      if (ride) {
          await cancelRide(ride.id, "Cancelado pelo motorista");
          setShowCancelAlert(false);
      }
  };

  const handleFinish = async () => {
      if(ride) {
          const earned = Number(ride.driver_earnings) || Number(ride.price);
          setFinishedRideData({ ...ride, earned: earned });
          await finishRide(ride.id);
          setShowFinishScreen(true);
      }
  };

  const handleSubmitRating = async (stars: number) => {
      if (finishedRideData) {
          await rateRide(finishedRideData.id, stars, true);
          setShowFinishScreen(false);
          setRating(0);
          setFinishedRideData(null);
          clearRide(); 
      }
  };

  const toggleOnline = async (val: boolean) => { 
      setIsOnline(val);
      if (driverProfile?.id) {
          await supabase.from('profiles').update({ is_online: val, last_active: new Date().toISOString() }).eq('id', driverProfile.id);
      }
  };

  const handleTabChange = (tab: string) => {
      if (tab === 'profile') navigate('/profile');
      else setActiveTab(tab);
  };

  const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return {
          full: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
          day: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          weekday: date.toLocaleDateString('pt-BR', { weekday: 'long' })
      };
  };

  const openHistoryDetail = (item: any) => {
      setSelectedHistoryItem(item);
      setShowHistoryDetail(true);
  };

  const getDisplayPrice = (r: any) => {
      if (!r) return "0.00";
      const val = (r.driver_earnings && Number(r.driver_earnings) > 0) ? Number(r.driver_earnings) : Number(r.price);
      return val.toFixed(2);
  };

  const cardBaseClasses = "bg-white/90 backdrop-blur-xl border border-white/40 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom duration-500 w-full";

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* MARCA D'ÁGUA FIXA NO TOPO */}
      <img src="/logo-goldmobile-2.png" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-6 opacity-80 z-50 pointer-events-none drop-shadow-md" />

      <div className="absolute inset-0 z-0">
          <MapComponent className="h-full w-full" />
      </div>

      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none mt-4">
          <div className={`pointer-events-auto backdrop-blur-xl border border-white/20 p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg transition-all duration-300 ${isOnline ? 'bg-black/80' : 'bg-white/80'}`}>
             <Switch checked={isOnline} onCheckedChange={toggleOnline} className="data-[state=checked]:bg-green-500" />
             <span className={`text-xs font-bold uppercase tracking-wider ${isOnline ? 'text-white' : 'text-slate-500'}`}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <div className="pointer-events-auto bg-white/10 backdrop-blur-xl border border-white/20 p-1 rounded-full shadow-lg cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 ring-2 ring-white/30">
                 <AvatarImage src={driverProfile?.avatar_url} />
                 <AvatarFallback className="bg-slate-900 text-white font-bold">{driverProfile?.first_name?.[0]}</AvatarFallback>
             </Avatar>
          </div>
      </div>

      <div className="absolute inset-0 z-10 flex flex-col justify-end pb-32 md:pb-10 md:justify-center items-center pointer-events-none p-4">

         {/* --- VIEW: HOME --- */}
         {activeTab === 'home' && (
            <div className="w-full max-w-md pointer-events-auto transition-all duration-500">
                
                {/* TELA DE CANCELAMENTO */}
                {ride?.status === 'CANCELLED' && (
                    <div className={`${cardBaseClasses} text-center`}>
                        <div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-6">
                            <XCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Corrida Cancelada</h2>
                        <p className="text-gray-500 mb-8">O passageiro cancelou a solicitação ou você cancelou.</p>
                        <Button className="w-full h-14 text-lg font-bold bg-black text-white rounded-2xl hover:bg-zinc-800" onClick={clearRide}>
                            Voltar para o Mapa
                        </Button>
                    </div>
                )}

                {/* TELA ONLINE / OFFLINE */}
                {!ride && !isOnline && (
                    <div className="bg-white/90 backdrop-blur-xl border border-white/40 p-8 rounded-[32px] shadow-2xl text-center animate-in zoom-in-95">
                        <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto flex items-center justify-center mb-6 relative">
                            <Car className="w-10 h-10 text-slate-400" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Vamos rodar?</h2>
                        <p className="text-gray-500 mb-8 max-w-xs mx-auto">Fique online para começar a receber chamadas na sua região.</p>
                        <Button size="lg" className="w-full h-14 text-lg bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:scale-105" onClick={() => toggleOnline(true)}>FICAR ONLINE</Button>
                    </div>
                )}

                {/* STATUS BUSCANDO */}
                {!ride && isOnline && !incomingRide && (
                    <div className="flex flex-col gap-4 animate-in fade-in">
                        <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-full shadow-2xl flex items-center justify-center gap-3">
                            <div className="relative"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /><div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75" /></div>
                            <p className="text-white font-bold">Procurando passageiros...</p>
                        </div>
                        
                        {/* Botão Maçaneta com Borda Gold */}
                        <Button 
                            className="bg-white hover:bg-gray-50 text-slate-900 h-14 rounded-2xl shadow-xl border-2 border-yellow-500 backdrop-blur-lg flex items-center justify-center gap-3 font-black text-base hover:scale-[1.02] transition-transform"
                            onClick={() => setShowManualRideModal(true)}
                        >
                            <div className="w-8 h-8 bg-yellow-500 text-black rounded-full flex items-center justify-center shadow-md">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            Corrida Avulsa (Maçaneta)
                        </Button>
                    </div>
                )}

                {/* TELA DE CHAMADA RECEBIDA */}
                {!ride && incomingRide && (
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom text-white">
                        <div className="flex justify-between items-center mb-4">
                            <Badge className="bg-green-500 text-black font-bold hover:bg-green-400 px-3 py-1 animate-pulse">NOVA CORRIDA</Badge>
                            <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center font-bold text-lg">{timer}</div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl mb-4">
                             <Avatar className="h-10 w-10 border border-white/30">
                                 <AvatarImage src={incomingRide.client_details?.avatar_url} />
                                 <AvatarFallback>{incomingRide.client_details?.first_name?.[0]}</AvatarFallback>
                             </Avatar>
                             <div>
                                 <p className="font-bold text-sm">
                                     {incomingRide.client_details?.first_name ? `${incomingRide.client_details.first_name} ${incomingRide.client_details.last_name || ''}` : 'Passageiro'}
                                 </p>
                                 <div className="flex items-center gap-1 text-xs text-gray-300">
                                     <Phone className="w-3 h-3" /> 
                                     {incomingRide.client_details?.phone || 'Sem telefone'}
                                 </div>
                             </div>
                        </div>

                        <div className="text-center mb-6">
                            <p className="text-slate-400 text-xs uppercase font-bold mb-1">Valor da Corrida</p>
                            <h2 className="text-5xl font-black tracking-tighter text-green-400">R$ {getDisplayPrice(incomingRide)}</h2>
                            <div className="flex justify-center gap-3 mt-4"><Badge variant="outline" className="border-white/20 text-slate-300">{incomingRide.distance}</Badge><Badge variant="outline" className="border-white/20 text-slate-300">{incomingRide.category}</Badge></div>
                        </div>

                        <div className="space-y-4 mb-8 bg-white/5 p-4 rounded-2xl border border-white/10">
                             <div className="flex items-start gap-3"><div className="w-2 h-2 mt-2 bg-white rounded-full"/><div><p className="text-xs text-slate-400 font-bold uppercase">Embarque</p><p className="font-medium text-sm leading-tight">{incomingRide.pickup_address}</p></div></div>
                             <div className="flex items-start gap-3"><div className="w-2 h-2 mt-2 bg-green-500 rounded-full"/><div><p className="text-xs text-slate-400 font-bold uppercase">Destino</p><p className="font-medium text-sm leading-tight">{incomingRide.destination_address}</p></div></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="ghost" className="h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold" onClick={handleReject}>Recusar</Button>
                            <Button className="h-14 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black animate-pulse shadow-lg shadow-green-500/20" onClick={handleAccept}>ACEITAR</Button>
                        </div>
                    </div>
                )}

                {/* TELA DE CORRIDA ATIVA */}
                {isOnTrip && !showFinishScreen && (
                     <div className={cardBaseClasses}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <Badge className="mb-2 bg-black text-white hover:bg-black">{ride?.status === 'ACCEPTED' ? 'A CAMINHO' : ride?.status === 'ARRIVED' ? 'NO LOCAL' : 'EM VIAGEM'}</Badge>
                                <h3 className="text-2xl font-bold text-slate-900 truncate max-w-[180px]">{ride?.client_details?.first_name} {ride?.client_details?.last_name}</h3>
                                {ride?.client_details?.phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {ride.client_details.phone}</p>}
                            </div>
                            <div className="text-right"><h3 className="text-3xl font-black text-green-600">R$ {getDisplayPrice(ride)}</h3><p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Valor</p></div>
                        </div>

                        <div className="flex flex-col gap-3">
                             <div 
                                className="bg-gray-100 hover:bg-gray-200 p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors"
                                onClick={() => setShowChat(true)}
                             >
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-sm">
                                    <MessageCircle className="w-5 h-5" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-xs font-bold text-gray-500 uppercase">Mensagem para Passageiro</p>
                                    <p className="text-sm font-medium text-slate-900">Abrir chat...</p>
                                </div>
                             </div>

                             {ride?.status === 'ACCEPTED' && (<div className="flex gap-3"><Button variant="ghost" className="flex-1 text-red-500 hover:bg-red-50 h-14 rounded-xl font-bold" onClick={handleCancelClick}>Cancelar</Button><Button className="flex-[2] h-14 bg-black hover:bg-zinc-800 text-white font-bold rounded-xl" onClick={() => confirmArrival(ride!.id)}><MapPin className="mr-2 h-5 w-5" /> Confirmar Chegada</Button></div>)}
                             {ride?.status === 'ARRIVED' && (<div className="flex gap-3"><Button variant="ghost" className="flex-1 text-red-500 hover:bg-red-50 h-14 rounded-xl font-bold" onClick={handleCancelClick}>Cancelar</Button><Button className="flex-[2] h-14 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl animate-pulse" onClick={() => startRide(ride!.id)}><Navigation className="mr-2 h-5 w-5" /> Iniciar Corrida</Button></div>)}
                             {ride?.status === 'IN_PROGRESS' && (<Button className="w-full h-14 text-xl bg-black hover:bg-zinc-800 text-white font-bold rounded-xl" onClick={handleFinish}><Shield className="mr-2 h-6 w-6" /> Finalizar Viagem</Button>)}
                        </div>
                     </div>
                )}
            </div>
         )}

         {/* --- VIEW: HISTÓRICO --- */}
         {activeTab === 'history' && (
            <div className={`w-full max-w-md h-[65vh] ${cardBaseClasses} flex flex-col pointer-events-auto`}>
                 <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <History className="w-6 h-6" /> Corridas Realizadas
                 </h2>
                 <ScrollArea className="flex-1 -mr-2 pr-4 custom-scrollbar">
                     {history.length === 0 ? <p className="text-center text-gray-400 py-10">Nenhuma corrida ainda.</p> : history.map(item => (
                         <div key={item.id} onClick={() => openHistoryDetail(item)} className="mb-3 p-4 bg-white/50 border border-white/60 rounded-2xl hover:bg-white transition-all cursor-pointer shadow-sm group">
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="w-8 h-8 border border-white"><AvatarImage src={item.customer?.avatar_url} /><AvatarFallback>{item.customer?.first_name?.[0]}</AvatarFallback></Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900 text-sm">{item.customer?.first_name || (item.guest_name ? item.guest_name.split(' ')[0] : 'Passageiro')}</p>
                                            {item.ride_type === 'MANUAL' && (
                                                <Badge variant="secondary" className="text-[9px] h-5 bg-yellow-100 text-yellow-800 border-yellow-200 px-1.5">
                                                    MAÇANETA
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">{formatDate(item.created_at).day} • {formatDate(item.created_at).time}</p>
                                    </div>
                                </div>
                                <span className="font-black text-green-700">R$ {getDisplayPrice(item)}</span>
                             </div>
                             <p className="text-xs text-gray-500 truncate mt-1">{item.destination_address}</p>
                         </div>
                     ))}
                 </ScrollArea>
            </div>
         )}

         {/* --- VIEW: CARTEIRA --- */}
         {activeTab === 'wallet' && (
             <div className="w-full max-w-md pointer-events-auto animate-in slide-in-from-bottom">
                 <Card className="bg-black text-white border-0 shadow-2xl rounded-[32px] mb-4 overflow-hidden relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-[60px] opacity-20"></div>
                     <CardContent className="p-8 relative z-10 text-center">
                         <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Saldo Total</p>
                         <h2 className="text-5xl font-black mb-6">R$ {driverProfile?.balance?.toFixed(2)}</h2>
                         <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400 font-bold h-12 rounded-xl">Solicitar Saque</Button>
                     </CardContent>
                 </Card>
                 
                 <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-[32px] p-6 shadow-xl h-[30vh] overflow-hidden flex flex-col">
                     <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Extrato Recente</h3>
                     <ScrollArea className="flex-1">
                         {transactions.map(t => (
                             <div key={t.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                                 <div>
                                     <p className="font-bold text-sm text-slate-900">{t.description}</p>
                                     <p className="text-xs text-gray-400 flex items-center gap-1">
                                         {new Date(t.created_at).toLocaleDateString()}
                                         <span className="w-1 h-1 rounded-full bg-gray-300"/>
                                         {new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                     </p>
                                 </div>
                                 <span className={`font-bold ${t.amount > 0 ? 'text-green-600' : 'text-slate-900'}`}>{t.amount > 0 ? '+' : ''} R$ {Math.abs(t.amount).toFixed(2)}</span>
                             </div>
                         ))}
                     </ScrollArea>
                 </div>
             </div>
         )}

      </div>

      {/* --- MODAL MAÇANETA (DESIGN ABSURDO) --- */}
      <Dialog open={showManualRideModal} onOpenChange={setShowManualRideModal}>
          <DialogContent className="w-[95%] max-w-md bg-white rounded-[40px] border-0 p-0 overflow-hidden shadow-2xl h-auto max-h-[90vh] flex flex-col [&>button]:hidden">
              
              {/* Header Visual */}
              <div className="bg-gradient-to-r from-slate-900 to-black p-6 relative overflow-hidden text-white shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-[60px] opacity-30 pointer-events-none"></div>
                  
                  {/* Botão de Fechar NATIVO CORRIGIDO */}
                  <button 
                      className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm z-[60] outline-none" 
                      onClick={() => setShowManualRideModal(false)}
                      type="button"
                  >
                      <X className="w-5 h-5 text-white" />
                  </button>

                  <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20 shrink-0">
                          <UserPlus className="w-6 h-6 text-black" />
                      </div>
                      <div>
                          <h2 className="text-2xl font-black tracking-tight text-white leading-none">Nova Corrida</h2>
                          <p className="text-slate-400 font-medium text-xs flex items-center gap-2 mt-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              Modo Maçaneta Ativo
                          </p>
                      </div>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                  {/* Dados do Passageiro */}
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Passageiro</Label>
                              <div className="relative">
                                  <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                  <Input placeholder="Nome" className="h-11 pl-9 bg-slate-50 border-slate-200 rounded-xl font-bold text-sm text-black placeholder:text-gray-400" value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} />
                              </div>
                          </div>
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Telefone</Label>
                              <div className="relative">
                                  <Phone className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                  <Input placeholder="(34) 9..." className="h-11 pl-9 bg-slate-50 border-slate-200 rounded-xl font-bold text-sm text-black placeholder:text-gray-400" value={manualForm.phone} onChange={e => setManualForm({...manualForm, phone: e.target.value})} />
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Endereços com Botão GPS inteligente */}
                  <div className="space-y-4">
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Ponto de Partida</Label>
                          <div className="flex gap-2">
                              <div className="relative group flex-1">
                                  <div className="absolute left-3 top-4 z-20 pointer-events-none"><div className="w-2 h-2 bg-slate-900 rounded-full ring-2 ring-slate-100"></div></div>
                                  <LocationSearch 
                                      placeholder="Onde o passageiro está?" 
                                      icon={() => null} // Icone customizado acima
                                      onSelect={(val) => setManualForm({...manualForm, pickup: val})}
                                      initialValue={manualForm.pickup?.display_name}
                                      className="pl-2"
                                      referenceLat={driverGps?.lat}
                                      referenceLon={driverGps?.lon}
                                  />
                              </div>
                              <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="h-14 w-14 rounded-2xl shrink-0 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" 
                                  onClick={getManualGPS} 
                                  disabled={gpsLoadingManual}
                              >
                                  {gpsLoadingManual ? <Clock className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                              </Button>
                          </div>
                      </div>

                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Destino Final</Label>
                          <div className="relative group">
                              <div className="absolute left-3 top-4 z-20 pointer-events-none"><div className="w-2 h-2 bg-green-500 rounded-full ring-2 ring-green-100"></div></div>
                              <LocationSearch 
                                  placeholder="Para onde vamos?" 
                                  icon={() => null}
                                  onSelect={(val) => setManualForm({...manualForm, dest: val})}
                                  className="pl-2"
                                  referenceLat={manualForm.pickup?.lat || driverGps?.lat}
                                  referenceLon={manualForm.pickup?.lon || driverGps?.lon}
                              />
                          </div>
                      </div>
                  </div>

                  {/* Card Estimativa */}
                  {manualRoute ? (
                      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-800">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 rounded-full blur-[50px] opacity-20"></div>
                          <div className="relative z-10 flex justify-between items-center">
                              <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Distância</p>
                                  <p className="text-2xl font-bold">{manualRoute.distance.toFixed(1)} <span className="text-sm font-normal text-slate-500">km</span></p>
                              </div>
                              <div className="h-8 w-px bg-white/10"></div>
                              <div className="text-right">
                                  <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">Total a Cobrar</p>
                                  <p className="text-3xl font-black text-white">R$ {manualRoute.price.toFixed(2)}</p>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="text-center py-2">
                          <p className="text-slate-400 text-xs font-medium bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-100">Preencha os endereços para calcular o valor.</p>
                      </div>
                  )}
              </div>

              <div className="p-6 pt-0 bg-white shrink-0">
                  <Button 
                      className="w-full h-14 rounded-2xl font-black text-lg bg-yellow-500 hover:bg-yellow-400 text-black shadow-xl shadow-yellow-500/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
                      onClick={handleStartManualRide} 
                      disabled={calculatingManual || submittingManual || !manualForm.pickup || !manualForm.dest}
                  >
                      {calculatingManual ? (
                          <span className="flex items-center gap-2"><Clock className="w-5 h-5 animate-spin" /> Calculando...</span>
                      ) : submittingManual ? (
                          <span className="flex items-center gap-2"><Clock className="w-5 h-5 animate-spin" /> Iniciando...</span>
                      ) : (
                          <span className="flex items-center gap-2">INICIAR CORRIDA <ArrowRight className="w-6 h-6" /></span>
                      )}
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
          <AlertDialogContent className="rounded-3xl bg-white border-0"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> Cancelar Corrida?</AlertDialogTitle><AlertDialogDescription>Esta ação prejudica sua taxa de aceitação.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl h-12">Voltar</AlertDialogCancel><AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-700 rounded-xl h-12 font-bold text-white">Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* MODAL DETALHES DA CORRIDA */}
      <Dialog open={showHistoryDetail} onOpenChange={setShowHistoryDetail}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0 p-0 overflow-hidden max-h-[80vh] flex flex-col">
              <div className="bg-slate-900 p-6 text-white text-center shrink-0">
                  {selectedHistoryItem?.ride_type === 'MANUAL' && (
                      <div className="mb-2 flex justify-center">
                          <Badge className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold border-0 px-3 py-1 flex items-center gap-1.5">
                              <Hand className="w-3 h-3" /> Corrida Avulsa (Maçaneta)
                          </Badge>
                      </div>
                  )}
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Ganhos da Viagem</p>
                  <h2 className="text-3xl font-black">R$ {getDisplayPrice(selectedHistoryItem)}</h2>
                  <p className="text-slate-400 text-sm mt-1">{selectedHistoryItem ? new Date(selectedHistoryItem.created_at).toLocaleDateString() + ' • ' + new Date(selectedHistoryItem.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</p>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                  {/* Passageiro */}
                  <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-sm"><AvatarImage src={selectedHistoryItem?.customer?.avatar_url} /><AvatarFallback className="bg-slate-200 text-slate-600 font-bold">{selectedHistoryItem?.customer?.first_name?.[0] || selectedHistoryItem?.guest_name?.[0]}</AvatarFallback></Avatar>
                      <div>
                          <p className="font-bold text-slate-900">{selectedHistoryItem?.customer?.first_name || (selectedHistoryItem?.guest_name ? selectedHistoryItem.guest_name : 'Passageiro')} {selectedHistoryItem?.customer?.last_name}</p>
                          <p className="text-xs text-gray-500">{selectedHistoryItem?.customer?.phone || selectedHistoryItem?.guest_phone || 'Sem telefone'}</p>
                      </div>
                  </div>

                  {/* Rota */}
                  <div className="space-y-4 px-2">
                       <div className="flex gap-4">
                           <div className="flex flex-col items-center pt-1"><div className="w-3 h-3 bg-slate-900 rounded-full" /><div className="w-0.5 flex-1 bg-gray-200 my-1 min-h-[30px]" /><div className="w-3 h-3 bg-green-500 rounded-full" /></div>
                           <div className="space-y-6 flex-1">
                               <div><p className="text-xs font-bold text-gray-400 uppercase">Origem</p><p className="font-medium text-slate-900 leading-tight">{selectedHistoryItem?.pickup_address}</p></div>
                               <div><p className="text-xs font-bold text-gray-400 uppercase">Destino</p><p className="font-medium text-slate-900 leading-tight">{selectedHistoryItem?.destination_address}</p></div>
                           </div>
                       </div>
                  </div>

                  {/* Valores */}
                  <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-3">
                       <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">Valor Total</span><span className="font-bold text-lg">R$ {Number(selectedHistoryItem?.price).toFixed(2)}</span></div>
                       <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">Taxa App</span><span className="font-bold text-lg text-red-400">- R$ {Number(selectedHistoryItem?.platform_fee).toFixed(2)}</span></div>
                       <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-3"><span className="text-white font-bold">Seu Ganho</span><span className="font-black text-2xl text-green-400">R$ {getDisplayPrice(selectedHistoryItem)}</span></div>
                  </div>
                  
                  {/* Infos Extras */}
                  <div className="grid grid-cols-2 gap-4 text-center">
                       <div className="bg-gray-50 p-3 rounded-xl"><p className="text-xs text-gray-400 font-bold uppercase">Avaliação</p><div className="flex items-center justify-center gap-1 font-bold text-slate-900"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {selectedHistoryItem?.customer_rating || '-'}</div></div>
                       <div className="bg-gray-50 p-3 rounded-xl"><p className="text-xs text-gray-400 font-bold uppercase">Data</p><p className="font-bold text-slate-900">{selectedHistoryItem ? new Date(selectedHistoryItem.created_at).toLocaleDateString() : '-'}</p></div>
                  </div>

                  <div className="pt-2">
                      <Button className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold rounded-xl" onClick={() => { setShowHistoryDetail(false); setSelectedHistoryItem(null); }}>Fechar Detalhes</Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* TELA DE SUCESSO (FINALIZAR CORRIDA) */}
      {showFinishScreen && finishedRideData && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom duration-500">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-2">Excelente!</h1>
              <p className="text-gray-500 mb-8">Corrida finalizada com sucesso.</p>

              <div className="w-full max-w-sm bg-gradient-to-b from-green-50 to-white rounded-3xl p-8 mb-8 border border-green-100 shadow-xl">
                  <div className="text-center border-b border-dashed border-green-200 pb-6 mb-6">
                      <p className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2">Seu Ganho</p>
                      <h2 className="text-6xl font-black text-slate-900 tracking-tighter">R$ {finishedRideData.earned.toFixed(2)}</h2>
                  </div>
              </div>

              <div className="text-center w-full max-w-sm">
                  <p className="font-bold mb-4 text-slate-600">Avalie o passageiro</p>
                  <div className="flex justify-center gap-3 mb-8">
                      {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setRating(star)} className="transition-all hover:scale-125 focus:outline-none">
                              <Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                          </button>
                      ))}
                  </div>
                  <Button className="w-full h-14 text-lg font-bold bg-slate-900 hover:bg-slate-800 rounded-2xl text-white" onClick={() => handleSubmitRating(rating || 5)}>Receber Nova Corrida</Button>
              </div>
          </div>
      )}

      {showChat && ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status) && currentUserId && (
          <RideChat 
            rideId={ride.id} 
            currentUserId={currentUserId} 
            role="driver"
            otherUserName={ride.client_details?.first_name || 'Passageiro'}
            otherUserAvatar={ride.client_details?.avatar_url}
            onClose={() => setShowChat(false)}
          />
      )}

      <div className="relative z-[100]">
         <FloatingDock activeTab={activeTab} onTabChange={handleTabChange} role="driver" />
      </div>
    </div>
  );
};

export default DriverDashboard;