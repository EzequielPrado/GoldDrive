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

      // Se sou motorista, procuro corridas onde sou o motorista. Se sou cliente, onde sou o cliente.
      const queryField = role === 'driver' ? 'driver_id' : 'customer_id';
      
      const { data: ridesData } = await supabase
        .from('rides')
        .select(`*, driver_details:profiles!public_rides_driver_id_fkey(*), client_details:profiles!public_rides_customer_id_fkey(*)`)
        .eq(queryField, userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ridesData && ridesData.length > 0) {
          const now = new Date().getTime();

          // Busca corridas em andamento com filtro de tempo para SEARCHING
          let targetRide = ridesData.find(r => {
              if (['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)) return true;
              if (r.status === 'SEARCHING') {
                  const createdAt = new Date(r.created_at).getTime();
                  // Se a corrida está procurando há mais de 10 minutos, consideramos expirada/travada
                  return ((now - createdAt) / 1000 / 60 <= 10);
              }
              return false;
          });
          
          if (!targetRide) {
              // Busca finalizadas recentemente para avaliação
              targetRide = ridesData.find(r => {
                  if (['COMPLETED', 'CANCELLED'].includes(r.status)) {
                      if (dismissedRidesRef.current.includes(r.id)) return false;
                      const hasRated = role === 'driver' ? !!r.customer_rating : !!r.driver_rating;
                      if (hasRated) return false;
                      const updatedAt = new Date(r.created_at).getTime();
                      return ((now - updatedAt) / 1000 / 60 <= 15); 
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
          const { data: ridesData, error } = await supabase.from('rides')
            .select('*')
            .eq('status', 'SEARCHING')
            .is('driver_id', null)
            .order('created_at', { ascending: false });

          if (error) throw error;

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
                      if (driverYear < min || driverYear > max) return false; 
                  }
                  return true;
              });
              
              setAvailableRides(prev => {
                  if (shouldPlaySound && validRides.length > prev.length) playNotification();
                  return validRides;
              });
          } else { 
              setAvailableRides([]); 
          }
      } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const channel = supabase.channel('ride_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async (payload) => {
            const uid = currentUserIdRef.current;
            if (!uid) return;

            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;

            if (userRoleRef.current === 'driver') {
                if (newRecord.status === 'SEARCHING' && !newRecord.driver_id) {
                    await fetchAvailableRides(true);
                } else {
                    setAvailableRides(prev => prev.filter(r => r.id !== (newRecord.id || oldRecord?.id)));
                }
            }

            if (newRecord?.customer_id === uid || newRecord?.driver_id === uid || oldRecord?.customer_id === uid || oldRecord?.driver_id === uid) {
                await fetchActiveRide(uid);
            }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setCurrentUserId(session.user.id);
            currentUserIdRef.current = session.user.id;
            
            const { data } = await supabase.from('profiles').select('role, car_year').eq('id', session.user.id).maybeSingle();
            if (data) {
                setUserRole(data.role as any);
                userRoleRef.current = data.role as any; 
                driverCarYearRef.current = parseInt(data.car_year) || 0;
            }
            
            const { data: configData } = await supabase.from('admin_config').select('value').eq('key', 'category_rules').maybeSingle();
            if (configData?.value) {
                try { categoryRulesRef.current = JSON.parse(configData.value); } catch(e) {}
            }

            await fetchActiveRide(session.user.id);
            if (userRoleRef.current === 'driver') {
                await fetchAvailableRides(false);
            }
        }
    };
    init();
  }, []);

  useEffect(() => {
      let interval: any;
      if (currentUserId) {
          interval = setInterval(() => {
              fetchActiveRide(currentUserId);
              if (userRoleRef.current === 'driver') fetchAvailableRides(false);
          }, 5000);
      }
      return () => clearInterval(interval);
  }, [currentUserId]);

  const requestRide = async (pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string, paymentMethod: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return false;

    try {
      const { data, error } = await supabase.from('rides').insert({
          customer_id: userId, 
          pickup_address: pickup, 
          destination_address: destination,
          pickup_lat: pickupCoords.lat, 
          pickup_lng: pickupCoords.lng,
          destination_lat: destCoords.lat, 
          destination_lng: destCoords.lng,
          price, 
          distance, 
          status: 'SEARCHING', 
          category, 
          payment_method: paymentMethod
      }).select().single();
      
      if (error) throw error;
      setRide(data);
      return true;
    } catch (e: any) { 
        toast({ title: "Erro ao solicitar", description: e.message, variant: "destructive" }); 
        return false; 
    }
  };

  const createManualRide = async (passengerName: string, passengerPhone: string, pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      try {
          const { data, error } = await supabase.from('rides').insert({
              customer_id: userId, 
              driver_id: userId, 
              pickup_address: pickup, 
              destination_address: destination,
              pickup_lat: pickupCoords.lat, 
              pickup_lng: pickupCoords.lng, 
              destination_lat: destCoords.lat, 
              destination_lng: destCoords.lng,
              price, 
              distance, 
              status: 'IN_PROGRESS', 
              category, 
              payment_method: 'CASH', 
              ride_type: 'MANUAL', 
              guest_name: passengerName, 
              driver_earnings: price
          }).select().single();
          
          if (error) throw error;
          setRide(data);
      } catch (e: any) { 
          toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }); 
      }
  };

  const cancelRide = async (rideId: string) => {
    try {
        await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', rideId);
        setRide(null);
        dismissedRidesRef.current.push(rideId);
    } catch (e) { console.error(e); }
  };

  const acceptRide = async (rideId: string) => {
     if (!currentUserId) return;
     try {
         const { data, error } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: currentUserId }).eq('id', rideId).is('driver_id', null).select();
         if (error || !data?.length) { toast({ title: "Corrida já aceita por outro motorista." }); return; }
         setAvailableRides(prev => prev.filter(r => r.id !== rideId));
         await fetchActiveRide(currentUserId);
     } catch (e) { toast({ title: "Erro ao aceitar" }); }
  };

  const rejectRide = async (rideId: string) => {
      rejectedIdsRef.current.push(rideId);
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
  };

  const confirmArrival = async (rideId: string) => { await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId); };
  const startRide = async (rideId: string) => { await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId); };
  const finishRide = async (rideId: string) => { await supabase.from('rides').update({ status: 'COMPLETED' }).eq('id', rideId); };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
      await supabase.from('rides').update(updateData).eq('id', rideId);
      clearRide();
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