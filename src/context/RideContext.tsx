import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface RideContextType {
  ride: any | null;
  availableRides: any[];
  loading: boolean;
  requestRide: (pickup: string, destination: string, price: number, distance: string, category: string, paymentMethod: string) => Promise<void>;
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

export const RideProvider = ({ children }: { children: React.ReactNode }) => {
  const [ride, setRide] = useState<any | null>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'client' | 'driver' | null>(null);
  
  const rejectedIdsRef = useRef<string[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    const forceStopLoading = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(forceStopLoading);
  }, []);

  const fetchActiveRide = async (userId: string) => {
    try {
      // 1. Identificar Role se não tiver
      let role = userRole;
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
        .in('status', ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'])
        .maybeSingle();

      if (data) {
          console.log("Corrida ativa encontrada/atualizada:", data.status);
          setRide(data);
      } else {
          setRide(null);
      }
      
    } catch (err) {
      console.error("Erro fetchActiveRide:", err);
    }
  };

  const fetchAvailableRides = async () => {
      if (userRole !== 'driver' || !currentUserId) return;

      try {
          const { data } = await supabase
            .from('rides')
            .select(`*, client_details:profiles!public_rides_customer_id_fkey(*)`)
            .eq('status', 'SEARCHING')
            .is('driver_id', null)
            .order('created_at', { ascending: false });

          if (data) {
              const validRides = data.filter(r => {
                  if (r.customer_id === currentUserId) return false;
                  if (rejectedIdsRef.current.includes(r.id)) return false;
                  if (r.rejected_by && Array.isArray(r.rejected_by) && r.rejected_by.includes(currentUserId)) {
                      return false;
                  }
                  return true;
              });
              setAvailableRides(validRides);
          }
      } catch (err) {
          console.error("Erro fetchAvailableRides:", err);
      }
  };

  // Auth Init
  useEffect(() => {
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setCurrentUserId(session.user.id);
            await fetchActiveRide(session.user.id);
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
        rejectedIdsRef.current = [];
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Polling para motoristas (Backup para Realtime)
  useEffect(() => {
      if (currentUserId && userRole === 'driver' && !ride) {
          fetchAvailableRides();
          const interval = setInterval(fetchAvailableRides, 4000);
          return () => clearInterval(interval);
      }
  }, [currentUserId, userRole, ride]);

  // REALTIME SETUP ROBUSTO
  useEffect(() => {
    if (!currentUserId) return;

    // Canal específico para quando sou Passageiro (Customer)
    const customerChannel = supabase
      .channel('customer_updates')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'rides',
          filter: `customer_id=eq.${currentUserId}` // Filtro direto no Supabase
        },
        async (payload) => {
            console.log("Realtime Customer Update:", payload);
            await fetchActiveRide(currentUserId);
        }
      )
      .subscribe();

    // Canal específico para quando sou Motorista (Driver)
    // 1. Quando sou atribuído a uma corrida (Update onde driver_id sou eu)
    const driverChannel = supabase
      .channel('driver_updates')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'rides',
          filter: `driver_id=eq.${currentUserId}` 
        },
        async (payload) => {
             console.log("Realtime Driver Update:", payload);
             await fetchActiveRide(currentUserId);
        }
      )
      .subscribe();
      
    // Canal Global para novas corridas (apenas se for motorista e estiver livre)
    let globalChannel: any = null;
    if (userRole === 'driver' && !ride) {
        globalChannel = supabase
          .channel('global_rides')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'rides', filter: 'status=eq.SEARCHING' },
            async () => {
                await fetchAvailableRides();
            }
          )
          .subscribe();
    }

    return () => {
      supabase.removeChannel(customerChannel);
      supabase.removeChannel(driverChannel);
      if (globalChannel) supabase.removeChannel(globalChannel);
    };
  }, [currentUserId, userRole, ride]);

  // --- ACTIONS ---

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string, paymentMethod: string) => {
    if (!currentUserId) return toast({ title: "Erro", description: "Faça login.", variant: "destructive" });
    try {
      const { data, error } = await supabase.from('rides').insert({
          customer_id: currentUserId,
          pickup_address: pickup,
          destination_address: destination,
          price: price,
          distance: distance,
          status: 'SEARCHING',
          category: category,
          payment_method: paymentMethod
        }).select().single();
      if (error) throw error;
      setRide(data);
      // Força fetch imediato para garantir estado sincronizado
      await fetchActiveRide(currentUserId);
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const cancelRide = async (rideId: string, reason?: string) => {
    try {
        const { error } = await supabase.rpc('cancel_ride_as_user', { ride_id_to_cancel: rideId });
        if (error) {
            console.warn("RPC cancel failed, trying direct update", error);
            await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', rideId);
        }
        setRide(null);
        toast({ title: "Cancelado", description: reason || "Corrida cancelada." });
    } catch (e: any) { toast({ title: "Erro", description: "Erro ao cancelar." }); }
  };

  const acceptRide = async (rideId: string) => {
     if (!currentUserId) return;
     try {
         const { data: check } = await supabase.from('rides').select('driver_id').eq('id', rideId).single();
         if (check?.driver_id) {
             toast({ title: "Aviso", description: "Esta corrida já foi aceita.", variant: "destructive" });
             if (!rejectedIdsRef.current.includes(rideId)) rejectedIdsRef.current.push(rideId);
             setAvailableRides(prev => prev.filter(r => r.id !== rideId));
             return;
         }

         const { error } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: currentUserId }).eq('id', rideId);
         if (error) throw error;
         
         toast({ title: "Aceita", description: "Corrida aceita!" });
         await fetchActiveRide(currentUserId);
     } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const rejectRide = async (rideId: string) => {
      if (!rejectedIdsRef.current.includes(rideId)) {
          rejectedIdsRef.current.push(rideId);
      }
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));

      try {
          const { error } = await supabase.rpc('reject_ride', { ride_id_param: rideId });
          if (error) console.error("Erro ao salvar rejeição no banco:", error);
      } catch (err) {
          console.error("Erro ao chamar reject_ride:", err);
      }
  };

  const confirmArrival = async (rideId: string) => {
      try {
          const { error } = await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId);
          if (error) throw error;
          await fetchActiveRide(currentUserId!);
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const startRide = async (rideId: string) => {
      try {
          const { error } = await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId);
          if (error) throw error;
          await fetchActiveRide(currentUserId!);
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const finishRide = async (rideId: string) => {
      try {
          const { error } = await supabase.from('rides').update({ status: 'COMPLETED' }).eq('id', rideId);
          if (error) throw error;
          setRide(prev => prev ? ({...prev, status: 'COMPLETED'}) : null);
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      try {
          const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
          const { error } = await supabase.from('rides').update(updateData).eq('id', rideId);
          if (error) throw error;
          setRide(null);
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const addBalance = async (amount: number) => {
      if(!currentUserId) return;
      try {
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
          const newBalance = (profile?.balance || 0) + amount;
          
          await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUserId);
          await supabase.from('transactions').insert({
              user_id: currentUserId,
              amount: amount,
              type: 'DEPOSIT',
              description: 'Depósito via PIX'
          });
          toast({ title: "Sucesso", description: `R$ ${amount} adicionados!` });
      } catch(e: any) {
          toast({ title: "Erro", description: e.message });
          throw e;
      }
  }

  const clearRide = () => setRide(null);

  return (
    <RideContext.Provider value={{ 
        ride, availableRides, loading, 
        requestRide, cancelRide, acceptRide, rejectRide, 
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