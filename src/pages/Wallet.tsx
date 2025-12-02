import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CreditCard, QrCode, Wallet as WalletIcon, CheckCircle2, Loader2, ArrowUpRight, ArrowDownLeft, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const Wallet = () => {
  const navigate = useNavigate();
  const { addBalance } = useRide();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletEnabled, setWalletEnabled] = useState(true);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('key', 'enable_wallet').single();
      if (data) {
          setWalletEnabled(data.value);
      }
  };

  const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
      setBalance(Number(profile?.balance || 0));

      const { data: trans } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTransactions(trans || []);
  };

  const handleGeneratePIX = () => {
      if (!amount || Number(amount) <= 0) { showError("Digite um valor válido"); return; }
      setShowQR(true);
  };

  const handlePay = async () => {
      if (processing) return;
      setProcessing(true);
      try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await addBalance(Number(amount));
          setAmount("");
          setShowQR(false);
          await fetchData();
      } catch (error: any) {
          showError(error.message);
      } finally {
          setProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-400/10 rounded-full blur-[100px] -z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[100px] -z-0" />

      <div className="p-6 relative z-10 max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="bg-white hover:bg-white/80 rounded-full shadow-sm">
                  <ArrowLeft className="w-5 h-5 text-slate-900" />
              </Button>
              <h1 className="text-2xl font-black text-slate-900">Carteira</h1>
          </div>

          {/* Card de Saldo Premium */}
          <div className="relative overflow-hidden bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl mb-8 group transition-transform hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-full blur-2xl group-hover:bg-yellow-500/30 transition-colors" />
              
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                      <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                        <WalletIcon className="w-6 h-6 text-yellow-400" />
                      </div>
                      <span className="text-xs font-bold bg-yellow-500 text-black px-3 py-1 rounded-full uppercase tracking-wider">Gold</span>
                  </div>
                  <div>
                      <p className="text-slate-400 font-medium mb-1">Saldo Total</p>
                      <h2 className="text-5xl font-black tracking-tight">R$ {balance.toFixed(2)}</h2>
                  </div>
              </div>
          </div>

          {/* Actions */}
          <div className="mb-8">
             {!walletEnabled && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-r-xl mb-6 flex items-start gap-3 animate-in slide-in-from-left">
                     <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                     <div>
                         <p className="font-bold">Carteira Digital Indisponível</p>
                         <p className="text-sm">No momento só estamos aceitando pagamento no momento da corrida.</p>
                     </div>
                </div>
             )}

             {walletEnabled && (
                 <div className="bg-white/80 backdrop-blur-xl border border-white/40 p-6 rounded-[32px] shadow-lg">
                      <h3 className="font-bold text-slate-900 mb-4">Adicionar Créditos</h3>
                      
                      {!showQR ? (
                          <div className="space-y-4">
                              <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                  <Input type="number" placeholder="0,00" className="pl-10 h-14 bg-gray-50 border-0 rounded-2xl text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} />
                              </div>
                              <div className="flex gap-2">
                                  {[20, 50, 100].map(val => (
                                      <button key={val} onClick={() => setAmount(val.toString())} className="flex-1 py-2 rounded-xl border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-all font-bold text-sm">
                                          +{val}
                                      </button>
                                  ))}
                              </div>
                              <Button className="w-full h-14 bg-black text-white rounded-2xl font-bold hover:bg-zinc-800" onClick={handleGeneratePIX} disabled={!amount}>
                                  <QrCode className="mr-2 w-5 h-5" /> Gerar PIX
                              </Button>
                          </div>
                      ) : (
                          <div className="text-center animate-in zoom-in-95">
                              <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-200 mb-4 inline-block">
                                 <div className="w-48 h-48 bg-slate-900 flex items-center justify-center text-white text-xs rounded-lg">[QR CODE PIX]</div>
                              </div>
                              <div className="flex gap-3">
                                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setShowQR(false)}>Voltar</Button>
                                  <Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold" onClick={handlePay} disabled={processing}>
                                      {processing ? <Loader2 className="animate-spin" /> : "Pagar Agora"}
                                  </Button>
                              </div>
                          </div>
                      )}
                 </div>
             )}
          </div>

          {/* Histórico */}
          <div>
              <h3 className="font-bold text-slate-900 mb-4 ml-2">Últimas Transações</h3>
              <div className="space-y-3">
                  {transactions.length === 0 ? (
                      <p className="text-center text-gray-400 py-6">Nenhuma movimentação.</p>
                  ) : (
                      transactions.map((t) => (
                          <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-100">
                              <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      {t.amount > 0 ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-900 text-sm">{t.description}</p>
                                      <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</p>
                                  </div>
                              </div>
                              <span className={`font-bold ${t.amount > 0 ? 'text-green-600' : 'text-slate-900'}`}>
                                  {t.amount > 0 ? '+' : ''} R$ {Math.abs(t.amount).toFixed(2)}
                              </span>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Wallet;