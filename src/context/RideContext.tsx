import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

export type RideStatus = 'SEARCHING' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

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
  driver_name?: string;
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
             const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
             if (profile) setUserRole(profile.role);
        } else {
            setUserId(null);
            setUserRole(null);
            setRide(null);
        }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchDriverInfo = async (driverId: string) => {
      const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', driverId).single();
      return data ? `${data.first_name} ${data.last_name || ''}` : 'Motorista';
  };

  // Realtime e Fetch Inicial
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
             
             if (data) {
                 if (data.status === 'COMPLETED' && data.customer_rating) { setRide(null); return; }
                 if (['CANCELLED'].includes(data.status)) { setRide(null); return; }

                 let rideData = { ...data } as RideData;
                 if (data.driver_id) rideData.driver_name = await fetchDriverInfo(data.driver_id);
                 setRide(rideData);
             }
        } 
        else if (userRole === 'driver') {
             // 1. Busca se o motorista JÁ ESTÁ em uma corrida
             const { data } = await supabase
                .from('rides')
                .select('*')
                .eq('driver_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
             
             if (data) {
                 if (data.status === 'COMPLETED' && data.driver_rating) { setRide(null); }
                 else if (data.status === 'CANCELLED') { setRide(null); }
                 else { setRide(data as RideData); }
             }
             
             // 2. Busca corridas disponíveis
             const { data: available } = await supabase
                .from('rides')
                .select('*')
                .eq('status', 'SEARCHING');
             
             if (available) {
                 const filtered = available.filter((r: any) => 
                     !r.rejected_by || !r.rejected_by.includes(userId)
                 );
                 setAvailableRides(filtered as RideData[]);
             }
        }
    };

    fetchCurrentRide();

    // Configuração do Realtime
    const channel = supabase
      .channel('public:rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async (payload) => {
        const newRide = payload.new as RideData;
        
        // --- LÓGICA DO CLIENTE ---
        if (userRole === 'client' && newRide.customer_id === userId) {
            if (newRide.status === 'CANCELLED') {
                setRide(null);
                showError("Corrida cancelada ou nenhum motorista encontrado.");
            } else if (newRide.status === 'COMPLETED') {
                 let updatedRide = { ...newRide };
                 if (newRide.driver_id) updatedRide.driver_name = await fetchDriverInfo(newRide.driver_id);
                 setRide(updatedRide);
            } else {
                let updatedRide = { ...newRide };
                if (newRide.driver_id) updatedRide.driver_name = await fetchDriverInfo(newRide.driver_id);
                setRide(updatedRide);
                
                if (newRide.status === 'ACCEPTED' && payload.eventType === 'UPDATE') {
                    showSuccess("Motorista aceitou! Chegada em aprox. 60 segundos.");
                }
            }
        }
        
        // --- LÓGICA DO MOTORISTA ---
        if (userRole === 'driver') {
            // Se a corrida foi rejeitada por este motorista, ignora
            if (newRide.rejected_by && newRide.rejected_by.includes(userId)) {
                setAvailableRides(prev => prev.filter(r => r.id !== newRide.id));
                return; 
            }

            // Nova corrida ou atualização de corrida disponível
            if (newRide.status === 'SEARCHING') {
                // Se eu (motorista) não estou nela (driver_id nulo ou diferente de mim, mas status searching implica sem driver)
                setAvailableRides(prev => {
                    const exists = prev.find(r => r.id === newRide.id);
                    if (exists) {
                         // Atualiza dados se já existe
                         return prev.map(r => r.id === newRide.id ? newRide : r);
                    }
                    return [...prev, newRide];
                });
            } else {
                // Se não está mais procurando (foi aceita por outro ou cancelada), remove da lista
                setAvailableRides(prev => prev.filter(r => r.id !== newRide.id));
            }

            // Atualização da MINHA corrida atual (se eu aceitei)
            if (newRide.driver_id === userId) {
                if (newRide.status === 'CANCELLED') {
                    setRide(null);
                    showError("Passageiro cancelou a corrida.");
                } else {
                    setRide(newRide);
                }
            }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, userRole]);


  // ---- ACTIONS ----

  const addBalance = async (amount: number) => {
      if (!userId) return;
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      const currentBalance = Number(profile?.balance || 0);
      
      const { error } = await supabase.from('profiles').update({ balance: currentBalance + amount }).eq('id', userId);
      
      await supabase.from('transactions').insert({
          user_id: userId,
          amount: amount,
          type: 'DEPOSIT',
          description: 'Recarga de Carteira'
      });

      if (error) throw error;
      showSuccess(`R$ ${amount.toFixed(2)} adicionados!`);
  };

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string) => {
    if (!userId) return;
    
    // Verificar saldo
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if ((profile?.balance || 0) < price) {
        showError("Saldo insuficiente.");
        throw new Error("Saldo insuficiente");
    }

    // Insert e retorna DADOS IMEDIATAMENTE (.select().single())
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
    
    // ATUALIZA ESTADO LOCAL IMEDIATAMENTE (Passageiro vê a tela mudar na hora)
    setRide(data as RideData);
  };

  const acceptRide = async (rideId: string) => {
      if (!userId) return;
      
      const { data: checkRide } = await supabase.from('rides').select('status').eq('id', rideId).single();
      if (checkRide.status !== 'SEARCHING') {
          showError("Esta corrida não está mais disponível.");
          setAvailableRides(prev => prev.filter(r => r.id !== rideId));
          return;
      }

      const { error } = await supabase.from('rides').update({
          status: 'ACCEPTED',
          driver_id: userId
      }).eq('id', rideId);
      
      if (error) throw error;
      
      setTimeout(async () => {
          await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId);
          showSuccess("Você chegou ao local de embarque!");
      }, 60000); 
  };

  const rejectRide = async (rideId: string) => {
      if (!userId) return;

      setAvailableRides(prev => prev.filter(r => r.id !== rideId));

      const { data: currentRide } = await supabase.from('rides').select('rejected_by').eq('id', rideId).single();
      const currentRejected = currentRide?.rejected_by || [];
      
      if (!currentRejected.includes(userId)) {
          const { error } = await supabase
            .from('rides')
            .update({ 
                rejected_by: [...currentRejected, userId] 
            })
            .eq('id', rideId);
      }
  };

  const startRide = async (rideId: string) => {
      const { error } = await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId);
      if (error) throw error;
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

      // Debitar Passageiro
      const { data: clientProfile } = await supabase.from('profiles').select('balance').eq('id', ride.customer_id).single();
      await supabase.from('profiles').update({ balance: (clientProfile?.balance || 0) - price }).eq('id', ride.customer_id);
      
      await supabase.from('transactions').insert({
          user_id: ride.customer_id,
          amount: -price,
          type: 'RIDE_PAYMENT',
          description: `Pagamento Corrida`
      });

      // Creditar Motorista
      if (ride.driver_id) {
          const { data: driverProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
          await supabase.from('profiles').update({ balance: (driverProfile?.balance || 0) + driverEarn }).eq('id', ride.driver_id);

          await supabase.from('transactions').insert({
              user_id: ride.driver_id,
              amount: driverEarn,
              type: 'RIDE_EARNING',
              description: `Ganho Corrida (80%)`
          });
      }
      
      showSuccess("Corrida finalizada! Pagamento processado.");
  };

  const cancelRide = async (rideId: string, reason: string = "Cancelado pelo usuário") => {
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
          const fee = 5.00;
          const driverPart = 2.50;
          
          const { data: clientProfile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
          await supabase.from('profiles').update({ balance: (clientProfile?.balance || 0) - fee }).eq('id', userId);
          
          await supabase.from('transactions').insert({
              user_id: userId,
              amount: -fee,
              type: 'FEE_CANCELLATION',
              description: `Taxa de cancelamento`
          });

          if (ride.driver_id) {
              const { data: driverProfile } = await supabase.from('profiles').select('balance').eq('id', ride.driver_id).single();
              await supabase.from('profiles').update({ balance: (driverProfile?.balance || 0) + driverPart }).eq('id', ride.driver_id);
              
              await supabase.from('transactions').insert({
                  user_id: ride.driver_id,
                  amount: driverPart,
                  type: 'FEE_CANCELLATION_EARNING',
                  description: `Compensação Cancelamento`
              });
          }
          showSuccess("Cancelado. Taxa de R$ 5,00 aplicada.");
      } else {
          showSuccess("Corrida cancelada.");
      }

      await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', targetId);
      setRide(null);
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
    <RideContext.Provider value={{ ride, availableRides, requestRide, acceptRide, rejectRide, startRide, finishRide, cancelRide, rateRide, addBalance, userRole, loading }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) throw new Error('useRide must be used within a RideProvider');
  return context;
};