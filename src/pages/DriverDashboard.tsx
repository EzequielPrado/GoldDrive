import React, { useState, useEffect, useRef } from "react";
import { Wallet, MapPin, Navigation, Shield, DollarSign, Star, Menu, History, CheckCircle, Car, Calendar, ArrowRight, AlertTriangle, ChevronRight, TrendingUp, MessageCircle, Phone, XCircle, UserPlus, Clock, MousePointer2, User, X, Hand, Map, Flag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  const [incomingRide, setIncomingRide] = useState<any | null>(null);
  const [timer, setTimer] = useState(60); 
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [showManualRideModal, setShowManualRideModal] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", phone: "", pickup: null as any, dest: null as any });
  const [manualRoute, setManualRoute] = useState<{distance: number, price: number} | null>(null);
  const [calculatingManual, setCalculatingManual] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [gpsLoadingManual, setGpsLoadingManual] = useState(false);
  const [driverGps, setDriverGps] = useState<{lat: number, lon: number} | null>(null);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showFinishScreen, setShowFinishScreen] = useState(false);
  const [finishedRideData, setFinishedRideData] = useState<any>(null);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [rating, setRating] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);

  const isOnTrip = !!ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride?.status || '');

  useEffect(() => {
      const tabParam = searchParams.get('tab');
      if (tabParam && ['home', 'history', 'wallet', 'profile'].includes(tabParam)) setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => { checkProfile(); }, [activeTab]);

  const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if(user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (data?.is_blocked) { await supabase.auth.signOut(); window.location.href = '/login/driver?blocked=true'; return; }
          if (data?.driver_status === 'PENDING') { navigate('/driver-pending'); return; }
          setDriverProfile(data);
          if (data.is_online !== undefined) setIsOnline(data.is_online);
          if (activeTab === 'history') {
               const { data: rides } = await supabase.from('rides').select(`*, customer:profiles!public_rides_customer_id_fkey(*)`).eq('driver_id', user.id).order('created_at', { ascending: false });
               setHistory(rides || []);
          }
          if (activeTab === 'wallet') {
               const { data: trans } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
               setTransactions(trans || []);
          }
      }
  };

  const toggleOnline = async (val: boolean) => { 
      setIsOnline(val);
      if (driverProfile?.id) await supabase.from('profiles').update({ is_online: val, last_active: new Date().toISOString() }).eq('id', driverProfile.id);
  };

  const handleTabChange = (tab: string) => {
      if (tab === 'profile') navigate('/profile');
      else setActiveTab(tab);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      <img src="/app-logo.jpg" alt="Logo" className="fixed top-4 left-1/2 -translate-x-1/2 h-8 opacity-90 z-50 pointer-events-none drop-shadow-md rounded-lg" />
      <div className="absolute inset-0 z-0"><MapComponent className="h-full w-full" /></div>
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none mt-4">
          {!isOnTrip && (
              <div className={`pointer-events-auto backdrop-blur-xl border border-white/20 p-2 pr-4 rounded-full flex items-center gap-3 shadow-lg ${isOnline ? 'bg-black/80' : 'bg-white/80'}`}>
                 <Switch checked={isOnline} onCheckedChange={toggleOnline} />
                 <span className={`text-xs font-bold uppercase ${isOnline ? 'text-white' : 'text-slate-500'}`}>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
          )}
          <div className="pointer-events-auto bg-white/10 backdrop-blur-xl p-1 rounded-full shadow-lg cursor-pointer" onClick={() => navigate('/profile')}>
             <Avatar className="h-10 w-10 border-2 border-white"><AvatarImage src={driverProfile?.avatar_url} /><AvatarFallback className="bg-slate-900 text-white font-bold">{driverProfile?.first_name?.[0]}</AvatarFallback></Avatar>
          </div>
      </div>
      <div className="absolute inset-0 z-10 flex flex-col justify-end pb-32 md:pb-10 md:justify-center items-center pointer-events-none p-4">
         {activeTab === 'home' && (
            <div className="w-full max-w-md pointer-events-auto">
                {!ride && !isOnline && (<div className="bg-white/90 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl text-center"><Car className="w-10 h-10 mx-auto mb-6 text-slate-400" /><h2 className="text-3xl font-black text-slate-900 mb-2">Vamos rodar?</h2><Button size="lg" className="w-full h-14 bg-slate-900 text-white font-bold rounded-2xl" onClick={() => toggleOnline(true)}>FICAR ONLINE</Button></div>)}
                {!ride && isOnline && !incomingRide && (<div className="flex flex-col gap-4 animate-in fade-in"><div className="bg-black/60 backdrop-blur-xl px-6 py-4 rounded-full shadow-2xl flex items-center justify-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /><p className="text-white font-bold">Procurando passageiros...</p></div></div>)}
            </div>
         )}
      </div>
      <div className="relative z-[100]"><FloatingDock activeTab={activeTab} onTabChange={handleTabChange} role="driver" /></div>
    </div>
  );
};

export default DriverDashboard;