import React, { useState, useEffect } from "react";
import { Wallet, MapPin, Navigation, Shield, DollarSign, Star, Menu, History, CheckCircle, Car, Calendar, ArrowRight, AlertTriangle, ChevronRight, TrendingUp, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import MapComponent from "@/components/MapComponent";
import { useRide, RideData } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import FloatingDock from "@/components/FloatingDock";
import { ScrollArea } from "@/components/ui/scroll-area";
import RideChat from "@/components/RideChat";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ride, availableRides, acceptRide, rejectRide, confirmArrival, finishRide, startRide, cancelRide, rateRide, currentUserId } = useRide();
  
  // Tabs & State
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<RideData | null>(null);
  const [timer, setTimer] = useState(30);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  
  // Modals Control
  const [showCarForm, setShowCarForm] = useState(false);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [showFinishScreen, setShowFinishScreen] = useState(false);
  const [finishedRideData, setFinishedRideData] = useState<any>(null);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  
  // Rating
  const [rating, setRating] = useState(0);

  // Forms & Data
  const [carData, setCarData] = useState({ model: '', plate: '', year: '', color: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride?.status || '');

  // Inicializa tab com base na URL
  useEffect(() => {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) {
          setActiveTab(tabParam);
      }
  }, [searchParams]);

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
          
          if (!data.car_model || !data.car_plate) { setShowCarForm(true); setIsOnline(false); }

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

  const handleSaveCar = async () => {
      if(!carData.model || !carData.plate || !carData.year) { showError("Preencha todos os campos"); return; }
      const { error } = await supabase.from('profiles').update({ car_model: carData.model, car_plate: carData.plate, car_year: carData.year, car_color: carData.color }).eq('id', driverProfile.id);
      if(error) showError(error.message); else { showSuccess("Veículo cadastrado!"); setShowCarForm(false); checkProfile(); }
  };

  useEffect(() => {
    if (isOnline && availableRides.length > 0 && !ride && activeTab === 'home') {
        setIncomingRide(availableRides[0]);
        setTimer(30);
    } else {
        setIncomingRide(null);
    }
  }, [availableRides, isOnline, ride, activeTab]);

  useEffect(() => { 
      if (incomingRide && timer > 0) { const i = setInterval(() => setTimer(t => t - 1), 1000); return () => clearInterval(i); } 
      else if (timer === 0 && incomingRide) { handleReject(); } 
  }, [incomingRide, timer]);

  const handleAccept = async () => { if (incomingRide) { await acceptRide(incomingRide.id); setIncomingRide(null); } };
  const handleReject = async () => { if (incomingRide) { await rejectRide(incomingRide.id); setIncomingRide(null); } };
  
  const handleCancelClick = () => setShowCancelAlert(true);
  
  const confirmCancel = async () => {
      if (ride) {
          await cancelRide(ride.id, "Cancelado pelo motorista");
          setShowCancelAlert(false);
      }
  };

  const handleFinish = async () => {
      if(ride) {
          // CORREÇÃO: Usa o valor total (price) em vez de 0.8
          setFinishedRideData({ ...ride, earned: Number(ride.price) });
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
      }
  };

  const toggleOnline = async (val: boolean) => { 
      if (val && (!driverProfile?.car_model)) { setShowCarForm(true); return; } 
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

  const cardBaseClasses = "bg-white/90 backdrop-blur-xl border border-white/40 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom duration-500 w-full";

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* MARCA D'ÁGUA FIXA NO TOPO */}
      <img src="/logo-goldmobile-2.png" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-6 opacity-80 z-50 pointer-events-none drop-shadow-md" />

      <div className="absolute inset-0 z-0">
          <MapComponent className="h-full w-full" showPickup={isOnTrip} />
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
                {!isOnline && (
                    <div className="bg-white/90 backdrop-blur-xl border border-white/40 p-8 rounded-[32px] shadow-2xl text-center animate-in zoom-in-95">
                        <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto flex items-center justify-center mb-6 relative">
                            <Car className="w-10 h-10 text-slate-400" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Vamos rodar?</h2>
                        <p className="text-gray-500 mb-8 max-w-xs mx-auto">Fique online para começar a receber chamadas na sua região.</p>
                        <Button size="lg" className="w-full h-14 text-lg bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:scale-105" onClick={() => toggleOnline(true)}>FICAR ONLINE</Button>
                    </div>
                )}

                {isOnline && !incomingRide && !isOnTrip && (
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-full shadow-2xl flex items-center justify-center gap-3 animate-in fade-in">
                        <div className="relative"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /><div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75" /></div>
                        <p className="text-white font-bold">Procurando passageiros...</p>
                    </div>
                )}

                {incomingRide && (
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom text-white">
                        <div className="flex justify-between items-center mb-4">
                            <Badge className="bg-green-500 text-black font-bold hover:bg-green-400 px-3 py-1">NOVA CORRIDA</Badge>
                            <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center font-bold text-lg">{timer}</div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl mb-4">
                             <Avatar className="h-10 w-10 border border-white/30">
                                 <AvatarImage src={incomingRide.client_details?.avatar_url} />
                                 <AvatarFallback>{incomingRide.client_details?.name?.[0]}</AvatarFallback>
                             </Avatar>
                             <div>
                                 <p className="font-bold text-sm">{incomingRide.client_details?.name || 'Passageiro'}</p>
                                 <div className="flex items-center gap-1 text-xs text-gray-300">
                                     <Phone className="w-3 h-3" /> 
                                     {incomingRide.client_details?.phone || 'Sem telefone'}
                                 </div>
                             </div>
                        </div>

                        <div className="text-center mb-6">
                            <p className="text-slate-400 text-xs uppercase font-bold mb-1">Valor da Corrida</p>
                            {/* CORREÇÃO: Mostrando valor TOTAL */}
                            <h2 className="text-5xl font-black tracking-tighter text-white">R$ {incomingRide.price.toFixed(2)}</h2>
                            <div className="flex justify-center gap-3 mt-4"><Badge variant="outline" className="border-white/20 text-slate-300">{incomingRide.distance}</Badge><Badge variant="outline" className="border-white/20 text-slate-300">{incomingRide.category}</Badge></div>
                        </div>

                        <div className="space-y-4 mb-8 bg-white/5 p-4 rounded-2xl border border-white/10">
                             <div className="flex items-start gap-3"><div className="w-2 h-2 mt-2 bg-white rounded-full"/><div><p className="text-xs text-slate-400 font-bold uppercase">Embarque</p><p className="font-medium text-sm leading-tight">{incomingRide.pickup_address}</p></div></div>
                             <div className="flex items-start gap-3"><div className="w-2 h-2 mt-2 bg-green-500 rounded-full"/><div><p className="text-xs text-slate-400 font-bold uppercase">Destino</p><p className="font-medium text-sm leading-tight">{incomingRide.destination_address}</p></div></div>
                        </div>

                        {/* CORREÇÃO: Contraste do Botão Aceitar */}
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="ghost" className="h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold" onClick={handleReject}>Recusar</Button>
                            <Button className="h-14 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black animate-pulse shadow-lg shadow-green-500/20" onClick={handleAccept}>ACEITAR</Button>
                        </div>
                    </div>
                )}

                {isOnTrip && !showFinishScreen && (
                     <div className={cardBaseClasses}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <Badge className="mb-2 bg-black text-white hover:bg-black">{ride?.status === 'ACCEPTED' ? 'A CAMINHO' : ride?.status === 'ARRIVED' ? 'NO LOCAL' : 'EM VIAGEM'}</Badge>
                                <h3 className="text-2xl font-bold text-slate-900">{ride?.client_details?.name}</h3>
                                {ride?.client_details?.phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {ride.client_details.phone}</p>}
                            </div>
                            {/* CORREÇÃO: Valor Total */}
                            <div className="text-right"><h3 className="text-3xl font-black text-slate-900">R$ {Number(ride?.price).toFixed(2)}</h3><p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Valor</p></div>
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

         {/* --- VIEW: HISTÓRICO (Com Valor Total) --- */}
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
                                        <p className="font-bold text-slate-900 text-sm">{item.customer?.first_name || 'Passageiro'}</p>
                                        <p className="text-xs text-gray-500">{formatDate(item.created_at).day} • {formatDate(item.created_at).time}</p>
                                    </div>
                                </div>
                                <span className="font-black text-green-700">R$ {Number(item.price).toFixed(2)}</span>
                             </div>
                             <p className="text-xs text-gray-500 truncate mt-1">{item.destination_address}</p>
                         </div>
                     ))}
                 </ScrollArea>
            </div>
         )}

         {/* ... (Wallet Tab mantida) ... */}
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

      {/* ... (Dialogs de Carro e Cancel mantidos) ... */}
      <Dialog open={showCarForm} onOpenChange={(open) => !open && (!driverProfile?.car_model ? setShowCarForm(true) : setShowCarForm(false))}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0"><DialogHeader><DialogTitle>Cadastro do Veículo</DialogTitle><DialogDescription>Dados obrigatórios para rodar.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label>Modelo</Label><Input value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className="rounded-xl" /></div><div className="grid gap-2"><Label>Placa</Label><Input value={carData.plate} onChange={e => setCarData({...carData, plate: e.target.value.toUpperCase()})} className="rounded-xl" /></div><div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Ano</Label><Input value={carData.year} type="number" onChange={e => setCarData({...carData, year: e.target.value})} className="rounded-xl" /></div><div className="grid gap-2"><Label>Cor</Label><Input value={carData.color} onChange={e => setCarData({...carData, color: e.target.value})} className="rounded-xl" /></div></div></div><DialogFooter><Button onClick={handleSaveCar} className="w-full bg-black rounded-xl h-12 font-bold">Salvar Veículo</Button></DialogFooter></DialogContent>
      </Dialog>

      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
          <AlertDialogContent className="rounded-3xl bg-white border-0"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle /> Cancelar Corrida?</AlertDialogTitle><AlertDialogDescription>Esta ação prejudica sua taxa de aceitação.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl h-12">Voltar</AlertDialogCancel><AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-700 rounded-xl h-12 font-bold text-white">Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* MODAL DETALHES DA CORRIDA (REDESENHADO) */}
      <Dialog open={showHistoryDetail} onOpenChange={setShowHistoryDetail}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0 p-0 overflow-hidden">
              <div className="bg-slate-900 p-6 text-white text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Detalhes da Viagem</p>
                  <h2 className="text-3xl font-black">R$ {Number(selectedHistoryItem?.price).toFixed(2)}</h2>
                  <p className="text-slate-400 text-sm mt-1">{selectedHistoryItem ? new Date(selectedHistoryItem.created_at).toLocaleDateString() + ' • ' + new Date(selectedHistoryItem.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</p>
              </div>
              <div className="p-6 space-y-6">
                  {/* Passageiro */}
                  <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-4 border border-gray-100">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-sm"><AvatarImage src={selectedHistoryItem?.customer?.avatar_url} /><AvatarFallback className="bg-slate-200 text-slate-600 font-bold">{selectedHistoryItem?.customer?.first_name?.[0]}</AvatarFallback></Avatar>
                      <div>
                          <p className="font-bold text-slate-900">{selectedHistoryItem?.customer?.first_name} {selectedHistoryItem?.customer?.last_name}</p>
                          <p className="text-xs text-gray-500">{selectedHistoryItem?.customer?.phone || 'Sem telefone'}</p>
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

                  {/* Valores (Atualizado) */}
                  <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center justify-between">
                       <div><p className="text-gray-400 text-xs font-bold uppercase">Valor Total</p><h3 className="text-3xl font-black">R$ {Number(selectedHistoryItem?.price).toFixed(2)}</h3></div>
                  </div>
                  
                  {/* Infos Extras */}
                  <div className="grid grid-cols-2 gap-4 text-center">
                       <div className="bg-gray-50 p-3 rounded-xl"><p className="text-xs text-gray-400 font-bold uppercase">Avaliação</p><div className="flex items-center justify-center gap-1 font-bold text-slate-900"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {selectedHistoryItem?.customer_rating || '-'}</div></div>
                       <div className="bg-gray-50 p-3 rounded-xl"><p className="text-xs text-gray-400 font-bold uppercase">Data</p><p className="font-bold text-slate-900">{selectedHistoryItem ? new Date(selectedHistoryItem.created_at).toLocaleDateString() : '-'}</p></div>
                  </div>

                  <div className="pt-2">
                      <Button className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold rounded-xl" onClick={() => setSelectedHistoryItem(null)}>Fechar Detalhes</Button>
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
                      <p className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2">Valor da Corrida</p>
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
            otherUserName={ride.client_details?.name || 'Passageiro'}
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