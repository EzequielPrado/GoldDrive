import React, { useState, useEffect } from "react";
import { Wallet, User, MapPin, Navigation, Shield, DollarSign, Clock, Star, Menu, Home, List, History, XCircle, CheckCircle, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import MapComponent from "@/components/MapComponent";
import { useRide, RideData } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { ride, availableRides, acceptRide, rejectRide, confirmArrival, finishRide, startRide, cancelRide, rateRide, clearRide } = useRide();
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'wallet'>('home');
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<RideData | null>(null);
  const [timer, setTimer] = useState(15);
  const [rating, setRating] = useState(0);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showCarForm, setShowCarForm] = useState(false);
  const [carData, setCarData] = useState({ model: '', plate: '', year: '', color: '' });
  
  // Histórico Detalhado
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Estados
  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status);
  const isRating = ride?.status === 'COMPLETED';
  const isCancelled = ride?.status === 'CANCELLED';

  useEffect(() => { checkProfile(); }, [activeTab]);

  const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if(user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setDriverProfile(data);
          if (!data.car_model || !data.car_plate) { setShowCarForm(true); setIsOnline(false); }
          if (activeTab === 'history') {
               const { data: rides } = await supabase.from('rides')
                .select('*, customer:profiles!customer_id(first_name, last_name, avatar_url)')
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
    if (isOnline && availableRides.length > 0 && !ride && activeTab === 'home') { setIncomingRide(availableRides[0]); setTimer(15); } else { setIncomingRide(null); }
  }, [availableRides, isOnline, ride, activeTab]);

  useEffect(() => { if (incomingRide && timer > 0) { const i = setInterval(() => setTimer(t => t - 1), 1000); return () => clearInterval(i); } else if (timer === 0 && incomingRide) { handleReject(); } }, [incomingRide, timer]);

  const handleAccept = async () => { if (incomingRide) { await acceptRide(incomingRide.id); setIncomingRide(null); } };
  const handleReject = async () => { if (incomingRide) { await rejectRide(incomingRide.id); setIncomingRide(null); } };
  const handleCancel = async () => { if (ride && confirm("Cancelar corrida?")) await cancelRide(ride.id, "Cancelado pelo motorista"); };
  const handleSubmitRating = async (stars: number) => { if (ride) await rateRide(ride.id, stars, true); };
  const handleClearCancelled = () => { clearRide(); };
  const toggleOnline = (val: boolean) => { if (val && (!driverProfile?.car_model)) { setShowCarForm(true); return; } setIsOnline(val); };

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative overflow-hidden">
      <Dialog open={showCarForm} onOpenChange={(open) => !open && (!driverProfile?.car_model ? setShowCarForm(true) : setShowCarForm(false))}>
          <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Cadastro do Veículo</DialogTitle><DialogDescription>Dados obrigatórios para rodar.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label>Modelo (ex: Civic)</Label><Input value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} /></div><div className="grid gap-2"><Label>Placa</Label><Input value={carData.plate} onChange={e => setCarData({...carData, plate: e.target.value.toUpperCase()})} /></div><div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Ano</Label><Input value={carData.year} type="number" onChange={e => setCarData({...carData, year: e.target.value})} /></div><div className="grid gap-2"><Label>Cor</Label><Input value={carData.color} onChange={e => setCarData({...carData, color: e.target.value})} /></div></div></div><DialogFooter><Button onClick={handleSaveCar} className="w-full bg-black">Salvar</Button></DialogFooter></DialogContent>
      </Dialog>
      
      {/* Detalhes Histórico Modal */}
      <Dialog open={!!selectedHistoryItem} onOpenChange={(o) => !o && setSelectedHistoryItem(null)}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Detalhes da Corrida</DialogTitle><DialogDescription>{new Date(selectedHistoryItem?.created_at).toLocaleString()}</DialogDescription></DialogHeader>
              <div className="space-y-4">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"><span className="font-bold">{selectedHistoryItem?.category}</span><Badge variant={selectedHistoryItem?.status === 'COMPLETED' ? 'default' : 'destructive'}>{selectedHistoryItem?.status}</Badge></div>
                  {selectedHistoryItem?.customer && (<div className="flex items-center gap-3 border-t pt-3"><Avatar><AvatarFallback>{selectedHistoryItem.customer.first_name[0]}</AvatarFallback></Avatar><div><p className="font-bold">{selectedHistoryItem.customer.first_name} {selectedHistoryItem.customer.last_name}</p><p className="text-xs text-gray-500">Passageiro</p></div></div>)}
                  <div className="space-y-2 border-t pt-2"><div className="flex items-start gap-2"><div className="w-2 h-2 mt-2 bg-blue-500 rounded-full"/><div><p className="text-xs text-gray-400">Origem</p><p className="font-medium text-sm">{selectedHistoryItem?.pickup_address}</p></div></div><div className="flex items-start gap-2"><div className="w-2 h-2 mt-2 bg-green-500 rounded-full"/><div><p className="text-xs text-gray-400">Destino</p><p className="font-medium text-sm">{selectedHistoryItem?.destination_address}</p></div></div></div>
                  <div className="flex justify-between items-center border-t pt-3"><span className="font-bold text-gray-500">Seu Ganho</span><span className="font-bold text-xl text-green-600">R$ {selectedHistoryItem?.driver_earnings}</span></div>
              </div>
          </DialogContent>
      </Dialog>

      <header className="bg-zinc-900 text-white p-4 shadow-md z-30 flex justify-between items-center">
         <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/profile')}><Avatar className="border-2 border-yellow-500"><AvatarImage src={driverProfile?.avatar_url} /><AvatarFallback className="bg-zinc-700 text-yellow-500 font-bold">GD</AvatarFallback></Avatar><div><div className="font-bold text-sm truncate max-w-[100px] text-yellow-500">GoldDrive</div><div className="text-xs text-gray-300">{driverProfile?.first_name}</div></div></div>
         {activeTab === 'home' && (<div className="flex items-center gap-3 bg-zinc-800 px-3 py-2 rounded-full border border-zinc-700"><span className={`text-[10px] font-bold ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>{isOnline ? 'ONLINE' : 'OFF'}</span><Switch checked={isOnline} onCheckedChange={toggleOnline} className="data-[state=checked]:bg-green-500 scale-75" /></div>)}
      </header>

      <div className="flex-1 relative overflow-y-auto">
         {/* Cancelamento Modal */}
         {isCancelled && (
             <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                 <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center animate-in zoom-in-95">
                     <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                     <h2 className="text-2xl font-bold mb-2">Corrida Cancelada</h2>
                     <p className="text-gray-500 mb-6">A corrida foi encerrada.</p>
                     <Button className="w-full h-12 text-lg font-bold bg-black" onClick={handleClearCancelled}>OK</Button>
                 </div>
             </div>
         )}
         
         {isRating && (<div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-zinc-900 text-white w-full max-w-sm rounded-3xl p-6 text-center animate-in zoom-in-95"><h2 className="text-2xl font-bold mb-2">Avaliar Passageiro</h2><p className="text-gray-400 mb-8">Como foi?</p><div className="flex justify-center gap-2 mb-8">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110 focus:outline-none"><Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600'}`} /></button>))}</div><Button className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 mb-3" onClick={() => handleSubmitRating(rating || 5)}>Confirmar</Button></div></div>)}

        {activeTab === 'home' && (
            isOnline ? (
                <div className="h-full w-full relative">
                    <MapComponent className="h-full w-full" showPickup={isOnTrip} />
                    {!isOnTrip && !incomingRide && !isRating && !isCancelled && (<div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 text-white px-6 py-2 rounded-full shadow-lg backdrop-blur z-20 flex items-center gap-2"><div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" /><p className="text-sm font-medium">GoldDrive buscando...</p></div>)}
                    {isOnTrip && !isRating && !isCancelled && (
                        <div className="absolute bottom-0 left-0 right-0 bg-white shadow-[0_-5px_30px_rgba(0,0,0,0.3)] z-20 animate-in slide-in-from-bottom duration-500 rounded-t-3xl">
                            <div className="p-6 pb-8">
                                <div className="flex justify-between items-center mb-6 border-b pb-4">
                                    <div><div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${ride?.status === 'ACCEPTED' ? 'bg-blue-500' : ride?.status === 'ARRIVED' ? 'bg-orange-500' : 'bg-green-600'}`}>{ride?.status === 'ACCEPTED' ? 'A CAMINHO' : ride?.status === 'ARRIVED' ? 'AGUARDANDO' : 'EM CORRIDA'}</span></div><h3 className="text-xl font-bold text-gray-900">{ride?.client_details?.name || 'Passageiro'}</h3><div className="flex items-center gap-1 text-xs text-gray-500"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400"/> {ride?.client_details?.rating?.toFixed(1) || '5.0'}</div></div>
                                    <div className="text-right"><h3 className="text-2xl font-black text-green-600">R$ {(ride?.price || 0) * 0.8}</h3><p className="text-gray-400 text-xs uppercase font-bold">Ganho Estimado</p></div>
                                </div>
                                <div className="space-y-4 mb-6"><div className="flex items-start gap-4"><div className="w-3 h-3 rounded-full bg-blue-500 mt-2 shrink-0" /><div><p className="text-xs text-gray-400 uppercase">Embarque</p><p className="text-sm font-medium leading-tight">{ride?.pickup_address}</p></div></div><div className="flex items-start gap-4"><div className="w-3 h-3 rounded-full bg-green-500 mt-2 shrink-0" /><div><p className="text-xs text-gray-400 uppercase">Destino</p><p className="text-sm font-medium leading-tight">{ride?.destination_address}</p></div></div></div>
                                <div className="flex flex-col gap-3">
                                    {ride?.status === 'ACCEPTED' && (<div className="flex gap-2"><Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-14" onClick={handleCancel}><XCircle className="mr-2 w-5 h-5" /> Cancelar</Button><Button className="flex-[2] h-14 text-lg bg-blue-600 hover:bg-blue-700 font-bold rounded-xl" onClick={() => confirmArrival(ride!.id)}><MapPin className="mr-2 h-5 w-5" /> Cheguei</Button></div>)}
                                    {ride?.status === 'ARRIVED' && (<div className="flex gap-2"><Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-14" onClick={handleCancel}><XCircle className="mr-2 w-5 h-5" /> Cancelar</Button><Button className="flex-[2] h-14 text-lg bg-green-600 hover:bg-green-700 font-bold rounded-xl animate-pulse" onClick={() => startRide(ride!.id)}><Navigation className="mr-2 h-5 w-5" /> Iniciar</Button></div>)}
                                    {ride?.status === 'IN_PROGRESS' && (<Button className="w-full py-6 h-16 text-xl bg-red-600 hover:bg-red-700 font-bold rounded-xl" onClick={() => finishRide(ride!.id)}><Shield className="mr-2 h-6 w-6" /> Finalizar Corrida</Button>)}
                                </div>
                            </div>
                        </div>
                    )}
                    {incomingRide && !isRating && !isCancelled && (<div className="absolute inset-0 z-50 flex flex-col bg-zinc-900 text-white animate-in slide-in-from-bottom duration-300"><div className="flex-1 flex flex-col items-center justify-center p-6 relative"><div className="absolute top-6 right-6 w-12 h-12 rounded-full border-4 border-white/20 flex items-center justify-center font-bold text-xl">{timer}</div><h2 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-2">GoldDrive Solicita</h2><h1 className="text-4xl sm:text-5xl font-black mb-1 text-center">{incomingRide.category}</h1><div className="bg-green-500/20 text-green-400 px-4 py-1 rounded-full text-sm font-bold mb-8 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Pagamento em Saldo</div><div className="w-full bg-zinc-800 rounded-2xl p-6 space-y-6 mb-8 mt-4"><div className="flex justify-between items-end border-b border-zinc-700 pb-4"><div><p className="text-gray-400 text-xs uppercase mb-1">Ganho Estimado</p><p className="text-4xl font-bold text-green-400">R$ {(incomingRide.price * 0.8).toFixed(2)}</p></div><div className="text-right"><p className="text-gray-400 text-xs uppercase mb-1">Distância</p><p className="text-2xl font-bold">{incomingRide.distance}</p></div></div><div className="space-y-4"><div className="flex items-start gap-4"><div className="w-3 h-3 rounded-full bg-white mt-2 shrink-0 shadow-[0_0_10px_white]" /><div><p className="text-xs text-gray-500 uppercase">Buscar em</p><p className="text-lg font-medium leading-tight line-clamp-2">{incomingRide.pickup_address}</p></div></div><div className="flex items-start gap-4"><div className="w-3 h-3 rounded-full bg-green-500 mt-2 shrink-0 shadow-[0_0_10px_#22c55e]" /><div><p className="text-xs text-gray-500 uppercase">Levar até</p><p className="text-lg font-medium leading-tight line-clamp-2">{incomingRide.destination_address}</p></div></div></div></div><div className="w-full grid grid-cols-2 gap-4"><Button variant="ghost" className="h-16 text-xl bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl" onClick={handleReject}>Recusar</Button><Button className="h-16 text-xl bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl animate-pulse" onClick={handleAccept}>ACEITAR</Button></div></div></div>)}
                </div>
            ) : (<div className="p-6 space-y-6 h-full bg-zinc-900 flex flex-col items-center justify-center text-center"><div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border-4 border-yellow-500/20"><Car className="w-16 h-16 text-yellow-500" /></div><h2 className="text-3xl font-bold text-white mb-2">GoldDrive</h2><p className="text-gray-400 mb-6">Fique online para receber corridas.</p><Button size="lg" className="w-full max-w-xs bg-yellow-500 hover:bg-yellow-600 text-black font-bold mt-4" onClick={() => toggleOnline(true)}>FICAR ONLINE</Button></div>)
        )}
        
        {activeTab === 'history' && (<div className="p-4 space-y-4"><h2 className="text-xl font-bold text-slate-800">Histórico</h2>{history.map(item => (<Card key={item.id} className="border-0 shadow-sm cursor-pointer hover:bg-gray-50" onClick={() => setSelectedHistoryItem(item)}><CardContent className="p-4 flex justify-between items-center"><div><p className="font-bold text-lg">{item.destination_address}</p><p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p><div className="flex items-center gap-1 mt-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /><span className="text-xs font-bold">{item.customer_rating || '-'}</span></div></div><div className="text-right"><p className="font-bold text-green-600">R$ {item.driver_earnings}</p><Badge variant={item.status === 'COMPLETED' ? 'outline' : 'destructive'} className="text-xs">{item.status}</Badge></div></CardContent></Card>))}</div>)}
        {activeTab === 'wallet' && (<div className="p-4 space-y-4"><Card className="bg-zinc-900 text-white border-0"><CardContent className="p-6"><p className="text-gray-400 text-sm">Saldo Atual</p><h2 className="text-4xl font-bold">R$ {driverProfile?.balance?.toFixed(2)}</h2></CardContent></Card><h3 className="font-bold mt-4">Extrato</h3>{transactions.map(t => (<div key={t.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between"><span className="text-sm font-medium">{t.description}</span><span className={`font-bold ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{t.amount > 0 ? '+' : ''} R$ {t.amount}</span></div>))}</div>)}
      </div>

      <div className="bg-white border-t p-2 flex justify-around"><Button variant="ghost" className={`flex-col h-14 gap-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => setActiveTab('home')}><Home className="w-6 h-6" /> <span className="text-xs">Início</span></Button><Button variant="ghost" className={`flex-col h-14 gap-1 ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => setActiveTab('history')}><List className="w-6 h-6" /> <span className="text-xs">Corridas</span></Button><Button variant="ghost" className={`flex-col h-14 gap-1 ${activeTab === 'wallet' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => setActiveTab('wallet')}><Wallet className="w-6 h-6" /> <span className="text-xs">Ganhos</span></Button></div>
    </div>
  );
};

export default DriverDashboard;