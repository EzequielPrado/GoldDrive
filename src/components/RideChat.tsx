import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { showError } from "@/utils/toast"; // Importação adicionada

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface RideChatProps {
  rideId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  role: 'client' | 'driver';
  onClose: () => void;
}

const QUICK_MESSAGES = {
  client: ["Estou no local", "Estou descendo", "Qual a cor do carro?", "Obrigado!"],
  driver: ["Estou chegando", "Cheguei no local", "Trânsito intenso", "Estou aguardando"]
};

const RideChat = ({ rideId, currentUserId, otherUserName, otherUserAvatar, role, onClose }: RideChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Realtime Subscription para mensagens instantâneas
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat:${rideId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `ride_id=eq.${rideId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          // Adiciona a nova mensagem apenas se não for do próprio usuário (que já foi adicionado otimisticamente)
          if (newMsg.sender_id !== currentUserId) {
            setMessages(prev => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, currentUserId]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
        const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });
        
        if (data) {
             setMessages(data);
        }
    } catch (err) {
        console.error("Erro ao buscar mensagens do chat", err);
    }
  };

  const handleSend = async (text: string = newMessage) => {
    if (!text.trim()) return;
    
    // Envio Otimista
    const tempId = Math.random().toString();
    const tempMsg = {
        id: tempId,
        sender_id: currentUserId,
        content: text,
        created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage("");

    const { data, error } = await supabase.from('messages').insert({
        ride_id: rideId,
        sender_id: currentUserId,
        content: text
    }).select().single();

    if (error) {
        // Se der erro, remove a mensagem otimista e avisa o usuário
        setMessages(prev => prev.filter(m => m.id !== tempId));
        showError("Não foi possível enviar a mensagem.");
    } else if (data) {
        // Atualiza a mensagem otimista com os dados reais do banco (ID correto, etc)
        setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[600px] border border-gray-200">
            {/* Header */}
            <div className="bg-slate-900 p-4 flex items-center justify-between text-white shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-10 w-10 border-2 border-white/20">
                            <AvatarImage src={otherUserAvatar} />
                            <AvatarFallback className="text-black font-bold">{otherUserName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm leading-tight">{otherUserName}</h4>
                        <span className="text-[10px] text-slate-300 flex items-center gap-1">Online agora</span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full h-8 w-8">
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto" ref={scrollRef}>
                <div className="space-y-3">
                    <div className="text-center py-4">
                        <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wide">Início do Chat</span>
                    </div>
                    
                    {messages.length === 0 && (
                        <div className="text-center text-gray-400 text-sm mt-10">
                            Envie uma mensagem para combinar o encontro.
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isMe = msg.sender_id === currentUserId;
                        return (
                            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div 
                                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group ${
                                        isMe 
                                        ? 'bg-slate-900 text-white rounded-br-sm' 
                                        : 'bg-white text-slate-900 border border-gray-200 rounded-bl-sm'
                                    }`}
                                >
                                    {msg.content}
                                    <span className={`text-[9px] block text-right mt-1 opacity-60 ${isMe ? 'text-gray-300' : 'text-gray-400'}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Replies */}
            <div className="bg-white border-t border-gray-100 p-3 overflow-x-auto whitespace-nowrap custom-scrollbar">
                <div className="flex gap-2">
                    {QUICK_MESSAGES[role].map((txt) => (
                        <button 
                            key={txt} 
                            className="bg-gray-100 hover:bg-yellow-100 text-gray-700 hover:text-black px-4 py-2 rounded-xl text-xs font-medium transition-all border border-transparent hover:border-yellow-200 whitespace-nowrap"
                            onClick={() => handleSend(txt)}
                        >
                            {txt}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-gray-100 flex gap-2 items-center">
                <Input 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Digite sua mensagem..." 
                    // CORREÇÃO AQUI: Forçando texto escuro e fundo claro
                    className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-slate-900 placeholder:text-gray-400 focus:ring-1 focus:ring-slate-900 transition-all text-base font-medium"
                />
                <Button 
                    onClick={() => handleSend()} 
                    size="icon" 
                    className="h-12 w-12 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl shrink-0 shadow-lg shadow-yellow-500/20"
                    disabled={!newMessage.trim()}
                >
                    <Send className="w-5 h-5" />
                </Button>
            </div>
        </div>
    </div>
  );
};

export default RideChat;