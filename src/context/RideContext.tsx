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
  
  // Refs para acesso instantâneo dentro de closures (listeners e intervalos)
  const userRoleRef = useRef(userRole);
  const currentUserIdRef = useRef(currentUserId);
  const rejectedIdsRef = useRef<string[]>([]);
  
  const { toast } = useToast();

  // Mantém refs sincronizados com o estado
  useEffect(() => {
      userRoleRef.current = userRole;
      currentUserIdRef.current = currentUserId;
  }, [userRole, currentUserId]);

  useEffect(() => {
    const forceStopLoading = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(forceStopLoading);
  }, []);

  const fetchActiveRide = async (userId: string) => {
    try {
      let role = userRoleRef.current;
      
      // Se role ainda não estiver definido, busca no banco
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
          const isFinished = ['CANCELLED', 'COMPLETED'].includes(data.status);
          
          if (isFinished) {
              const hasRated = role === 'driver' ? !!data.customer_rating : !!data.driver_rating;
              
              if (hasRated) {
                  setRide(null); 
                  return;
              }

              // Se finalizou há menos de 1 hora e não avaliou, mostra. Senão limpa.
              const updatedAt = new Date(data.created_at).getTime();
              const now = new Date().getTime();
              const diffMinutes = (now - updatedAt) / 1000 / 60;
              
              if (diffMinutes < 60) {
                  setRide(data);
              } else {
                  setRide(null);
              }
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

  const fetchAvailableRides = async () => {
      const role = userRoleRef.current;
      const uid = currentUserIdRef.current;

      if (role !== 'driver' || !uid) return;

      try {
          // Busca corridas com status SEARCHING e sem motorista
          const { data } = await supabase
            .from('rides')
            .select(`*, client_details:profiles!public_rides_customer_id_fkey(*)`)
            .eq('status', 'SEARCHING')
            .is('driver_id', null)
            .order('created_at', { ascending: false });

          if (data) {
              const validRides = data.filter(r => {
                  // Não mostrar corrida do próprio motorista (se ele testar o app)
                  if (r.customer_id === uid) return false;
                  // Não mostrar corridas rejeitadas localmente
                  if (rejectedIdsRef.current.includes(r.id)) return false;
                  // Não mostrar corridas onde ele está na lista de rejeitados do servidor
                  if (r.rejected_by && Array.isArray(r.rejected_by) && r.rejected_by.includes(uid)) {
                      return false;
                  }
                  return true;
              });
              
              // Atualiza estado apenas se mudou para evitar re-renders
              setAvailableRides(prev => {
                  if (JSON.stringify(prev) === JSON.stringify(validRides)) return prev;
                  return validRides;
              });
          }
      } catch (err) {
          console.error("Erro fetchAvailableRides:", err);
      }
  };

  // Inicialização de Sessão
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

  // Polling de Corrida Ativa (para mudanças de status)
  useEffect(() => {
      let interval: NodeJS.Timeout;
      
      const shouldPoll = currentUserId && (
          (userRole === 'client' && ride) || // Cliente acompanhando
          (userRole === 'client' && !ride) || // Cliente esperando aceitar
          (userRole === 'driver' && ride)     // Motorista na corrida
      );

      if (shouldPoll) {
          interval = setInterval(() => {
              if (currentUserIdRef.current) fetchActiveRide(currentUserIdRef.current);
          }, 3000);
      }

      return () => {
          if (interval) clearInterval(interval);
      };
  }, [currentUserId, userRole, ride?.status, ride?.id]);

  // Polling de Corridas Disponíveis (Backup do Realtime)
  useEffect(() => {
      let interval: NodeJS.Timeout;
      // Se sou motorista e não tenho corrida, faço polling rápido
      if (currentUserId && userRole === 'driver' && !ride) {
          fetchAvailableRides();
          interval = setInterval(fetchAvailableRides, 2000); // 2 segundos para redundância
      }
      return () => { if (interval) clearInterval(interval); };
  }, [currentUserId, userRole, ride]);

  // Realtime Subscription (Otimizado)
  useEffect(() => {
    const channel = supabase
      .channel('global_ride_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        async (payload) => {
            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;
            const uid = currentUserIdRef.current;
            const role = userRoleRef.current;
            
            // 1. Verifica se a mudança afeta minha corrida ativa
            const isRelatedToMe = 
                (newRecord?.customer_id === uid) ||
                (newRecord?.driver_id === uid) ||
                (oldRecord?.customer_id === uid) ||
                (oldRecord?.driver_id === uid);

            if (isRelatedToMe && uid) {
                await fetchActiveRide(uid);
            }

            // 2. Se sou motorista livre, atualizo lista de disponíveis imediatamente
            if (role === 'driver' && !ride) {
                 // Qualquer INSERT (nova corrida) ou UPDATE (alguém pegou/cancelou) dispara o refresh
                 await fetchAvailableRides();
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Dependências vazias, pois usamos Refs para acessar estado atual

  const requestRide = async (pickup: string, destination: string, price: number, distance: string, category: string, paymentMethod: string) => {
    if (!currentUserId) {
        toast({ title: "Erro", description: "Faça login.", variant: "destructive" });
        return;
    }
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
      await fetchActiveRide(currentUserId);
    } catch (e: any) { 
        toast({ title: "Erro", description: e.message, variant: "destructive" }); 
    }
  };

  const cancelRide = async (rideId: string, reason?: string) => {
    try {
        const { error } = await supabase.rpc('cancel_ride_as_user', { ride_id_to_cancel: rideId });
        if (error) {
            console.warn("RPC cancel failed, trying direct update", error);
            await supabase.from('rides').update({ status: 'CANCELLED' }).eq('id', rideId);
        }
        await fetchActiveRide(currentUserId!); 
        toast({ title: "Cancelado", description: reason || "Corrida cancelada." });
    } catch (e: any) { toast({ title: "Erro", description: "Erro ao cancelar." }); }
  };

  const acceptRide = async (rideId: string) => {
     if (!currentUserId) return;
     try {
         // Verificação dupla antes de aceitar
         const { data: check } = await supabase.from('rides').select('driver_id').eq('id', rideId).single();
         if (check?.driver_id) {
             toast({ title: "Aviso", description: "Esta corrida já foi aceita por outro motorista.", variant: "destructive" });
             if (!rejectedIdsRef.current.includes(rideId)) rejectedIdsRef.current.push(rideId);
             setAvailableRides(prev => prev.filter(r => r.id !== rideId));
             return;
         }

         const { error } = await supabase.from('rides').update({ status: 'ACCEPTED', driver_id: currentUserId }).eq('id', rideId);
         if (error) throw error;
         
         toast({ title: "Aceita", description: "Corrida aceita com sucesso!" });
         await fetchActiveRide(currentUserId);
     } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const rejectRide = async (rideId: string) => {
      // Adiciona localmente para feedback instantâneo
      if (!rejectedIdsRef.current.includes(rideId)) rejectedIdsRef.current.push(rideId);
      setAvailableRides(prev => prev.filter(r => r.id !== rideId));
      
      try { await supabase.rpc('reject_ride', { ride_id_param: rideId }); } catch (err) { console.error(err); }
  };

  const confirmArrival = async (rideId: string) => {
      try {
          const { error } = await supabase.from('rides').update({ status: 'ARRIVED' }).eq('id', rideId);
          if (error) throw error;
          await fetchActiveRide(currentUserId!);
          toast({ title: "Status Atualizado", description: "Passageiro notificado da chegada." });
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const startRide = async (rideId: string) => {
      try {
          const { error } = await supabase.from('rides').update({ status: 'IN_PROGRESS' }).eq('id', rideId);
          if (error) throw error;
          await fetchActiveRide(currentUserId!);
          toast({ title: "Iniciada", description: "Boa viagem!" });
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const finishRide = async (rideId: string) => {
      try {
          const { error } = await supabase.from('rides').update({ status: 'COMPLETED' }).eq('id', rideId);
          if (error) throw error;
          await fetchActiveRide(currentUserId!); 
          toast({ title: "Finalizada", description: "Corrida concluída com sucesso." });
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const rateRide = async (rideId: string, rating: number, isDriver: boolean, comment?: string) => {
      try {
          const updateData = isDriver ? { customer_rating: rating } : { driver_rating: rating, review_comment: comment };
          const { error } = await supabase.from('rides').update(updateData).eq('id', rideId);
          if (error) throw error;
          await fetchActiveRide(currentUserId!);
          toast({ title: "Obrigado", description: "Avaliação enviada." });
      } catch (e: any) { toast({ title: "Erro", description: e.message }); }
  };

  const addBalance = async (amount: number) => {
      if(!currentUserId) return;
      try {
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', currentUserId).single();
          const newBalance = (profile?.balance || 0) + amount;
          await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUserId);
          await supabase.from('transactions').insert({ user_id: currentUserId, amount: amount, type: 'DEPOSIT', description: 'Depósito via PIX' });
          toast({ title: "Sucesso", description: `R$ ${amount} adicionados!` });
      } catch(e: any) { toast({ title: "Erro", description: e.message }); throw e; }
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