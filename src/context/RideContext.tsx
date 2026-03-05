import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface RideContextType {
  ride: any | null;
  availableRides: any[];
  loading: boolean;
  requestRide: (
      pickup: string, 
      destination: string, 
      pickupCoords: { lat: number, lng: number },
      destCoords: { lat: number, lng: number },
      price: number, 
      distance: string, 
      category: string, 
      paymentMethod: string
  ) => Promise<boolean>;
  createManualRide: (
      passengerName: string,
      passengerPhone: string,
      pickup: string,
      destination: string,
      pickupCoords: { lat: number, lng: number },
      destCoords: { lat: number, lng: number },
      price: number,
      distance: string,
      category: string
  ) => Promise<void>;
  cancelRide: (rideId: string, reason?: string) => Promise<void>;
  acceptRide: (rideId: string) => Promise<void>;
  rejectRide: (rideId: string) => Promise<void>;
  startRide: (rideId: string) => Promise<void>;
  finishRide: (rideId: string) => Promise<void>;
  rateRide: (rideId: string, rating: number, isDriver: boolean, comment?: string) => Promise<void>;
  confirmArrival: (rideId: string) => Promise<void>;
  addBalance: (amount: number) => Promise<void>;
  clearRide: () => void;
  currentUserId: string | null;
  userRole: 'client' | 'driver' | null;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export const RideProvider = ({ children }: { children: React.ReactNode }) => {
  const [ride, setRide] = useState<any | null>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'client' | 'driver' | null>(null);
  
  const userRoleRef = useRef(userRole);
  const currentUserIdRef = useRef(currentUserId);
  const driverCarYearRef = useRef<number>(0);
  const categoryRulesRef = useRef<any>({});
  
  const rejectedIdsRef = useRef<string[]>([]);
  const dismissedRidesRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
      userRoleRef.current = userRole;
      currentUserIdRef.current = currentUserId;
      if (!audioRef.current) {
          audioRef.current = new Audio(NOTIFICATION_SOUND);
      }
  }, [userRole, currentUserId]);

  useEffect(() => {
    const forceStopLoading = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(forceStopLoading);
  }, []);

  const playNotification = () => {
      if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Áudio bloqueado", e));
      }
  };

  const fetchActiveRide = async (userId: string) => {
    try {
      let role = userRoleRef.current;
      if (!role) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
          role = profile?.role || 'client';
          setUserRole(role);
          userRoleRef.current = role;
      }

      const queryField = role === 'driver' ? 'driver_id' : 'customer_id';
      
      // Busca 10 corridas recentes para garantir que não vamos perder a corrida ativa por causa de uma corrida antiga finalizada
      const { data: ridesData } = await supabase
        .from('rides')
        .select(`*, driver_details:profiles!public_rides_driver_id_fkey(*), client_details:profiles!public_rides_customer_id_fkey(*)`)
        .eq(queryField, userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (ridesData && ridesData.length > 0) {
          // 1. PRIORIDADE MÁXIMA: Encontrar corrida em andamento
          let targetRide = ridesData.find(r => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status));
          
          // 2. Se não houver ativa, busca uma finalizada recente pendente de avaliação
          if (!targetRide) {
              targetRide = ridesData.find(r => {
                  if (['COMPLETED', 'CANCELLED'].includes(r.status)) {
                      if (dismissedRidesRef.current.includes(r.id)) return false;
                      const hasRated = role === 'driver' ? !!r.customer_rating : !!r.driver_rating;
                      if (hasRated) return false;
                      const updatedAt = new Date(r.created_at).getTime();
                      const now = new Date().getTime();
                      return ((now - updatedAt) / 1000 / 60 <= 30); // 30 minutos
                  }
                  return false;
              });
          }

          if (targetRide) {
              if (targetRide.ride_type === 'MANUAL' && targetRide.guest_name) {
                  targetRide.client_details = { first_name: targetRide.guest_name, last_name: '', phone: targetRide.guest_phone, avatar_url: null };
              }
              setRide(targetRide);
              return;
          }
      }
      
      setRide(null);
    } catch (err) { console.error(err); }
  };

  const fetchAvailableRides = async (shouldPlaySound = false) => {
      const role = userRoleRef.current;
      const uid = currentUserIdRef.current;
      if (role !== 'driver' || !uid) return;

      try {
          const { data: ridesData } = await supabase.from('rides').select('*').eq('status', 'SEARCHING').is('driver_id', null).order('created_at', { ascending: false });
          if (ridesData && ridesData.length > 0) {
              const clientIds = [...new Set(ridesData.map(r => r.customer_id))];
              const { data: profilesData } = await supabase.from('profiles').select('*').in('id', clientIds);
              
              const enrichedRides = ridesData.map(r => ({
                  ...r,
                  client_details: profilesData?.find(p => p.id === r.customer_id) || { first_name: 'Passageiro' }
              }));
              
              const rules = categoryRulesRef.current;
              const driverYear = driverCarYearRef.current;
              
              const validRides = enrichedRides.filter(r => {
                  if (r.customer_id === uid || rejectedIdsRef.current.includes(r.id)) return false;
                  
                  const rule = rules[r.category];
                  if (rule && driverYear > 0) {
                      const min = parseInt(rule.min) || 0;
                      const max = parseInt(rule.max) || 9999;
                      if (driverYear < min || driverYear > max) {
                          return false; 
                      }
                  }
                  
                  return true;
              });
              
              setAvailableRides(prev => {
                  if (shouldPlaySound && validRides.length > prev.length) playNotification();
                  return validRides;
              });
          } else { setAvailableRides([]); }
      } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const channel = supabase.channel('global_ride_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async (payload) => {
            const newRecord = payload.new as any;
            const uid = currentUserIdRef.current;
            const role = userRoleRef.current;
            if (role === 'driver') {
                if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && newRecord.status === 'SEARCHING' && !newRecord.driver_id) await fetchAvailableRides(true);
                if (payload.eventType === 'UPDATE' && (newRecord.status !== 'SEARCHING' || newRecord.driver_id)) setAvailableRides(prev => prev.filter(r => r.id !== newRecord.id));
            }
            if ((newRecord?.customer_id === uid || newRecord?.driver_id === uid) && uid) await fetchActiveRide(uid);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setCurrentUserId(session.user.id);
            
            const { data } = await supabase.from('profiles').select('role, car_year').eq('id', session.user.id).maybeSingle();
            if (data) {
                setUserRole(data.role);
                userRoleRef.current = data.role; // Fix sincronização
                driverCarYearRef.current = parseInt(data.car_year) || 0;
            }
            
            const { data: configData } = await supabase.from('admin_config').select('value').eq('key', 'category_rules').maybeSingle();
            if (configData?.value) {
                try {
                    categoryRulesRef.current = JSON.parse(configData.value);
                } catch(e) {}
            }

            fetchActiveRide(session.user.id);
        }
    };
    init();
  }, []);

  useEffect(() => {
      let interval: any;
      if (currentUserId) interval = setInterval(() => fetchActiveRide(currentUserId), 3000);
      return () => clearInterval(interval);
  }, [currentUserId]);

  const requestRide = async (pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string, paymentMethod: string): Promise<boolean> => {
    if (!currentUserId) return false;
    try {
      const { data, error } = await supabase.from('rides').insert({
          customer_id: currentUserId, pickup_address: pickup, destination_address: destination,
          pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng,
          destination_lat: destCoords.lat, destination_lng: destCoords.lng,
          price, distance, status: 'SEARCHING', category, payment_method: paymentMethod
      }).select().single();
      if (error) throw error;
      setRide(data);
      return true;
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); return false; }
  };

  const createManualRide = async (passengerName: string, passengerPhone: string, pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string) => {
      if (!currentUserId) return;
      try {
          const { data, error } = await supabase.from('rides').insert({
              customer_id: currentUserId, driver_id: currentUserId, pickup_address: pickup, destination_address: destination,
              pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng, destination_lat: destCoords.lat, destination_lng: destCoords.lng,
              price, distance, status: 'IN_PROGRESS', category, payment_method: 'CASH', ride_type: 'MANUAL', guest_name: passengerName, driver_earnings: price
          }).select().single();
          if (error) throw error;
          setRide(data);
          toast({ title: "Corrida Manual Iniciada" });
      } catch (e) { toast({ title: "Erro ao criar", variant: "destructive" }); }
  };

  const cancelRide = async (rideId: string) => {
    try {
        const { data, error } = await supabase.rpc('cancel_ride_as_user', { ride_id_to_cancel: rideId });
        if (error) throw error;
        if (currentUserId) await fetchActiveRide(currentUserId);
        toast({ title: data || "Cancelado" });
    } catch (e: any) { 
        await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', rideId);
        if (currentUserId) await fetchActiveRide(currentUserId);
        toast({ title: "Cancelado" });
    }
  };

  const acceptRide = async (rideId: string) => {
     if (!currentUserId) return;
     try {
         const { data, error } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: currentUserId }).eq('id', rideId).is('driver_id', null).select();
         if (error || !data?.length) { toast({ title: "Corrida não disponível", variant: "destructive" }); return; }
         
         setAvailableRides(prev => prev.filter(r => r.id !== rideId)); // Oculta da lista
         await fetchActiveRide(currentUserId);
     } catch (e) { toast({ title: "Erro ao aceitar" }); }
  };

  const rejectRide = async (rideId: string) => {
      rejectedIdsRef.current.push(rideId);
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
  };

  const confirmArrival = async (rideId: string) => { 
      await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId); 
      if (currentUserId) await fetchActiveRide(currentUserId);
  };
  
  const startRide = async (rideId: string) => { 
      await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId); 
      if (currentUserId) await fetchActiveRide(currentUserId);
  };
  
  const finishRide = async (rideId: string) => { 
      await supabase.from('rides').update({ status: 'COMPLETED' }).eq('id', rideId); 
      if (currentUserId) await fetchActiveRide(currentUserId);
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
      await supabase.from('rides').update(updateData).eq('id', rideId);
      clearRide();
      toast({ title: "Avaliação enviada" });
  };

  const addBalance = async (amount: number) => {
      if(!currentUserId) return;
      const { data } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
      await supabase.from('profiles').update({ balance: (data?.balance || 0) + amount }).eq('id', currentUserId);
  };

  const clearRide = () => { if (ride?.id) dismissedRidesRef.current.push(ride.id); setRide(null); };

  return (
    <RideContext.Provider value={{ 
        ride, availableRides, loading, requestRide, createManualRide, cancelRide, acceptRide, rejectRide, 
        startRide, finishRide, rateRide, confirmArrival, addBalance, clearRide, currentUserId, userRole 
    }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) throw new Error('useRide deve ser usado com RideProvider');
  return context;
};