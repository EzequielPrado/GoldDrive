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
          if (data) setUserRole(data.role);
          fetchCurrentRide(session.user.id, data?.role);
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
      if (!uid) return;
      const query = supabase.from('rides').select('*');
      if (role === 'client') query.eq('customer_id', uid);
      else if (role === 'driver') query.eq('driver_id', uid);
      
      const { data } = await query.order('created_at', { ascending: false }).limit(1).single();
      
      if (data) {
          const isActive = ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(data.status);
          const isPendingRating = data.status === 'COMPLETED' && (role === 'client' ? !data.customer_rating : !data.driver_rating);
          
          if (isActive || isPendingRating) {
              let rideData = { ...data } as RideData;
              if (data.driver_id) rideData.driver_details = await fetchDriverFullInfo(data.driver_id);
              if (data.customer_id) rideData.client_details = await fetchClientFullInfo(data.customer_id);
              setRide(rideData);
          }
      }
  };

  // Polling de Atualização
  useEffect(() => {
    if (!userId) return;
    const performPolling = async () => {
        if (userRole === 'driver') {
            if (ride && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED') return;
            const { data: available } = await supabase.from('rides').select('*').eq('status', 'SEARCHING');
            if (available) {
                const filtered = available.filter((r: any) => !r.rejected_by || !r.rejected_by.includes(userId));
                setAvailableRides(prev => JSON.stringify(prev) !== JSON.stringify(filtered) ? filtered as RideData[] : prev);
            }
        }
        
        if (ride) {
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
    const interval = setInterval(performPolling, 2000);
    return () => clearInterval(interval);
  }, [userId, userRole, ride]);

  // --- ACTIONS ---

  const clearRide = () => setRide(null);

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string, paymentMethod: 'WALLET' | 'CASH') => {
    let currentUserId = userId;
    if (!currentUserId) {
        const { data } = await supabase.auth.getUser();
        currentUserId = data.user?.id || null;
    }
    if (!currentUserId) throw new Error("Usuário não identificado.");

    // Se for carteira, verifica e debita AGORA
    if (paymentMethod === 'WALLET') {
        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
        if ((profile?.balance || 0) < price) { 
            throw new Error("Saldo insuficiente. Recarregue ou pague na hora."); 
        }
        
        // Debita
        const newBalance = (profile?.balance || 0) - price;
        await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUserId);
        
        // Registra transação de "Bloqueio/Pagamento"
        await supabase.from('transactions').insert({
            user_id: currentUserId,
            amount: -price,
            type: 'RIDE_PAYMENT_HOLD',
            description: `Pagamento Corrida (Destino: ${destination.split(',')[0]})`
        });
    }

    const { data, error } = await supabase.from('rides').insert({
        customer_id: currentUserId,
        pickup_address: pickup,
        destination_address: destination,
        price: Number(price),
        distance,
        category,
        payment_method: paymentMethod,
        status: 'SEARCHING'
    }).select().single();

    if (error) {
        // Se der erro ao criar, devolve o dinheiro se foi carteira
        if (paymentMethod === 'WALLET') {
             const { data: p } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
             await supabase.from('profiles').update({ balance: (p?.balance || 0) + price }).eq('id', currentUserId);
        }
        throw new Error("Erro ao solicitar: " + error.message);
    }

    setRide(data as RideData);
  };

  const acceptRide = async (rideId: string) => {
      let currentUserId = userId;
      if (!currentUserId) {
         const { data } = await supabase.auth.getUser();
         currentUserId = data.user?.id || null;
      }
      if (!currentUserId) return;

      // Verifica se o motorista tem saldo para a taxa (caso seja pagamento em dinheiro)
      // Opcional: Bloquear motorista se saldo negativo. Por enquanto deixamos passar.

      const { data: checkRide } = await supabase.from('rides').select('status').eq('id', rideId).single();
      if (checkRide.status !== 'SEARCHING') {
          showError("Esta corrida já foi aceita.");
          setAvailableRides(prev => prev.filter(r => r.id !== rideId));
          return;
      }

      const { error, data } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: currentUserId }).eq('id', rideId).select().single();
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
      const { error, data } = await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId).select().single();
      if (error) throw error;
      setRide(prev => prev ? { ...prev, ...data } : null);
      showSuccess("Corrida iniciada!");
  };

  const finishRide = async (rideId: string) => {
      if (!ride) return;
      const price = Number(ride.price);
      const driverEarn = price * 0.8; // 80% pro motorista
      const platformFee = price * 0.2; // 20% taxa

      await supabase.from('rides').update({ status: 'COMPLETED', driver_earnings: driverEarn, platform_fee: platformFee }).eq('id', rideId);
      
      // Atualiza contagem de corridas
      if (ride.driver_id) {
           const { data: d } = await supabase.from('profiles').select('total_rides').eq('id', ride.driver_id).single();
           await supabase.from('profiles').update({ total_rides: (d?.total_rides || 0) + 1 }).eq('id', ride.driver_id);
      }

      if (ride.payment_method === 'WALLET') {
          // O dinheiro JÁ saiu do passageiro na solicitação.
          // Agora, creditamos o motorista (80%). A plataforma fica com o resto (que já está na conta da plataforma contabilmente).
          
          if (ride.driver_id) {
               const { data: dProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
               await supabase.from('profiles').update({ balance: (dProfile?.balance || 0) + driverEarn }).eq('id', ride.driver_id);
               
               await supabase.from('transactions').insert({ 
                   user_id: ride.driver_id, 
                   amount: driverEarn, 
                   type: 'RIDE_EARNING', 
                   description: 'Ganho Corrida (Carteira)' 
               });
          }
      } else {
          // PAGAMENTO NA HORA (CASH)
          // O passageiro paga TUDO (100%) pro motorista na mão.
          // O motorista "deve" 20% pra plataforma. 
          // Deduzimos a taxa do saldo do motorista.
          
          if (ride.driver_id) {
               const { data: dProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
               await supabase.from('profiles').update({ balance: (dProfile?.balance || 0) - platformFee }).eq('id', ride.driver_id);
               
               await supabase.from('transactions').insert({ 
                   user_id: ride.driver_id, 
                   amount: -platformFee, 
                   type: 'PLATFORM_FEE', 
                   description: 'Taxa GoldDrive (Pago em dinheiro)' 
               });
          }
      }
      
      setRide(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
      showSuccess("Corrida finalizada!");
  };

  const cancelRide = async (rideId: string, reason: string = "Cancelado") => {
      const targetId = rideId || ride?.id;
      if (!targetId) return;

      const { data: currentRide } = await supabase.from('rides').select('*').eq('id', targetId).single();
      if (!currentRide) return;

      // Marca como cancelado
      await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', targetId);
      setRide(prev => prev ? { ...prev, status: 'CANCELLED' } : null);

      const fee = 5.00;
      const compensation = 2.50;
      const isLateCancel = (currentRide.status === 'ACCEPTED' || currentRide.status === 'ARRIVED');

      // Lógica de Reembolso / Cobrança
      if (currentRide.payment_method === 'WALLET') {
          // Passageiro JÁ pagou na solicitação. Precisamos devolver.
          
          if (isLateCancel) {
              // Devolve tudo MENOS a taxa
              const refundAmount = Number(currentRide.price) - fee;
              const { data: p } = await supabase.from('profiles').select('balance').eq('id', currentRide.customer_id).single();
              await supabase.from('profiles').update({ balance: (p?.balance || 0) + refundAmount }).eq('id', currentRide.customer_id);
              
              await supabase.from('transactions').insert({ 
                  user_id: currentRide.customer_id, 
                  amount: refundAmount, 
                  type: 'REFUND_PARTIAL', 
                  description: `Estorno (Taxa aplicada) #${targetId.slice(0,4)}` 
              });
          } else {
              // Devolve TUDO (Cancelamento rápido ou sem motorista)
              const refundAmount = Number(currentRide.price);
              const { data: p } = await supabase.from('profiles').select('balance').eq('id', currentRide.customer_id).single();
              await supabase.from('profiles').update({ balance: (p?.balance || 0) + refundAmount }).eq('id', currentRide.customer_id);
              
              await supabase.from('transactions').insert({ 
                  user_id: currentRide.customer_id, 
                  amount: refundAmount, 
                  type: 'REFUND_FULL', 
                  description: `Estorno Total #${targetId.slice(0,4)}` 
              });
          }
      } else {
          // PAGAMENTO NA HORA (CASH)
          // Passageiro não pagou nada ainda.
          
          if (isLateCancel) {
              // Cobra taxa da carteira do passageiro (pode ficar negativo)
              const { data: p } = await supabase.from('profiles').select('balance').eq('id', currentRide.customer_id).single();
              await supabase.from('profiles').update({ balance: (p?.balance || 0) - fee }).eq('id', currentRide.customer_id);
              
              await supabase.from('transactions').insert({ 
                  user_id: currentRide.customer_id, 
                  amount: -fee, 
                  type: 'CANCELLATION_FEE', 
                  description: `Taxa Cancelamento #${targetId.slice(0,4)}` 
              });
          }
      }

      // Compensação do Motorista (Sempre recebe se foi cancelamento tardio)
      if (isLateCancel && currentRide.driver_id) {
           const { data: d } = await supabase.from('profiles').select('balance').eq('id', currentRide.driver_id).single();
           await supabase.from('profiles').update({ balance: (d?.balance || 0) + compensation }).eq('id', currentRide.driver_id);
           
           await supabase.from('transactions').insert({ 
               user_id: currentRide.driver_id, 
               amount: compensation, 
               type: 'COMPENSATION', 
               description: `Compensação Cancelamento #${targetId.slice(0,4)}` 
           });
      }
      
      showSuccess(isLateCancel ? "Cancelado com taxa aplicada." : "Cancelado sem custo.");
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      const update = isDriver 
        ? { customer_rating: rating } 
        : { driver_rating: rating, review_comment: comment };
      await supabase.from('rides').update(update).eq('id', rideId);
      showSuccess("Avaliação enviada!");
      setRide(null);
  };
  
  const addBalance = async (amount: number) => {
      let currentUserId = userId;
      if (!currentUserId) {
         const { data } = await supabase.auth.getUser();
         currentUserId = data.user?.id || null;
      }
      if (!currentUserId) return;

      const { data: p } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
      await supabase.from('profiles').update({ balance: (p?.balance || 0) + amount }).eq('id', currentUserId);
      await supabase.from('transactions').insert({ user_id: currentUserId, amount, type: 'DEPOSIT', description: 'Recarga via PIX' });
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