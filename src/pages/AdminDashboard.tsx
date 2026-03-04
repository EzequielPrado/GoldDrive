import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, DollarSign, Clock, 
  CheckCircle, TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, BellRing, Save, AlertTriangle, Smartphone, Globe,
  Menu, Banknote, FileText, Check, X, ExternalLink, Camera, User,
  List, Plus, Power, Pencil, Star, Calendar, ArrowUpRight, ArrowDownLeft,
  Activity, BarChart3, PieChart, Coins, Lock, Unlock, Calculator, Info, MapPin, Zap, XCircle,
  Ban, Percent, Navigation, PlusCircle, CheckCircle2, UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  
  // Dados Principais
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, driverEarnings: 0, ridesToday: 0, activeRides: 0, driversOnline: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]); 
  
  const [config, setConfig] = useState({ enableCash: true, enableWallet: true, isSubscriptionMode: false, enableCancellationFee: true });
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        const [ridesRes, profilesRes, settingsRes, pricingRes] = await Promise.all([
            supabase.from('rides').select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`).order('created_at', { ascending: false }),
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('app_settings').select('*'),
            supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true })
        ]);

        if (ridesRes.data) setRides(ridesRes.data);
        if (profilesRes.data) {
            setUsers(profilesRes.data);
            setPendingDrivers(profilesRes.data.filter((p: any) => p.role === 'driver' && p.driver_status === 'PENDING'));
        }
        if (settingsRes.data) {
            const getVal = (k: string) => settingsRes.data.find(s => s.key === k)?.value;
            setConfig({ 
                enableCash: getVal('enable_cash')??true, 
                enableWallet: getVal('enable_wallet')??true, 
                isSubscriptionMode: getVal('is_subscription_mode')??false, 
                enableCancellationFee: getVal('enable_cancellation_fee')??true 
            });
        }
        if (pricingRes.data) setPricingTiers(pricingRes.data);

        const comp = (ridesRes.data || []).filter((r: any) => r.status === 'COMPLETED');
        setStats({
            revenue: comp.reduce((a, r) => a + Number(r.price), 0),
            adminRevenue: comp.reduce((a, r) => a + Number(r.platform_fee), 0),
            driverEarnings: comp.reduce((a, r) => a + Number(r.driver_earnings), 0),
            ridesToday: (ridesRes.data || []).filter((r: any) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
            activeRides: (ridesRes.data || []).filter((r: any) => ['IN_PROGRESS', 'ARRIVED', 'ACCEPTED'].includes(r.status)).length,
            driversOnline: profilesRes.data?.filter((p: any) => p.role === 'driver' && p.is_online).length || 0
        });
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const approveDriver = async (id: string) => {
      const { error } = await supabase.from('profiles').update({ driver_status: 'APPROVED' }).eq('id', id);
      if (error) showError("Erro ao aprovar");
      else { showSuccess("Motorista aprovado!"); fetchData(); }
  };

  const handleSaveConfig = async () => {
      setLoading(true);
      try { 
          await supabase.from('app_settings').upsert([ 
              { key: 'enable_cash', value: config.enableCash }, 
              { key: 'enable_wallet', value: config.enableWallet }, 
              { key: 'is_subscription_mode', value: config.isSubscriptionMode }, 
              { key: 'enable_cancellation_fee', value: config.enableCancellationFee }
          ]);
          showSuccess("Configurações salvas!");
          fetchData();
      } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 transition-all hover:shadow-md">
          <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}>
                      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
                  </div>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
              <h3 className="text-2xl font-black mt-1">{value}</h3>
          </CardContent>
      </Card>
  );

  if (loading && !rides.length) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-10 h-10 text-yellow-500" /></div>;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r bg-white dark:bg-slate-900">
         <div className="p-8 flex flex-col items-center">
             <img src="/app-logo.jpg" className="h-12 mb-4 rounded-xl" alt="Gold" />
             <div className="font-black text-xl">Painel Administrativo</div>
         </div>
         <nav className="flex-1 px-4 space-y-1">
             {[
                 { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                 { id: 'requests', label: 'Pendentes', icon: UserPlus, badge: pendingDrivers.length },
                 { id: 'rides', label: 'Corridas', icon: MapIcon },
                 { id: 'users', label: 'Usuários', icon: Users },
                 { id: 'config', label: 'Configurações', icon: Settings }
             ].map(item => (
                 <button 
                    key={item.id} 
                    onClick={() => setActiveTab(item.id)} 
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                 >
                     <item.icon className="w-5 h-5" />
                     <span>{item.label}</span>
                     {item.badge ? <Badge className="ml-auto bg-red-500">{item.badge}</Badge> : null}
                 </button>
             ))}
         </nav>
         <div className="p-6">
             <Button variant="ghost" className="w-full text-red-500 font-bold" onClick={() => navigate('/')}><LogOut className="mr-2 w-4 h-4" /> Sair</Button>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
              
              {/* HEADER MOBILE */}
              <div className="lg:hidden flex justify-between items-center mb-6">
                  <img src="/app-logo.jpg" className="h-8 rounded-lg" alt="Gold" />
                  <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
              </div>

              {activeTab === 'overview' && (
                  <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <StatCard title="Faturamento Total" value={`R$ ${stats.revenue.toFixed(2)}`} icon={DollarSign} colorClass="bg-green-500" />
                          <StatCard title="Lucro App" value={`R$ ${stats.adminRevenue.toFixed(2)}`} icon={Wallet} colorClass="bg-blue-500" />
                          <StatCard title="Corridas Hoje" value={stats.ridesToday} icon={Activity} colorClass="bg-yellow-500" />
                          <StatCard title="Motoristas Online" value={stats.driversOnline} icon={Zap} colorClass="bg-purple-500" />
                      </div>

                      <Card className="rounded-3xl border-0 shadow-sm overflow-hidden">
                          <CardHeader className="flex flex-row items-center justify-between">
                              <CardTitle className="font-black">Últimas Corridas</CardTitle>
                              <Button variant="ghost" className="text-sm font-bold" onClick={() => setActiveTab('rides')}>Ver Todas</Button>
                          </CardHeader>
                          <CardContent className="p-0">
                              <Table>
                                  <TableHeader><TableRow><TableHead className="pl-6">Data</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Valor</TableHead><TableHead className="pr-6 text-right">Status</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                      {rides.slice(0, 5).map(r => (
                                          <TableRow key={r.id}>
                                              <TableCell className="pl-6 text-xs text-slate-500">{new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                              <TableCell className="font-bold text-sm">{r.customer?.first_name || 'Usuário'}</TableCell>
                                              <TableCell className="text-sm">{r.driver?.first_name || 'Buscando...'}</TableCell>
                                              <TableCell className="font-black">R$ {Number(r.price).toFixed(2)}</TableCell>
                                              <TableCell className="pr-6 text-right"><Badge variant="outline" className="font-bold uppercase text-[9px]">{r.status}</Badge></TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </CardContent>
                      </Card>
                  </div>
              )}

              {activeTab === 'requests' && (
                  <div className="space-y-6">
                      <h2 className="text-2xl font-black">Motoristas Aguardando Aprovação</h2>
                      {pendingDrivers.length === 0 ? (
                          <div className="bg-white p-12 rounded-3xl text-center"><CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" /><p className="text-slate-500 font-bold">Tudo em dia! Nenhum cadastro pendente.</p></div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {pendingDrivers.map(d => (
                                  <Card key={d.id} className="rounded-3xl border-0 shadow-sm p-6 flex flex-col justify-between">
                                      <div className="flex items-center gap-4 mb-6">
                                          <Avatar className="w-16 h-16"><AvatarImage src={d.avatar_url} /><AvatarFallback className="font-bold">{d.first_name?.[0]}</AvatarFallback></Avatar>
                                          <div><h3 className="font-black text-lg">{d.first_name} {d.last_name}</h3><p className="text-sm text-slate-500">{d.phone}</p><p className="text-xs font-bold text-yellow-600 mt-1">{d.car_model} • {d.car_plate}</p></div>
                                      </div>
                                      <div className="flex gap-3">
                                          <Button variant="outline" className="flex-1 rounded-xl text-red-500 font-bold" onClick={async () => { await supabase.from('profiles').update({ driver_status: 'REJECTED' }).eq('id', d.id); fetchData(); }}>Rejeitar</Button>
                                          <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl" onClick={() => approveDriver(d.id)}>Aprovar Agora</Button>
                                      </div>
                                  </Card>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {activeTab === 'rides' && (
                   <Card className="rounded-3xl border-0 shadow-sm overflow-hidden">
                      <CardHeader><CardTitle className="font-black">Histórico Geral de Corridas</CardTitle></CardHeader>
                      <CardContent className="p-0">
                          <Table>
                              <TableHeader><TableRow><TableHead className="pl-6">Data/Hora</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Origem/Destino</TableHead><TableHead>Valor</TableHead><TableHead className="pr-6 text-right">Status</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {rides.map(r => (
                                      <TableRow key={r.id}>
                                          <TableCell className="pl-6 text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                                          <TableCell className="font-bold text-sm">{r.customer?.first_name} {r.customer?.last_name}</TableCell>
                                          <TableCell className="text-sm">{r.driver?.first_name || '---'}</TableCell>
                                          <TableCell className="max-w-xs"><p className="text-[10px] text-gray-400 truncate">DE: {r.pickup_address}</p><p className="text-[10px] text-slate-900 font-bold truncate">PARA: {r.destination_address}</p></TableCell>
                                          <TableCell className="font-black">R$ {Number(r.price).toFixed(2)}</TableCell>
                                          <TableCell className="pr-6 text-right"><Badge variant={r.status === 'COMPLETED' ? 'default' : r.status === 'CANCELLED' ? 'destructive' : 'secondary'} className="font-bold uppercase text-[9px]">{r.status}</Badge></TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </CardContent>
                   </Card>
              )}

              {activeTab === 'users' && (
                  <Card className="rounded-3xl border-0 shadow-sm overflow-hidden">
                      <CardHeader><CardTitle className="font-black">Base de Usuários</CardTitle></CardHeader>
                      <CardContent className="p-0">
                          <Table>
                              <TableHeader><TableRow><TableHead className="pl-6">Nome</TableHead><TableHead>Email/Celular</TableHead><TableHead>Tipo</TableHead><TableHead>Saldo</TableHead><TableHead className="pr-6 text-right">Ações</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {users.map(u => (
                                      <TableRow key={u.id}>
                                          <TableCell className="pl-6"><div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.first_name?.[0]}</AvatarFallback></Avatar><span className="font-bold">{u.first_name} {u.last_name}</span></div></TableCell>
                                          <TableCell><p className="text-xs">{u.email}</p><p className="text-xs font-bold">{u.phone}</p></TableCell>
                                          <TableCell><Badge className={u.role === 'driver' ? 'bg-black' : 'bg-blue-600'}>{u.role}</Badge></TableCell>
                                          <TableCell className="font-black">R$ {Number(u.balance).toFixed(2)}</TableCell>
                                          <TableCell className="pr-6 text-right"><Button variant="ghost" size="icon" className="text-red-500" onClick={async () => { if(confirm("Bloquear este usuário?")) { await supabase.from('profiles').update({ is_blocked: true }).eq('id', u.id); fetchData(); } }}><Ban className="w-4 h-4" /></Button></TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </CardContent>
                  </Card>
              )}

              {activeTab === 'config' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Card className="rounded-3xl p-8 shadow-xl border-0">
                          <h3 className="text-xl font-black mb-6">Controle Financeiro</h3>
                          <div className="space-y-6">
                              <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-base font-bold">Pagamento em Dinheiro</Label><p className="text-xs text-muted-foreground">Permite pagar ao motorista no final.</p></div><Switch checked={config.enableCash} onCheckedChange={(v) => setConfig({...config, enableCash: v})} /></div>
                              <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-base font-bold">Carteira Digital (PIX)</Label><p className="text-xs text-muted-foreground">Ativa o sistema de saldo e recargas.</p></div><Switch checked={config.enableWallet} onCheckedChange={(v) => setConfig({...config, enableWallet: v})} /></div>
                              <Separator />
                              <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-base font-bold text-yellow-600">Taxa Zero (Mensalidade)</Label><p className="text-xs text-muted-foreground">Motoristas não pagam comissão por viagem.</p></div><Switch checked={config.isSubscriptionMode} onCheckedChange={(v) => setConfig({...config, isSubscriptionMode: v})} /></div>
                          </div>
                          <Button onClick={handleSaveConfig} className="w-full mt-8 bg-black text-white h-12 font-bold rounded-xl">SALVAR ALTERAÇÕES</Button>
                      </Card>

                      <Card className="rounded-3xl p-8 shadow-xl border-0 bg-slate-900 text-white">
                          <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-yellow-500"><Shield className="w-6 h-6" /> Segurança</h3>
                          <div className="space-y-4">
                              <p className="text-sm text-slate-400">Configurações de bloqueio automático e auditoria de sistema.</p>
                              <div className="bg-slate-800 p-4 rounded-2xl border border-white/5"><p className="text-xs font-bold uppercase text-slate-500 mb-1">Status do Servidor</p><p className="text-green-400 font-black flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Operacional</p></div>
                          </div>
                      </Card>
                  </div>
              )}
          </div>
      </main>
    </div>
  );
};

export default AdminDashboard;