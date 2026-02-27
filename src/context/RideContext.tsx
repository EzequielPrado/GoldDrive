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
  ) => Promise<boolean>; // Alterado para retornar boolean
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
      }

      const queryField = role === 'driver' ? 'driver_id' : 'customer_id';
      
      const { data } = await supabase
        .from('rides')
        .select(`*, driver_details:profiles!public_rides_driver_id_fkey(*), client_details:profiles!public_rides_customer_id_fkey(*)`)
        .eq(queryField, userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
          if (dismissedRidesRef.current.includes(data.id)) {
              setRide(null);
              return;
          }

          if (data.ride_type === 'MANUAL' && data.guest_name) {
              data.client_details = {
                  first_name: data.guest_name.split(' ')[0],
                  last_name: data.guest_name.split(' ').slice(1).join(' '),
                  phone: data.guest_phone,
                  avatar_url: null 
              };
          }

          const isFinished = ['CANCELLED', 'COMPLETED'].includes(data.status);
          if (isFinished) {
              const hasRated = role === 'driver' ? !!data.customer_rating : !!data.driver_rating;
              if (hasRated) {
                  setRide(null); 
                  return;
              }
              
              const updatedAt = new Date(data.created_at).getTime();
              const now = new Date().getTime();
              // Se foi finalizada/cancelada há mais de 30min, ignora
              if ((now - updatedAt) / 1000 / 60 > 30) {
                  dismissedRidesRef.current.push(data.id);
                  setRide(null);
                  return;
              }

              setRide(data);
          } else {
              setRide(data);
          }
      } else {
          setRide(null);
      }
    } catch (err) {
      console.error("Erro fetchActiveRide:", err);
    }
  };

  const fetchAvailableRides = async (shouldPlaySound = false) => {
      const role = userRoleRef.current;
      const uid = currentUserIdRef.current;
      if (role !== 'driver' || !uid) return;

      try {
          const { data: ridesData, error } = await supabase
            .from('rides')
            .select('*')
            .eq('status', 'SEARCHING')
            .is('driver_id', null)
            .order('created_at', { ascending: false });
            
          if (error) throw error;

          if (ridesData && ridesData.length > 0) {
              const clientIds = ridesData.map(r => r.customer_id);
              const uniqueClientIds = [...new Set(clientIds)];
              
              const { data: profilesData } = await supabase.from('profiles').select('*').in('id', uniqueClientIds);
                
              const enrichedRides = ridesData.map(r => ({
                  ...r,
                  client_details: profilesData?.find(p => p.id === r.customer_id) || { first_name: 'Passageiro', last_name: '' }
              }));

              const validRides = enrichedRides.filter(r => {
                  if (r.customer_id === uid) return false;
                  if (rejectedIdsRef.current.includes(r.id)) return false; 
                  return true;
              });
              
              setAvailableRides(prev => {
                  if (shouldPlaySound && validRides.length > prev.length) {
                      const newIds = validRides.map(v => v.id);
                      const oldIds = prev.map(p => p.id);
                      if (newIds.some(id => !oldIds.includes(id))) playNotification();
                  }
                  return validRides;
              });
          } else {
              setAvailableRides([]);
          }
      } catch (err) { console.error(err); }
  };

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('global_ride_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        async (payload) => {
            const newRecord = payload.new as any;
            const uid = currentUserIdRef.current;
            const role = userRoleRef.current;

            // Se sou motorista e houve nova corrida ou atualização para SEARCHING
            if (role === 'driver') {
                if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && 
                    newRecord.status === 'SEARCHING' && !newRecord.driver_id) {
                    await fetchAvailableRides(true);
                }
                // Se a corrida não está mais disponível
                if (payload.eventType === 'UPDATE' && (newRecord.status !== 'SEARCHING' || newRecord.driver_id)) {
                    setAvailableRides(prev => prev.filter(r => r.id !== newRecord.id));
                }
            }
            
            // Se sou participante da corrida (motorista ou passageiro), atualizo meu estado ativo
            const isRelatedToMe = (newRecord?.customer_id === uid) || (newRecord?.driver_id === uid);
            if (isRelatedToMe && uid) {
                await fetchActiveRide(uid);
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling de segurança
  useEffect(() => {
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setCurrentUserId(session.user.id);
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
            if (profile) setUserRole(profile.role);
            fetchActiveRide(session.user.id);
        }
    };
    init();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setRide(null);
        setAvailableRides([]);
        dismissedRidesRef.current = [];
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
      let interval: NodeJS.Timeout;
      if (currentUserId) {
          // Polling para garantir atualização mesmo se realtime falhar
          interval = setInterval(() => fetchActiveRide(currentUserId), 3000);
      }
      return () => { if (interval) clearInterval(interval); };
  }, [currentUserId]); 

  useEffect(() => {
      let interval: NodeJS.Timeout;
      if (currentUserId && userRole === 'driver') {
          fetchAvailableRides(); 
          interval = setInterval(() => fetchAvailableRides(false), 5000); 
      }
      return () => { if (interval) clearInterval(interval); };
  }, [currentUserId, userRole]); 

  const requestRide = async (pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string, paymentMethod: string): Promise<boolean> => {
    if (!currentUserId) return false;
    try {
      const { data, error } = await supabase.from('rides').insert({
          customer_id: currentUserId,
          pickup_address: pickup, destination_address: destination,
          pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng,
          destination_lat: destCoords.lat, destination_lng: destCoords.lng,
          price, distance, status: 'SEARCHING', category, payment_method: paymentMethod
        }).select().single();
      
      if (error) throw error;
      
      // Atualiza estado local imediatamente para feedback visual
      setRide(data);
      // Força busca completa para trazer detalhes
      fetchActiveRide(currentUserId);
      
      return true;
    } catch (e: any) { 
        toast({ title: "Erro na solicitação", description: e.message, variant: "destructive" }); 
        return false;
    }
  };

  const createManualRide = async (passengerName: string, passengerPhone: string, pickup: string, destination: string, pickupCoords: any, destCoords: any, price: number, distance: string, category: string) => {
      if (!currentUserId) return;
      try {
          const { data, error } = await supabase.from('rides').insert({
              customer_id: currentUserId, driver_id: currentUserId,
              pickup_address: pickup, destination_address: destination,
              pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng,
              destination_lat: destCoords.lat, destination_lng: destCoords.lng,
              price, distance, status: 'IN_PROGRESS', category, payment_method: 'CASH',
              ride_type: 'MANUAL', guest_name: passengerName, guest_phone: passengerPhone,
              driver_earnings: price
          }).select().single();
          if (error) throw error;
          setRide(data);
          fetchActiveRide(currentUserId);
          toast({ title: "Corrida Iniciada" });
      } catch (e: any) { toast({ title: "Erro ao criar", variant: "destructive" }); }
  };

  const cancelRide = async (rideId: string) => {
    try {
        await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', rideId);
        if(currentUserId) await fetchActiveRide(currentUserId); 
        toast({ title: "Cancelado" });
    } catch (e) { toast({ title: "Erro ao cancelar" }); }
  };

  const acceptRide = async (rideId: string) => {
     if (!currentUserId) return;
     try {
         const { data, error } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: currentUserId }).eq('id', rideId).is('driver_id', null).select();
         if (error) throw error;
         if (!data || data.length === 0) {
             toast({ title: "Indisponível", variant: "destructive" });
             setAvailableRides(prev => prev.filter(r => r.id !== rideId));
             return;
         }
         await fetchActiveRide(currentUserId);
     } catch (e) { toast({ title: "Erro ao aceitar" }); }
  };

  const rejectRide = async (rideId: string) => {
      rejectedIdsRef.current.push(rideId);
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
  };

  const confirmArrival = async (rideId: string) => {
      await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId);
      if(currentUserId) fetchActiveRide(currentUserId);
  };

  const startRide = async (rideId: string) => {
      await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId);
      if(currentUserId) fetchActiveRide(currentUserId);
  };

  const finishRide = async (rideId: string) => {
      await supabase.from('rides').update({ status: 'COMPLETED' }).eq('id', rideId);
      if(currentUserId) fetchActiveRide(currentUserId);
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
      await supabase.from('rides').update(updateData).eq('id', rideId);
      clearRide(); // Chama o clear que descarta o ID
      toast({ title: "Avaliação enviada" });
  };

  const addBalance = async (amount: number) => {
      if(!currentUserId) return;
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
      const newBalance = (profile?.balance || 0) + amount;
      await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUserId);
  }

  const clearRide = () => {
      if (ride?.id) {
          dismissedRidesRef.current.push(ride.id);
      }
      setRide(null);
  };

  return (
    <RideContext.Provider value={{ 
        ride, availableRides, loading, 
        requestRide, createManualRide, 
        cancelRide, acceptRide, rejectRide, 
        startRide, finishRide, rateRide, confirmArrival, 
        addBalance, clearRide, 
        currentUserId, userRole 
    }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) throw new Error('useRide must be used within a RideProvider');
  return context;
};