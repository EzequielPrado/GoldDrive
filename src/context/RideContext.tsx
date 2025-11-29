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
  created_at: string;
  driver_details?: DriverInfo;
  client_details?: ClientInfo;
  customer_rating?: number;
  driver_rating?: number;
  driver_earnings?: number;
  platform_fee?: number;
  rejected_by?: string[];
}

interface RideContextType {
  ride: RideData | null;
  availableRides: RideData[];
  requestRide: (pickup: string, destination: string, price: number, distance: string, category: string) => Promise<void>;
  acceptRide: (rideId: string) => Promise<void>;
  confirmArrival: (rideId: string) => Promise<void>;
  rejectRide: (rideId: string) => Promise<void>;
  startRide: (rideId: string) => Promise<void>;
  finishRide: (rideId: string) => Promise<void>;
  cancelRide: (rideId: string, reason?: string) => Promise<void>;
  rateRide: (rideId: string, rating: number, isDriver: boolean) => Promise<void>;
  clearRide: () => void;
  userRole: 'client' | 'driver' | 'admin' | null;
  loading: boolean;
  addBalance: (amount: number) => Promise<void>;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const RideProvider = ({ children }: { children: ReactNode }) => {
  const [ride, setRide] = useState<RideData | null>(null);
  const [availableRides, setAvailableRides] = useState<RideData[]>([]);
  const [userRole, setUserRole] = useState<'client' | 'driver' | 'admin' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Helpers para buscar dados
  const fetchDriverFullInfo = async (driverId: string): Promise<DriverInfo> => {
      const { data } = await supabase.from('profiles').select('*').eq('id', driverId).single();
      const { data: ratings } = await supabase.from('rides').select('customer_rating').eq('driver_id', driverId).not('customer_rating', 'is', null);
      const avg = ratings && ratings.length > 0 ? ratings.reduce((a, b) => a + (b.customer_rating || 0), 0) / ratings.length : 5.0;
      return {
          name: data ? `${data.first_name} ${data.last_name || ''}` : 'Motorista GoldDrive',
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
          rating: 5.0, // Simplificado
          phone: data?.phone,
          total_rides: data?.total_rides || 0
      };
  };

  // Auth Monitor
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (data) setUserRole(data.role);
      }
      setLoading(false);
    };
    checkUser();
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

  // Polling System
  useEffect(() => {
    if (!userId) return;

    const performPolling = async () => {
        // Driver: Busca novas corridas
        if (userRole === 'driver') {
            if (ride && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED') return;

            const { data: available } = await supabase.from('rides').select('*').eq('status', 'SEARCHING');
            if (available) {
                const filtered = available.filter((r: any) => !r.rejected_by || !r.rejected_by.includes(userId));
                setAvailableRides(prev => JSON.stringify(prev) !== JSON.stringify(filtered) ? filtered as RideData[] : prev);
            }
        }
        
        // Updates de Status (Ambos)
        if (ride) {
            // Se já está finalizada/cancelada e o usuário ainda não limpou (está vendo o modal), não faz polling pra mudar nada
            // A menos que queiramos pegar atualizações do outro lado
            const { data: updatedRide } = await supabase.from('rides').select('*').eq('id', ride.id).single();
            
            if (updatedRide) {
                if (updatedRide.status !== ride.status || (updatedRide.driver_id && !ride.driver_id)) {
                    let fullData = { ...updatedRide } as RideData;
                    
                    if (updatedRide.driver_id) fullData.driver_details = await fetchDriverFullInfo(updatedRide.driver_id);
                    if (updatedRide.customer_id) fullData.client_details = await fetchClientFullInfo(updatedRide.customer_id);
                    
                    setRide(fullData);
                    
                    if (updatedRide.status === 'ACCEPTED' && ride.status === 'SEARCHING') showSuccess("Motorista encontrado!");
                    if (updatedRide.status === 'CANCELLED' && ride.status !== 'CANCELLED') showError("A corrida foi cancelada.");
                }
            }
        }
    };

    const interval = setInterval(performPolling, 3000);
    return () => clearInterval(interval);
  }, [userId, userRole, ride]);

  // Initial Fetch
  useEffect(() => {
    if (!userId) return;
    const fetchCurrentRide = async () => {
        const query = supabase.from('rides').select('*');
        if (userRole === 'client') query.eq('customer_id', userId);
        else if (userRole === 'driver') query.eq('driver_id', userId);
        
        const { data } = await query.order('created_at', { ascending: false }).limit(1).single();
        
        if (data) {
            // Se foi cancelada ou completada há muito tempo, ignora. Mas se for recente (ex: sem avaliação), mantém.
            // Aqui simplificamos: se não está avaliada (completed) ou se é ativa, carrega.
            const isActive = ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(data.status);
            const isPendingRating = data.status === 'COMPLETED' && (userRole === 'client' ? !data.customer_rating : !data.driver_rating);
            
            if (isActive || isPendingRating) {
                let rideData = { ...data } as RideData;
                if (data.driver_id) rideData.driver_details = await fetchDriverFullInfo(data.driver_id);
                if (data.customer_id) rideData.client_details = await fetchClientFullInfo(data.customer_id);
                setRide(rideData);
            }
        }
    };
    fetchCurrentRide();
  }, [userId, userRole]);

  // --- ACTIONS ---

  const clearRide = () => setRide(null);

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string) => {
    if (!userId) return;
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if ((profile?.balance || 0) < price) { showError("Saldo insuficiente."); throw new Error("Saldo insuficiente"); }

    const { data, error } = await supabase.from('rides').insert({
        customer_id: userId,
        pickup_address: pickup,
        destination_address: destination,
        price: Number(price),
        distance,
        category,
        status: 'SEARCHING',
        rejected_by: []
    }).select().single();
    if (error) throw error;
    setRide(data as RideData);
  };

  const acceptRide = async (rideId: string) => {
      if (!userId) return;
      const { data: checkRide } = await supabase.from('rides').select('status').eq('id', rideId).single();
      if (checkRide.status !== 'SEARCHING') {
          showError("Corrida indisponível.");
          setAvailableRides(prev => prev.filter(r => r.id !== rideId));
          return;
      }

      const { error, data } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: userId }).eq('id', rideId).select().single();
      if (error) throw error;
      
      let fullData = { ...data } as RideData;
      fullData.client_details = await fetchClientFullInfo(data.customer_id);
      
      setRide(fullData);
      setAvailableRides([]);
      showSuccess("Corrida aceita!");
  };

  const confirmArrival = async (rideId: string) => {
      const { error, data } = await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId).select().single();
      if (error) throw error;
      setRide(prev => prev ? { ...prev, ...data } : null);
      showSuccess("Chegada confirmada!");
  };

  const startRide = async (rideId: string) => {
      const { error, data } = await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId).select().single();
      if (error) throw error;
      setRide(prev => prev ? { ...prev, ...data } : null);
      showSuccess("Corrida iniciada!");
  };

  const finishRide = async (rideId: string) => {
      if (!ride) return;
      const price = Number(ride.price);
      const driverEarn = price * 0.8;
      const platformFee = price * 0.2;

      await supabase.from('rides').update({ status: 'COMPLETED', driver_earnings: driverEarn, platform_fee: platformFee }).eq('id', rideId);
      
      // Update stats and balances
      if (ride.driver_id) {
           const { data: driverData } = await supabase.from('profiles').select('total_rides').eq('id', ride.driver_id).single();
           await supabase.from('profiles').update({ total_rides: (driverData?.total_rides || 0) + 1 }).eq('id', ride.driver_id);
           
           const { data: driverProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
           await supabase.from('profiles').update({ balance: (driverProfile?.balance || 0) + driverEarn }).eq('id', ride.driver_id);
           await supabase.from('transactions').insert({ user_id: ride.driver_id, amount: driverEarn, type: 'RIDE_EARNING', description: 'Ganho Corrida' });
      }

      const { data: clientProfile } = await supabase.from('profiles').select('balance').eq('id', ride.customer_id).single();
      await supabase.from('profiles').update({ balance: (clientProfile?.balance || 0) - price }).eq('id', ride.customer_id);
      await supabase.from('transactions').insert({ user_id: ride.customer_id, amount: -price, type: 'RIDE_PAYMENT', description: 'Pagamento Corrida' });
      
      setRide(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
      showSuccess("Corrida finalizada!");
  };

  const cancelRide = async (rideId: string, reason: string = "Cancelado") => {
      const targetId = rideId || ride?.id;
      if (!targetId) return;

      if (reason === 'TIMEOUT') {
           await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', targetId);
           setRide(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
           return;
      }
      
      const isLateCancel = (ride?.status === 'ACCEPTED' || ride?.status === 'ARRIVED');
      if (isLateCancel && userRole === 'client') {
          const fee = 5.00;
          const { data: p } = await supabase.from('profiles').select('balance').eq('id', userId).single();
          await supabase.from('profiles').update({ balance: (p?.balance || 0) - fee }).eq('id', userId);
          await supabase.from('transactions').insert({ user_id: userId, amount: -fee, type: 'FEE', description: 'Taxa Cancelamento' });
          
          if (ride?.driver_id) {
               const { data: d } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
               await supabase.from('profiles').update({ balance: (d?.balance || 0) + (fee/2) }).eq('id', ride.driver_id);
          }
      }

      await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', targetId);
      setRide(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
      showSuccess("Corrida cancelada.");
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean) => {
      const update = isDriver ? { customer_rating: rating } : { driver_rating: rating };
      await supabase.from('rides').update(update).eq('id', rideId);
      showSuccess("Avaliação enviada!");
      setRide(null);
  };
  
  const addBalance = async (amount: number) => {
      if (!userId) return;
      const { data: p } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      await supabase.from('profiles').update({ balance: (p?.balance || 0) + amount }).eq('id', userId);
      await supabase.from('transactions').insert({ user_id: userId, amount, type: 'DEPOSIT', description: 'Recarga' });
      showSuccess(`R$ ${amount} adicionados!`);
  };

  return (
    <RideContext.Provider value={{ ride, availableRides, requestRide, acceptRide, confirmArrival, rejectRide, startRide, finishRide, cancelRide, rateRide, clearRide, addBalance, userRole, loading }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) throw new Error('useRide must be used within a RideProvider');
  return context;
};