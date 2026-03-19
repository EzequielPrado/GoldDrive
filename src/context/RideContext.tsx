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
  refreshAvailableRides: () => Promise<void>;
  currentUserId: string | null;
  userRole: 'client' | 'driver' | null;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2530/2530-preview.mp3";

export const RideProvider = ({ children }: { children: React.ReactNode }) => {
  const [ride, setRide] = useState<any | null>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'client' | 'driver' | null>(null);
  
  const userRoleRef = useRef(userRole);
  const currentUserIdRef = useRef(currentUserId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const alertedRideIds = useRef<Set<string>>(new Set());
  const dismissedRidesRef = useRef<string[]>([]);
  const rejectedIdsRef = useRef<string[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
      userRoleRef.current = userRole;
      currentUserIdRef.current = currentUserId;
      if (!audioRef.current) {
          audioRef.current = new Audio(NOTIFICATION_SOUND);
          audioRef.current.load();
      }
  }, [userRole, currentUserId]);

  const playNotification = () => {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
      }
  };

  const fetchActiveRide = async (userId: string) => {
    try {
      let role = userRoleRef.current;
      if (!role) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
          role = (profile?.role as any) || 'client';
          setUserRole(role);
          userRoleRef.current = role;
      }

      const { data: ridesData, error } = await supabase
        .from('rides')
        .select(`*, driver_details:profiles!public_rides_driver_id_fkey(*), client_details:profiles!public_rides_customer_id_fkey(*)`)
        .or(`customer_id.eq.${userId},driver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      if (ridesData && ridesData.length > 0) {
          let targetRide = ridesData.find(r => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status));
          
          if (!targetRide) {
              const mostRecent = ridesData[0];
              const dismissed = dismissedRidesRef.current || [];
              if (!dismissed.includes(mostRecent.id)) {
                  if (mostRecent.status === 'COMPLETED') {
                      const hasRated = role === 'driver' ? !!mostRecent.customer_rating : !!mostRecent.driver_rating;
                      if (!hasRated) targetRide = mostRecent;
                  } else if (mostRecent.status === 'CANCELLED') {
                      const rideAgeMinutes = (new Date().getTime() - new Date(mostRecent.created_at).getTime()) / 60000;
                      if (rideAgeMinutes <= 2) targetRide = mostRecent;
                  }
              }
          }

          if (targetRide) {
              setRide(targetRide);
              return;
          }
      }
      setRide(null);
    } catch (err) { console.error("Erro fetchActiveRide:", err); }
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
              
              const rejected = rejectedIdsRef.current || [];
              const validRides = ridesData.map(r => ({
                  ...r,
                  client_details: profilesData?.find(p => p.id === r.customer_id) || { first_name: 'Passageiro' }
              })).filter(r => !rejected.includes(r.id));

              if (shouldPlaySound && validRides.length > 0) {
                  const hasNewRide = validRides.some(r => !alertedRideIds.current.has(r.id));
                  if (hasNewRide) {
                      validRides.forEach(r => alertedRideIds.current.add(r.id));
                      playNotification();
                  }
              }
              setAvailableRides(validRides);
          } else { 
              setAvailableRides([]); 
          }
      } catch (err) { console.error("Erro fetchAvailableRides:", err); }
  };

  const refreshAvailableRides = async () => {
      await fetchAvailableRides(false);
  };

  useEffect(() => {
    const channel = supabase.channel('ride_updates_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async (payload) => {
            const uid = currentUserIdRef.current;
            if (!uid) return;

            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;

            if (userRoleRef.current === 'driver' && newRecord.status === 'SEARCHING' && !newRecord.driver_id) {
                await fetchAvailableRides(true);
            }

            const involvesMe = newRecord?.customer_id === uid || newRecord?.driver_id === uid || oldRecord?.customer_id === uid || oldRecord?.driver_id === uid;
            if (involvesMe) {
                setTimeout(() => fetchActiveRide(uid), 500);
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
            const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
            if (data) {
                setUserRole(data.role as any);
                userRoleRef.current = data.role as any; 
            }
            await fetchActiveRide(session.user.id);
            if (userRoleRef.current === 'driver') await fetchAvailableRides(false);
        }
        setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
      let interval: any;
      if (currentUserId) {
          interval = setInterval(() => {
              fetchActiveRide(currentUserId);
              if (userRoleRef.current === 'driver') fetchAvailableRides(false);
          }, 3500);
      }
      return () => clearInterval(interval);
  }, [currentUserId]);

  const requestRide = async (pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string, paymentMethod: string): Promise<boolean> => {
    const userId = currentUserIdRef.current;
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
      const userId = currentUserIdRef.current;
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
        if (dismissedRidesRef.current && !dismissedRidesRef.current.includes(rideId)) {
            dismissedRidesRef.current.push(rideId);
        }
        setRide(null);
    } catch (e) { console.error(e); }
  };

  const acceptRide = async (rideId: string) => {
     const uid = currentUserIdRef.current;
     if (!uid) return;
     try {
         const { data, error } = await supabase.from('rides')
            .update({ status: 'ACCEPTED', driver_id: uid })
            .eq('id', rideId)
            .is('driver_id', null)
            .select();
            
         if (error || !data?.length) { 
             toast({ title: "Esta corrida já foi aceita por outro motorista." }); 
             setAvailableRides(prev => prev.filter(r => r.id !== rideId));
             return; 
         }
         await fetchActiveRide(uid);
     } catch (e) { toast({ title: "Erro ao aceitar corrida." }); }
  };

  const rejectRide = async (rideId: string) => {
      if (rejectedIdsRef.current) {
          rejectedIdsRef.current.push(rideId);
      }
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
  };

  const confirmArrival = async (rideId: string) => { await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId); };
  const startRide = async (rideId: string) => { await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId); };
  const finishRide = async (rideId: string) => { await supabase.from('rides').update({ status: 'COMPLETED' }).eq('id', rideId); };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
      await supabase.from('rides').update(updateData).eq('id', rideId);
      if (dismissedRidesRef.current && !dismissedRidesRef.current.includes(rideId)) {
          dismissedRidesRef.current.push(rideId);
      }
      setRide(null);
  };

  const addBalance = async (amount: number) => {
      const uid = currentUserIdRef.current;
      if(!uid) return;
      const { data } = await supabase.from('profiles').select('balance').eq('id', uid).single();
      await supabase.from('profiles').update({ balance: (data?.balance || 0) + amount }).eq('id', uid);
  };

  const clearRide = () => { 
      if (ride?.id && dismissedRidesRef.current && !dismissedRidesRef.current.includes(ride.id)) {
          dismissedRidesRef.current.push(ride.id); 
      }
      setRide(null); 
  };

  return (
    <RideContext.Provider value={{ 
        ride, availableRides, loading, requestRide, createManualRide, cancelRide, acceptRide, rejectRide, 
        startRide, finishRide, rateRide, confirmArrival, addBalance, clearRide, refreshAvailableRides, currentUserId, userRole 
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