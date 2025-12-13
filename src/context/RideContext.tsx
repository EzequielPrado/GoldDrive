import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

export type RideStatus = 'SEARCHING' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface DriverInfo {
    name: string;
    avatar_url?: string;
    car_model?: string;
    car_plate?: string;
    car_color?: string;
    total_rides?: number;
    rating?: number;
    phone?: string;
}

export interface ClientInfo {
    name: string;
    avatar_url?: string;
    rating?: number;
    phone?: string;
    total_rides?: number;
}

export interface RideData {
  id: string;
  customer_id: string;
  driver_id?: string;
  pickup_address: string;
  destination_address: string;
  price: number;
  distance: string;
  category: string;
  status: RideStatus;
  payment_method: 'WALLET' | 'CASH';
  created_at: string;
  driver_details?: DriverInfo;
  client_details?: ClientInfo;
  customer_rating?: number;
  driver_rating?: number;
  driver_earnings?: number;
  platform_fee?: number;
  rejected_by?: string[];
  review_comment?: string;
}

interface RideContextType {
  ride: RideData | null;
  availableRides: RideData[];
  requestRide: (pickup: string, destination: string, price: number, distance: string, category: string, paymentMethod: 'WALLET' | 'CASH') => Promise<void>;
  acceptRide: (rideId: string) => Promise<void>;
  confirmArrival: (rideId: string) => Promise<void>;
  rejectRide: (rideId: string) => Promise<void>;
  startRide: (rideId: string) => Promise<void>;
  finishRide: (rideId: string) => Promise<void>;
  cancelRide: (rideId: string, reason?: string) => Promise<void>;
  rateRide: (rideId: string, rating: number, isDriver: boolean, comment?: string) => Promise<void>;
  clearRide: () => void;
  userRole: 'client' | 'driver' | 'admin' | null;
  loading: boolean;
  addBalance: (amount: number) => Promise<void>;
  currentUserId: string | null;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const RideProvider = ({ children }: { children: ReactNode }) => {
  const [ride, setRide] = useState<RideData | null>(null);
  const [availableRides, setAvailableRides] = useState<RideData[]>([]);
  const [userRole, setUserRole] = useState<'client' | 'driver' | 'admin' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Helpers de Dados ---
  const fetchDriverFullInfo = async (driverId: string): Promise<DriverInfo> => {
      const { data } = await supabase.from('profiles').select('*').eq('id', driverId).single();
      const { data: ratings } = await supabase.from('rides').select('customer_rating').eq('driver_id', driverId).not('customer_rating', 'is', null);
      const avg = ratings && ratings.length > 0 ? ratings.reduce((a, b) => a + (b.customer_rating || 0), 0) / ratings.length : 5.0;
      return {
          name: data ? `${data.first_name} ${data.last_name || ''}` : 'Motorista Gold Mobile',
          avatar_url: data?.avatar_url,
          car_model: data?.car_model,
          car_plate: data?.car_plate,
          car_color: data?.car_color,
          total_rides: data?.total_rides || 0,
          rating: avg,
          phone: data?.phone
      };
  };

  const fetchClientFullInfo = async (clientId: string): Promise<ClientInfo> => {
      const { data } = await supabase.from('profiles').select('*').eq('id', clientId).single();
      return {
          name: data ? `${data.first_name} ${data.last_name || ''}` : 'Passageiro',
          avatar_url: data?.avatar_url,
          rating: 5.0,
          phone: data?.phone,
          total_rides: data?.total_rides || 0
      };
  };

  // --- Auth e Monitoramento ---
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserId(session.user.id);
          const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
          if (data) {
              setUserRole(data.role);
              fetchCurrentRide(session.user.id, data.role);
          }
        }
      } catch (e) {
        console.error("Erro sessão:", e);
      } finally {
        setLoading(false);
      }
    };
    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            setUserId(session.user.id);
            const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
            if (data) setUserRole(data.role);
        } else {
            setUserId(null); setUserRole(null); setRide(null);
        }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchCurrentRide = async (uid: string, role: string | null) => {
      if (!uid || !role) return;
      const queryField = role === 'client' ? 'customer_id' : 'driver_id';
      
      const { data } = await supabase.from('rides')
        .select('*')
        .eq(queryField, uid)
        .in('status', ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
          const isActive = ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(data.status);
          const isPendingRating = data.status === 'COMPLETED' && (role === 'client' ? data.customer_rating === null : data.driver_rating === null);
          
          if (isActive || isPendingRating) {
              let rideData = { ...data } as RideData;
              if (data.driver_id) rideData.driver_details = await fetchDriverFullInfo(data.driver_id);
              if (data.customer_id) rideData.client_details = await fetchClientFullInfo(data.customer_id);
              setRide(rideData);
          } else {
              setRide(null);
          }
      }
  };

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    if (!userId || !userRole) return;

    const rideChannel = supabase
      .channel('public:rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        async (payload) => {
          const rideId = payload.new.id || payload.old.id;

          // 1. Motorista: Novas corridas aparecem
          if (userRole === 'driver' && payload.eventType === 'INSERT' && payload.new.status === 'SEARCHING') {
            const newRide = payload.new as RideData;
            if (!newRide.rejected_by?.includes(userId)) {
              newRide.client_details = await fetchClientFullInfo(newRide.customer_id);
              setAvailableRides(prev => [newRide, ...prev.filter(r => r.id !== newRide.id)]);
            }
          }

          // 2. Motorista: Corrida aceita por outro, some da lista
          if (userRole === 'driver' && payload.eventType === 'UPDATE' && payload.new.status === 'ACCEPTED') {
            setAvailableRides(prev => prev.filter(r => r.id !== rideId));
          }

          // 3. Ambos: Atualização da corrida atual
          if (ride && ride.id === rideId) {
            const updatedRide = payload.new as RideData;
            let fullData = { ...updatedRide } as RideData;
            if (updatedRide.driver_id) fullData.driver_details = await fetchDriverFullInfo(updatedRide.driver_id);
            if (updatedRide.customer_id) fullData.client_details = await fetchClientFullInfo(updatedRide.customer_id);
            setRide(fullData);

            if (updatedRide.status === 'ACCEPTED' && ride.status === 'SEARCHING') showSuccess("Motorista encontrado!");
            if (updatedRide.status === 'CANCELLED' && ride.status !== 'CANCELLED') showError("A corrida foi cancelada.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rideChannel);
    };
  }, [userId, userRole, ride]);


  // --- ACTIONS ---

  const clearRide = () => setRide(null);

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string, paymentMethod: 'WALLET' | 'CASH') => {
    console.log("--- Request Ride Called ---");
    console.log("Args:", { pickup, destination, price, distance, category, paymentMethod });

    if (!userId) throw new Error("Usuário não identificado.");

    if (paymentMethod === 'WALLET') {
        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        if ((profile?.balance || 0) < price) { 
            throw new Error("Saldo insuficiente. Recarregue ou pague na hora."); 
        }
        const newBalance = (profile?.balance || 0) - price;
        await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('transactions').insert({
            user_id: userId,
            amount: -price,
            type: 'RIDE_PAYMENT_HOLD',
            description: `Pagamento Corrida (Destino: ${destination.split(',')[0]})`
        });
    }

    const { data, error } = await supabase.from('rides').insert({
        customer_id: userId,
        pickup_address: pickup,
        destination_address: destination,
        price: Number(price),
        distance,
        category,
        payment_method: paymentMethod,
        status: 'SEARCHING'
    }).select().single();

    if (error) {
        console.error("Supabase insert error in requestRide:", error); // Log Supabase error
        if (paymentMethod === 'WALLET') {
             const { data: p } = await supabase.from('profiles').select('balance').eq('id', userId).single();
             await supabase.from('profiles').update({ balance: (p?.balance || 0) + price }).eq('id', userId);
        }
        throw new Error("Erro ao solicitar: " + error.message);
    }
    // Não precisa setar o ride aqui, o realtime vai pegar
    console.log("--- Request Ride Successful ---");
  };

  const acceptRide = async (rideId: string) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('rides')
        .update({ status: 'ACCEPTED', driver_id: userId })
        .eq('id', rideId)
        .eq('status', 'SEARCHING')
        .select()
        .maybeSingle();

      if (error || !data) {
          showError("Esta corrida já foi aceita por outro motorista.");
          setAvailableRides(prev => prev.filter(r => r.id !== rideId));
          return;
      }
      
      setAvailableRides([]);
      showSuccess("Corrida aceita!");
      // Não precisa setar o ride aqui, o realtime vai pegar
  };

  const confirmArrival = async (rideId: string) => {
      await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId);
      showSuccess("Chegada confirmada!");
  };

  const rejectRide = async (rideId: string) => {
      if (!userId) return;
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
      const { data: currentRide } = await supabase.from('rides').select('rejected_by').eq('id', rideId).single();
      if (currentRide) {
          const currentRejected = currentRide.rejected_by || [];
          if (!currentRejected.includes(userId)) {
              await supabase.from('rides').update({ rejected_by: [...currentRejected, userId] }).eq('id', rideId);
          }
      }
  };

  const startRide = async (rideId: string) => {
      await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId);
      showSuccess("Corrida iniciada!");
  };

  const finishRide = async (rideId: string) => {
      if (!ride) return;
      
      const { data: settings } = await supabase.from('app_settings').select('*');
      const isSubscriptionMode = settings?.find(s => s.key === 'is_subscription_mode')?.value;
      const { data: config } = await supabase.from('admin_config').select('*');
      const platformFeePercent = Number(config?.find((c: any) => c.key === 'platform_fee')?.value || 10) / 100;

      const price = Number(ride.price);
      let platformFee = 0;
      let driverEarn = price;

      if (!isSubscriptionMode) {
          platformFee = price * platformFeePercent;
          driverEarn = price - platformFee;
      }

      await supabase.from('rides').update({ status: 'COMPLETED', driver_earnings: driverEarn, platform_fee: platformFee }).eq('id', rideId);
      
      if (ride.driver_id) {
           const { data: d } = await supabase.from('profiles').select('total_rides').eq('id', ride.driver_id).single();
           await supabase.from('profiles').update({ total_rides: (d?.total_rides || 0) + 1 }).eq('id', ride.driver_id);
      }

      if (ride.payment_method === 'WALLET') {
          if (ride.driver_id) {
               const { data: dProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
               await supabase.from('profiles').update({ balance: (dProfile?.balance || 0) + driverEarn }).eq('id', ride.driver_id);
               await supabase.from('transactions').insert({ user_id: ride.driver_id, amount: driverEarn, type: 'RIDE_EARNING', description: 'Ganho Corrida (Carteira)' });
          }
      } else {
          if (ride.driver_id && platformFee > 0) {
               const { data: dProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
               await supabase.from('profiles').update({ balance: (dProfile?.balance || 0) - platformFee }).eq('id', ride.driver_id);
               await supabase.from('transactions').insert({ user_id: ride.driver_id, amount: -platformFee, type: 'PLATFORM_FEE', description: 'Taxa Gold Mobile (Pago em dinheiro)' });
          }
      }
      showSuccess("Corrida finalizada!");
  };

  const cancelRide = async (rideId: string, reason?: string) => {
      if (!rideId) return;

      try {
          const { data, error } = await supabase.rpc('cancel_ride_as_user', {
              ride_id_to_cancel: rideId
          });

          if (error) {
              throw error;
          }
          
          showSuccess(data || "Corrida cancelada com sucesso.");
          setRide(null);

      } catch (e: any) {
          console.error("Error cancelling ride:", e);
          showError(e.details || e.message || "Não foi possível cancelar a corrida.");
      }
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      const update = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
      await supabase.from('rides').update(update).eq('id', rideId);
      setRide(null); 
      showSuccess("Avaliação enviada!");
  };
  
  const addBalance = async (amount: number) => {
      if (!userId) return;
      const { data: p } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      await supabase.from('profiles').update({ balance: (p?.balance || 0) + amount }).eq('id', userId);
      await supabase.from('transactions').insert({ user_id: userId, amount, type: 'DEPOSIT', description: 'Recarga via PIX' });
      showSuccess(`R$ ${amount.toFixed(2)} adicionados!`);
  };

  return (
    <RideContext.Provider value={{ ride, availableRides, requestRide, acceptRide, confirmArrival, rejectRide, startRide, finishRide, cancelRide, rateRide, clearRide, addBalance, userRole, loading, currentUserId: userId }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) throw new Error('useRide must be used within a RideProvider');
  return context;
};