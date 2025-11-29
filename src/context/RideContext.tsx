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
  driver_details?: DriverInfo; // Objeto completo com dados do motorista
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

  // Helper para buscar dados completos do motorista
  const fetchDriverFullInfo = async (driverId: string): Promise<DriverInfo> => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url, car_model, car_plate, car_color, total_rides')
        .eq('id', driverId)
        .single();
        
      // Busca média de avaliação (opcional, aqui simulado ou buscado de rides passadas)
      const { data: ratings } = await supabase.from('rides').select('customer_rating').eq('driver_id', driverId).not('customer_rating', 'is', null);
      const avg = ratings && ratings.length > 0 
        ? ratings.reduce((a, b) => a + (b.customer_rating || 0), 0) / ratings.length 
        : 5.0;

      return {
          name: data ? `${data.first_name} ${data.last_name || ''}` : 'Motorista GoldDrive',
          avatar_url: data?.avatar_url,
          car_model: data?.car_model || 'Carro Padrão',
          car_plate: data?.car_plate || '---',
          car_color: data?.car_color || 'Branco',
          total_rides: data?.total_rides || 0,
          rating: avg
      };
  };

  // Monitorar Autenticação
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (profile) setUserRole(profile.role);
      }
      setLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            setUserId(session.user.id);
             const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
             if (profile) setUserRole(profile.role);
        } else {
            setUserId(null);
            setUserRole(null);
            setRide(null);
        }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // --- POLLING SYSTEM (Refresh Automático para AMBOS) ---
  useEffect(() => {
    if (!userId) return;

    const performPolling = async () => {
        // LÓGICA DO MOTORISTA: Buscar novas corridas
        if (userRole === 'driver') {
            if (ride && ride.status !== 'COMPLETED') return; // Se ocupado, não busca

            const { data: available } = await supabase.from('rides').select('*').eq('status', 'SEARCHING');
            if (available) {
                const filtered = available.filter((r: any) => !r.rejected_by || !r.rejected_by.includes(userId));
                setAvailableRides(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(filtered)) return filtered as RideData[];
                    return prev;
                });
            }
        }
        
        // LÓGICA DO PASSAGEIRO: Atualizar status da corrida atual
        if (userRole === 'client' && ride && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED') {
            const { data: updatedRide } = await supabase.from('rides').select('*').eq('id', ride.id).single();
            
            if (updatedRide) {
                // Se o status mudou ou se ganhou um motorista
                if (updatedRide.status !== ride.status || (updatedRide.driver_id && !ride.driver_id)) {
                    let fullData = { ...updatedRide } as RideData;
                    if (updatedRide.driver_id) {
                        fullData.driver_details = await fetchDriverFullInfo(updatedRide.driver_id);
                    }
                    setRide(fullData);
                    
                    if (updatedRide.status === 'ACCEPTED' && ride.status === 'SEARCHING') {
                        showSuccess("Motorista encontrado!");
                    }
                }
            }
        }
    };

    // Executa a cada 3 segundos
    const interval = setInterval(performPolling, 3000);
    return () => clearInterval(interval);
  }, [userId, userRole, ride]);

  // Fetch Inicial
  useEffect(() => {
    if (!userId) return;

    const fetchCurrentRide = async () => {
        if (userRole === 'client') {
             const { data } = await supabase
                .from('rides')
                .select('*')
                .eq('customer_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
             
             if (data && !['CANCELLED', 'COMPLETED'].includes(data.status)) {
                 let rideData = { ...data } as RideData;
                 if (data.driver_id) rideData.driver_details = await fetchDriverFullInfo(data.driver_id);
                 setRide(rideData);
             } else if (data && data.status === 'COMPLETED' && !data.customer_rating) {
                 // Recupera para avaliação
                 let rideData = { ...data } as RideData;
                 if (data.driver_id) rideData.driver_details = await fetchDriverFullInfo(data.driver_id);
                 setRide(rideData);
             }
        } 
        else if (userRole === 'driver') {
             const { data } = await supabase
                .from('rides')
                .select('*')
                .eq('driver_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
             
             if (data && !['CANCELLED', 'COMPLETED'].includes(data.status)) {
                 setRide(data as RideData);
             } else if (data && data.status === 'COMPLETED' && !data.driver_rating) {
                 setRide(data as RideData);
             }
        }
    };

    fetchCurrentRide();
  }, [userId, userRole]);


  // ---- ACTIONS ----

  const addBalance = async (amount: number) => {
      if (!userId) return;
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      const currentBalance = Number(profile?.balance || 0);
      const { error } = await supabase.from('profiles').update({ balance: currentBalance + amount }).eq('id', userId);
      await supabase.from('transactions').insert({ user_id: userId, amount: amount, type: 'DEPOSIT', description: 'Recarga GoldDrive' });
      if (error) throw error;
      showSuccess(`R$ ${amount.toFixed(2)} adicionados!`);
  };

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string) => {
    if (!userId) return;
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if ((profile?.balance || 0) < price) {
        showError("Saldo insuficiente.");
        throw new Error("Saldo insuficiente");
    }

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

      const { error, data } = await supabase.from('rides').update({
          status: 'ACCEPTED',
          driver_id: userId
      }).eq('id', rideId).select().single();
      
      if (error) throw error;
      setRide(data as RideData);
      setAvailableRides([]);
      showSuccess("Corrida aceita!");
  };

  const confirmArrival = async (rideId: string) => {
      const { error, data } = await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId).select().single();
      if (error) throw error;
      setRide(data as RideData);
      showSuccess("Passageiro notificado!");
  };

  const rejectRide = async (rideId: string) => {
      if (!userId) return;
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
      const { data: currentRide } = await supabase.from('rides').select('rejected_by').eq('id', rideId).single();
      const currentRejected = currentRide?.rejected_by || [];
      if (!currentRejected.includes(userId)) {
          await supabase.from('rides').update({ rejected_by: [...currentRejected, userId] }).eq('id', rideId);
      }
  };

  const startRide = async (rideId: string) => {
      const { error, data } = await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId).select().single();
      if (error) throw error;
      setRide(data as RideData);
      showSuccess("Corrida iniciada!");
  };

  const finishRide = async (rideId: string) => {
      if (!ride) return;
      const price = Number(ride.price);
      const driverEarn = price * 0.8;
      const platformFee = price * 0.2;

      await supabase.from('rides').update({
          status: 'COMPLETED',
          driver_earnings: driverEarn,
          platform_fee: platformFee
      }).eq('id', rideId);

      // Atualiza total de corridas do motorista
      if (ride.driver_id) {
           const { data: driverData } = await supabase.from('profiles').select('total_rides').eq('id', ride.driver_id).single();
           const newTotal = (driverData?.total_rides || 0) + 1;
           await supabase.from('profiles').update({ total_rides: newTotal }).eq('id', ride.driver_id);
      }

      // Financeiro
      const { data: clientProfile } = await supabase.from('profiles').select('balance').eq('id', ride.customer_id).single();
      await supabase.from('profiles').update({ balance: (clientProfile?.balance || 0) - price }).eq('id', ride.customer_id);
      await supabase.from('transactions').insert({ user_id: ride.customer_id, amount: -price, type: 'RIDE_PAYMENT', description: `Pagamento GoldDrive` });

      if (ride.driver_id) {
          const { data: driverProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
          await supabase.from('profiles').update({ balance: (driverProfile?.balance || 0) + driverEarn }).eq('id', ride.driver_id);
          await supabase.from('transactions').insert({ user_id: ride.driver_id, amount: driverEarn, type: 'RIDE_EARNING', description: `Ganho GoldDrive` });
      }
      
      showSuccess("Corrida finalizada com sucesso!");
  };

  const cancelRide = async (rideId: string, reason: string = "Cancelado") => {
      if (!ride && !rideId) return;
      const targetId = rideId || ride?.id;
      if (!targetId) return;

      if (reason === 'TIMEOUT') {
           await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', targetId);
           setRide(null);
           return;
      }
      
      const isLateCancel = (ride?.status === 'ACCEPTED' || ride?.status === 'ARRIVED');
      if (isLateCancel && userRole === 'client') {
          // Multa simples
          const fee = 5.00;
          await supabase.rpc('deduct_balance', { user_id: userId, amount: fee }); // Simplificado, ideal usar a logica direta
          // (Mantendo a logica anterior direta por segurança)
           const { data: clientProfile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
           await supabase.from('profiles').update({ balance: (clientProfile?.balance || 0) - fee }).eq('id', userId);
           await supabase.from('transactions').insert({ user_id: userId, amount: -fee, type: 'FEE', description: 'Taxa Cancelamento' });
      }

      await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', targetId);
      setRide(null);
      showSuccess("Corrida cancelada.");
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean) => {
      try {
          const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating };
          const { error } = await supabase.from('rides').update(updateData).eq('id', rideId);
          if (error) throw error;
          showSuccess("Avaliação enviada!");
          setRide(null);
      } catch (e: any) {
          showError(e.message);
      }
  };

  return (
    <RideContext.Provider value={{ ride, availableRides, requestRide, acceptRide, confirmArrival, rejectRide, startRide, finishRide, cancelRide, rateRide, addBalance, userRole, loading }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) throw new Error('useRide must be used within a RideProvider');
  return context;
};