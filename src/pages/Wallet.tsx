import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CreditCard, QrCode, Wallet as WalletIcon, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRide } from "@/context/RideContext";
import { showSuccess, showError } from "@/utils/toast";

const Wallet = () => {
  const navigate = useNavigate();
  const { addBalance } = useRide();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

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
      if (!amount || Number(amount) <= 0) {
        showError("Digite um valor válido");
        return;
      }
      setShowQR(true);
  };

  const handlePay = async () => {
      if (processing) return;
      setProcessing(true);
      
      try {
          // Simula delay de banco (2 segundos)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          await addBalance(Number(amount));
          
          setAmount("");
          setShowQR(false);
          await fetchData(); // Atualiza saldo na tela
          
      } catch (error: any) {
          showError("Erro ao processar pagamento: " + error.message);
      } finally {
          setProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold">Minha Carteira</h1>
      </div>

      <div className="grid gap-6 max-w-md mx-auto">
          {/* Card Saldo */}
          <Card className="bg-black text-white border-0 shadow-xl">
              <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <p className="text-gray-400 text-sm font-medium">Saldo Disponível</p>
                          <h2 className="text-4xl font-bold mt-1">R$ {balance.toFixed(2)}</h2>
                      </div>
                      <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                          <WalletIcon className="w-5 h-5 text-white" />
                      </div>
                  </div>
                  <div className="text-xs text-gray-500">
                      Use seu saldo para pagar corridas automaticamente.
                  </div>
              </CardContent>
          </Card>

          {/* Adicionar Saldo */}
          <Card>
              <CardHeader>
                  <CardTitle className="text-lg">Adicionar Créditos</CardTitle>
                  <CardDescription>Pagamento instantâneo via PIX</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  {!showQR ? (
                      <>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-500">R$</span>
                            <Input 
                                type="number" 
                                placeholder="0,00" 
                                className="pl-9 text-lg" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[20, 50, 100].map(val => (
                                <Button key={val} variant="outline" onClick={() => setAmount(val.toString())}>
                                    R$ {val}
                                </Button>
                            ))}
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleGeneratePIX} disabled={!amount}>
                            <QrCode className="mr-2 w-4 h-4" /> Gerar PIX
                        </Button>
                      </>
                  ) : (
                      <div className="text-center animate-in zoom-in">
                          <div className="bg-white border-4 border-black p-4 inline-block rounded-xl mb-4">
                              {/* QR Code Fake (imagem placeholder com estilo de pixel) */}
                              <div className="w-48 h-48 bg-gray-900 flex items-center justify-center text-white text-xs">
                                  [QR CODE PIX R$ {amount}]
                              </div>
                          </div>
                          <p className="text-sm text-gray-500 mb-4">Escaneie para pagar ou simule abaixo</p>
                          
                          <div className="flex gap-2">
                              <Button variant="outline" className="flex-1" onClick={() => setShowQR(false)}>
                                  Cancelar
                              </Button>
                              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handlePay} disabled={processing}>
                                  {processing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 w-4 h-4" />}
                                  {processing ? "Processando..." : "Simular Pagamento"}
                              </Button>
                          </div>
                      </div>
                  )}
              </CardContent>
          </Card>

          {/* Histórico */}
          <div>
              <h3 className="font-bold text-gray-900 mb-3">Histórico de Transações</h3>
              <div className="space-y-3">
                  {transactions.map((t) => (
                      <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.amount > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                  {t.amount > 0 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <CreditCard className="w-5 h-5 text-red-600" />}
                              </div>
                              <div>
                                  <p className="font-medium text-sm text-gray-900">{t.description}</p>
                                  <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</p>
                              </div>
                          </div>
                          <span className={`font-bold ${t.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                              {t.amount > 0 ? '+' : ''} R$ {Math.abs(t.amount).toFixed(2)}
                          </span>
                      </div>
                  ))}
                  {transactions.length === 0 && <p className="text-gray-500 text-center text-sm py-4">Nenhuma transação ainda.</p>}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Wallet;