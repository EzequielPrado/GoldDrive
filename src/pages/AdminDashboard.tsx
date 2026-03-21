4,5 e KM Noturno.">
import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  CheckCircle, TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, BellRing, Save, AlertTriangle, Smartphone, Globe,
  Menu, Banknote, FileText, Check, X, ExternalLink, Camera, User,
  Moon as MoonIcon, List, Plus, Power, Pencil, Star, Calendar, ArrowUpRight, ArrowDownLeft,
  Activity, BarChart3, PieChart, Coins, Lock, Unlock, Calculator, Info, MapPin, Zap, XCircle,
  Ban, Percent, Navigation, PlusCircle, UserPlus, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  
  // Dados Principais
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, driversOnline: 0, pendingDrivers: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]); 
  
  // Configurações e Categorias (Taxas)
  const [carCategories, setCarCategories] = useState<any[]>([]);
  const [categoryRules, setCategoryRules] = useState<Record<string, any>>({});
  const [appSettings, setAppSettings] = useState({ enable_cash: true, enable_wallet: true });
  const [minCarYear, setMinCarYear] = useState("2010"); 
  const [savingYear, setSavingYear] = useState(false);

  // Estados de Gerenciamento
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        // 1. Busca perfis e separa por categorias
        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        
        if (profiles) {
            setPassengers(profiles.filter((p: any) => p.role === 'client'));
            const allDrivers = profiles.filter((p: any) => p.role === 'driver');
            setDrivers(allDrivers);
            setPendingDrivers(allDrivers.filter((p: any) => p.driver_status === 'PENDING'));
        }

        // 2. Busca corridas recentes
        const { data: ridesData } = await supabase.from('rides')
            .select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`)
            .order('created_at', { ascending: false });
        
        if (ridesData) setRides(ridesData);

        // 3. Estatísticas rápidas
        const completedRides = ridesData?.filter(r => r.status === 'COMPLETED') || [];
        setStats({
            revenue: completedRides.reduce((a, r) => a + Number(r.price), 0),
            adminRevenue: completedRides.reduce((a, r) => a + Number(r.platform_fee), 0),
            driversOnline: profiles?.filter(p => p.role === 'driver' && p.is_online).length || 0,
            pendingDrivers: profiles?.filter(p => p.role === 'driver' && p.driver_status === 'PENDING').length || 0
        });

        // 4. Buscar Categorias de Veículos (Taxas)
        const { data: cats } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });
        if (cats) setCarCategories(cats);

        // 5. Buscar Configurações App
        const { data: settings } = await supabase.from('app_settings').select('*');
        if (settings) {
            const cashObj = settings.find(s => s.key === 'enable_cash');
            const walletObj = settings.find(s => s.key === 'enable_wallet');
            setAppSettings({
                enable_cash: cashObj ? cashObj.value : true,
                enable_wallet: walletObj ? walletObj.value : true
            });
        }

        // 6. Buscar Admin Config (Ano mínimo e Regras de Categoria)
        const { data: adminConfigs } = await supabase.from('admin_config').select('*');
        if (adminConfigs) {
            const minYearObj = adminConfigs.find(c => c.key === 'min_car_year');
            if (minYearObj && minYearObj.value) setMinCarYear(minYearObj.value);

            const rulesObj = adminConfigs.find(c => c.key === 'category_rules');
            if (rulesObj && rulesObj.value) {
                try {
                    setCategoryRules(JSON.parse(rulesObj.value));
                } catch (e) {
                    setCategoryRules({});
                }
            }
        }

    } catch (e: any) { 
        showError(e.message); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: string) => {
      try {
          const { error } = await supabase.from('profiles').update({ driver_status: status }).eq('id', userId);
          if (error) throw error;
          showSuccess(status === 'APPROVED' ? "Motorista Aprovado!" : "Motorista Rejeitado.");
          setIsReviewModalOpen(false);
          fetchData();
      } catch (e: any) { showError(e.message); }
  };

  const handleToggleBlock = async (user: any) => {
      try {
          const { error } = await supabase.from('profiles').update({ is_blocked: !user.is_blocked }).eq('id', user.id);
          if (error) throw error;
          showSuccess(user.is_blocked ? "Usuário Desbloqueado" : "Usuário Bloqueado");
          fetchData();
      } catch (e: any) { showError(e.message); }
  };

  const handleCategoryChange = (id: string, field: string, val: any) => {
      setCarCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleRuleChange = (catName: string, field: string, val: string) => {
      setCategoryRules(prev => ({
          ...prev,
          [catName]: {
              ...(prev[catName] || {}),
              [field]: val
          }
      }));
  };

  const handleSaveCategory = async (cat: any) => {
      try {
          const { error } = await supabase.from('car_categories')
              .update({ 
                  base_fare: cat.base_fare, 
                  cost_per_km: cat.cost_per_km, 
                  min_fare: cat.min_fare,
                  active: cat.active 
              })
              .eq('id', cat.id);
          if (error) throw error;

          const { data } = await supabase.from('admin_config').select('key').eq('key', 'category_rules').maybeSingle();
          if (data) {
              await supabase.from('admin_config').update({ value: JSON.stringify(categoryRules) }).eq('key', 'category_rules');
          } else {
              await supabase.from('admin_config').insert({ key: 'category_rules', value: JSON.stringify(categoryRules) });
          }

          showSuccess("Categoria e regras salvas com sucesso!");
      } catch (e: any) {
          showError("Erro ao salvar categoria.");
      }
  };

  const handleToggleSetting = async (key: string, currentValue: boolean) => {
      try {
          const newValue = !currentValue;
          const { data } = await supabase.from('app_settings').select('key').eq('key', key).maybeSingle();
          
          if (data) {
              await supabase.from('app_settings').update({ value: newValue }).eq('key', key);
          } else {
              await supabase.from('app_settings').insert({ key, value: newValue });
          }
          
          setAppSettings(prev => ({ ...prev, [key]: newValue }));
          showSuccess("Configuração atualizada!");
      } catch (e: any) {
          showError("Erro ao atualizar configuração.");
      }
  };

  const handleSaveMinYear = async () => {
      setSavingYear(true);
      try {
          const { data } = await supabase.from('admin_config').select('key').eq('key', 'min_car_year').maybeSingle();
          if (data) {
              await supabase.from('admin_config').update({ value: minCarYear }).eq('key', 'min_car_year');
          } else {
              await supabase.from('admin_config').insert({ key: 'min_car_year', value: minCarYear, description: 'Ano mínimo permitido para cadastro de veículos' });
          }
          showSuccess("Ano mínimo atualizado!");
      } catch (e: any) {
          showError("Erro ao salvar ano.");
      } finally {
          setSavingYear(false);
      }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/');
  };

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
      <Card className="border-0 shadow-lg overflow-hidden relative bg-white">
          <CardContent className="p-6">
              <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}><Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} /></div>
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase mt-4">{title}</p>
              <h3 className="text-3xl font-black mt-1 text-slate-900">{value}</h3>
          </CardContent>
      </Card>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Fixo */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-200 bg-white">
         <div className="p-8 flex items-center gap-3 font-black text-2xl border-b border-slate-100">
             <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-black shadow-md">G</div>
             <span className="text-slate-900">Gold<span className="text-yellow-500">Admin</span></span>
         </div>
         <nav className="flex-1 px-4 py-8 space-y-2">
             <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <LayoutDashboard className="w-5 h-5" /> Painel Geral
             </button>
             <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <FileText className="w-5 h-5" /> Solicitações {stats.pendingDrivers > 0 && <Badge className="ml-auto bg-red-500 text-white">{stats.pendingDrivers}</Badge>}
             </button>
             <button onClick={() => setActiveTab('rides')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'rides' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <MapIcon className="w-5 h-5" /> Corridas
             </button>
             <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <Users className="w-5 h-5" /> Usuários
             </button>
             <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <Settings className="w-5 h-5" /> Taxas e Configurações
             </button>
         </nav>
         <div className="p-4 border-t border-slate-100">
             <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 font-bold h-12 rounded-xl" onClick={handleLogout}><LogOut className="mr-3 w-5 h-5" /> Sair</Button>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-10">
              
              {/* Header Mobile/Top */}
              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                  <div>
                      <h1 className="text-3xl font-black tracking-tight text-slate-900">
                          {activeTab === 'overview' ? 'Painel Geral' : activeTab === 'requests' ? 'Solicitações de Motoristas' : activeTab === 'rides' ? 'Monitor de Corridas' : activeTab === 'users' ? 'Gestão de Usuários' : 'Taxas e Configurações'}
                      </h1>
                      <p className="text-slate-500 font-medium mt-1 text-sm">Bem-vindo de volta, Administrador.</p>
                  </div>
                  <Button onClick={fetchData} variant="outline" className="h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Atualizar</Button>
              </div>

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <StatCard title="Faturamento Total" value={`R$ ${stats.revenue.toFixed(2)}`} icon={DollarSign} colorClass="bg-green-500" />
                          <StatCard title="Lucro Líquido" value={`R$ ${stats.adminRevenue.toFixed(2)}`} icon={Wallet} colorClass="bg-blue-500" />
                          <StatCard title="Motoristas Online" value={stats.driversOnline} icon={Car} colorClass="bg-yellow-500" />
                          <StatCard title="Novos Cadastros" value={stats.pendingDrivers} icon={UserPlus} colorClass="bg-purple-500" />
                      </div>

                      <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900">Corridas em Tempo Real</CardTitle></CardHeader>
                          <Table>
                              <TableHeader><TableRow className="bg-slate-50 border-0"><TableHead className="pl-8 text-slate-500">ID / Data</TableHead><TableHead className="text-slate-500">Passageiro</TableHead><TableHead className="text-slate-500">Motorista</TableHead><TableHead className="text-slate-500">Valor</TableHead><TableHead className="text-slate-500">Status</TableHead><TableHead className="text-right pr-8 text-slate-500">Ação</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {rides.slice(0, 5).map(ride => (
                                      <TableRow key={ride.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                          <TableCell className="pl-8 font-medium text-slate-900">#{ride.id.slice(0,5)}<p className="text-[10px] text-slate-400 font-bold">{new Date(ride.created_at).toLocaleString()}</p></TableCell>
                                          <TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={ride.customer?.avatar_url} /><AvatarFallback>{ride.customer?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-bold text-sm text-slate-900">{ride.customer?.first_name || ride.guest_name}</span></div></TableCell>
                                          <TableCell>{ride.driver ? <div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={ride.driver?.avatar_url} /><AvatarFallback>{ride.driver?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-bold text-sm text-slate-900">{ride.driver?.first_name}</span></div> : <span className="text-xs text-slate-400">Pendente...</span>}</TableCell>
                                          <TableCell className="font-black text-slate-900">R$ {Number(ride.price).toFixed(2)}</TableCell>
                                          <TableCell><Badge className={`text-black font-bold border-0 ${ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : ride.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{ride.status}</Badge></TableCell>
                                          <TableCell className="text-right pr-8"><Button variant="ghost" size="sm" onClick={() => { setActiveTab('rides'); }} className="text-slate-600">Ver Todas</Button></TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </Card>
                  </div>
              )}

              {/* REQUESTS */}
              {activeTab === 'requests' && (
                  <div className="animate-in slide-in-from-bottom-4 duration-500">
                      <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 bg-slate-900 text-white"><CardTitle className="text-2xl font-black">Pendentes de Aprovação</CardTitle><CardDescription className="text-slate-400">Novos motoristas aguardando verificação de documentos.</CardDescription></CardHeader>
                          <Table>
                              <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-8 text-slate-500">Motorista</TableHead><TableHead className="text-slate-500">Veículo</TableHead><TableHead className="text-slate-500">Data Cadastro</TableHead><TableHead className="text-right pr-8 text-slate-500">Ação</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {pendingDrivers.length === 0 ? <TableRow><TableCell colSpan={4} className="h-60 text-center text-slate-400 font-bold">Nenhuma solicitação pendente no momento.</TableCell></TableRow> : pendingDrivers.map(d => (
                                      <TableRow key={d.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                                          <TableCell className="pl-8"><div className="flex items-center gap-4"><Avatar className="h-12 w-12 border-2 border-white shadow-sm"><AvatarImage src={d.avatar_url} /><AvatarFallback>{d.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-black text-slate-900">{d.first_name} {d.last_name}</p><p className="text-xs text-slate-500">{d.email}</p></div></div></TableCell>
                                          <TableCell><p className="font-bold text-sm text-slate-900">{d.car_model} {d.car_year && <span className="font-normal text-slate-500">({d.car_year})</span>}</p><Badge variant="outline" className="font-mono text-[10px] mt-1 uppercase border-slate-200 text-slate-600 bg-white">{d.car_plate}</Badge></TableCell>
                                          <TableCell className="text-slate-500 text-sm font-medium">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-6">
                                              <Button onClick={() => { setSelectedUser(d); setIsReviewModalOpen(true); }} className="bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold h-11 px-6 shadow-md">Analisar</Button>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </Card>
                  </div>
              )}

              {/* RIDES */}
              {activeTab === 'rides' && (
                  <div className="animate-in fade-in duration-500">
                       <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                              <div><CardTitle className="text-2xl font-black text-slate-900">Monitoramento de Viagens</CardTitle><CardDescription className="text-slate-500">Acompanhe todas as atividades da plataforma.</CardDescription></div>
                          </CardHeader>
                          <Table>
                              <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-8 text-slate-500">Início / Destino</TableHead><TableHead className="text-slate-500">Pessoas Envolvidas</TableHead><TableHead className="text-slate-500">Pagamento</TableHead><TableHead className="text-slate-500">Valor</TableHead><TableHead className="text-slate-500">Status</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {rides.map(ride => (
                                      <TableRow key={ride.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                          <TableCell className="pl-8 max-w-[200px]"><div className="space-y-1"><p className="text-xs font-black text-slate-900 truncate">📍 {ride.pickup_address}</p><p className="text-xs font-medium text-slate-500 truncate">🏁 {ride.destination_address}</p></div></TableCell>
                                          <TableCell><div className="flex -space-x-3"><Avatar className="border-2 border-white"><AvatarImage src={ride.customer?.avatar_url} /><AvatarFallback>{ride.customer?.first_name?.[0]}</AvatarFallback></Avatar><Avatar className="border-2 border-white"><AvatarImage src={ride.driver?.avatar_url} /><AvatarFallback>{ride.driver?.first_name?.[0]}</AvatarFallback></Avatar></div></TableCell>
                                          <TableCell><Badge variant="outline" className="font-bold text-[10px] uppercase border-slate-200 text-slate-600 bg-white">{ride.payment_method}</Badge></TableCell>
                                          <TableCell className="font-black text-lg text-slate-900">R$ {Number(ride.price).toFixed(2)}</TableCell>
                                          <TableCell><Badge className={`font-bold border-0 ${ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : ride.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{ride.status}</Badge></TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                       </Card>
                  </div>
              )}

              {/* USERS */}
              {activeTab === 'users' && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                       <Tabs defaultValue="drivers">
                          <TabsList className="h-16 bg-white p-1 rounded-[20px] shadow-sm mb-6 border border-slate-100">
                              <TabsTrigger value="drivers" className="px-8 font-black rounded-2xl h-full data-[state=active]:bg-slate-900 data-[state=active]:text-white">Motoristas ({drivers.length})</TabsTrigger>
                              <TabsTrigger value="clients" className="px-8 font-black rounded-2xl h-full data-[state=active]:bg-slate-900 data-[state=active]:text-white">Passageiros ({passengers.length})</TabsTrigger>
                          </TabsList>
                          <TabsContent value="drivers">
                              <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                                  <Table>
                                      <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-8 text-slate-500">Motorista</TableHead><TableHead className="text-slate-500">Veículo</TableHead><TableHead className="text-slate-500">Status</TableHead><TableHead className="text-slate-500">Saldo</TableHead><TableHead className="text-right pr-8 text-slate-500">Ações</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {drivers.map(d => (
                                              <TableRow key={d.id} className={`border-slate-100 ${d.is_blocked ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                                                  <TableCell className="pl-8 py-5"><div className="flex items-center gap-4"><Avatar className="h-10 w-10"><AvatarImage src={d.avatar_url} /><AvatarFallback>{d.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-slate-900 flex items-center gap-2">{d.first_name} {d.last_name} {d.is_blocked && <Ban className="w-3 h-3 text-red-500" />}</p><p className="text-xs text-slate-500">{d.email}</p></div></div></TableCell>
                                                  <TableCell><p className="text-xs font-bold text-slate-900">{d.car_model || '---'} {d.car_year && `(${d.car_year})`}</p><p className="text-[10px] text-slate-500 uppercase font-mono">{d.car_plate || '---'}</p></TableCell>
                                                  <TableCell><Badge className={`border-0 font-bold ${d.driver_status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.driver_status}</Badge></TableCell>
                                                  <TableCell className="font-bold text-slate-900">R$ {Number(d.balance).toFixed(2)}</TableCell>
                                                  <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-6">
                                                       <Button variant="outline" size="sm" onClick={() => handleToggleBlock(d)} className={`rounded-xl font-bold ${d.is_blocked ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-red-600 border-red-200 hover:bg-red-50'}`}>{d.is_blocked ? 'Desbloquear' : 'Bloquear'}</Button>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </Card>
                          </TabsContent>
                          <TabsContent value="clients">
                              <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                                  <Table>
                                      <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-8 text-slate-500">Passageiro</TableHead><TableHead className="text-slate-500">Data Cadastro</TableHead><TableHead className="text-slate-500">Saldo Carteira</TableHead><TableHead className="text-right pr-8 text-slate-500">Ações</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {passengers.map(p => (
                                              <TableRow key={p.id} className={`border-slate-100 ${p.is_blocked ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                                                  <TableCell className="pl-8 py-5"><div className="flex items-center gap-4"><Avatar className="h-10 w-10"><AvatarImage src={p.avatar_url} /><AvatarFallback>{p.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-slate-900 flex items-center gap-2">{p.first_name} {p.last_name} {p.is_blocked && <Ban className="w-3 h-3 text-red-500" />}</p><p className="text-xs text-slate-500">{p.email}</p></div></div></TableCell>
                                                  <TableCell className="text-slate-500 text-sm font-medium">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                                  <TableCell className="font-black text-blue-600">R$ {Number(p.balance).toFixed(2)}</TableCell>
                                                  <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-6">
                                                       <Button variant="outline" size="sm" onClick={() => handleToggleBlock(p)} className={`rounded-xl font-bold ${p.is_blocked ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-red-600 border-red-200 hover:bg-red-50'}`}>{p.is_blocked ? 'Desbloquear' : 'Bloquear'}</Button>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </Card>
                          </TabsContent>
                       </Tabs>
                  </div>
              )}

              {/* CONFIG / TAXAS */}
              {activeTab === 'config' && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                      
                      {/* Tabela de Preços e Taxas */}
                      <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 border-b border-slate-100 bg-slate-900 text-white">
                              <CardTitle className="text-2xl font-black">Taxas e Valores por Categoria</CardTitle>
                              <CardDescription className="text-slate-400">Ajuste os valores cobrados, tarifas noturnas e de longas distâncias para cada veículo.</CardDescription>
                          </CardHeader>
                          <CardContent className="p-8 space-y-6">
                              {carCategories.map(cat => (
                                  <div key={cat.id} className={`bg-slate-50 p-6 rounded-2xl border transition-all ${cat.active ? 'border-slate-200' : 'border-red-100 opacity-60 grayscale-[0.5]'}`}>
                                      <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
                                          <div className="flex-1 w-full space-y-1 text-left">
                                              <div className="flex items-center justify-between mb-2">
                                                  <Label className="font-black text-slate-900 text-lg flex items-center gap-2"><Car className={`w-5 h-5 ${cat.active ? 'text-yellow-500' : 'text-slate-300'}`} /> {cat.name}</Label>
                                                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
                                                      <span className={`text-[10px] font-black uppercase tracking-wider ${cat.active ? 'text-green-600' : 'text-red-500'}`}>{cat.active ? 'Ativa' : 'Desativada'}</span>
                                                      <Switch checked={cat.active} onCheckedChange={(val) => handleCategoryChange(cat.id, 'active', val)} />
                                                  </div>
                                              </div>
                                              <p className="text-xs font-medium text-slate-500">{cat.description || 'Categoria Premium'}</p>
                                          </div>
                                      </div>
                                      
                                      <div className="mt-6 space-y-4">
                                          {/* Preços Base */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                                              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Tarifas Padrão</h5>
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Base (R$)</Label>
                                                      <Input type="number" step="0.01" value={cat.base_fare} onChange={e => handleCategoryChange(cat.id, 'base_fare', e.target.value)} className="font-black text-slate-900 text-lg h-12 bg-white border-slate-200" />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KM Normal (R$)</Label>
                                                      <Input type="number" step="0.01" value={cat.cost_per_km} onChange={e => handleCategoryChange(cat.id, 'cost_per_km', e.target.value)} className="font-black text-slate-900 text-lg h-12 bg-white border-slate-200" />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mínimo (R$)</Label>
                                                      <Input type="number" step="0.01" value={cat.min_fare} onChange={e => handleCategoryChange(cat.id, 'min_fare', e.target.value)} className="font-black text-slate-900 text-lg h-12 bg-white border-slate-200" />
                                                  </div>
                                              </div>
                                          </div>

                                          {/* Tarifas Dinâmicas */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                                              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Moon className="w-3 h-3" /> Tarifas Dinâmicas (Opcional)</h5>
                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KM {'>'} 4,5km (R$)</Label>
                                                      <Input type="number" step="0.01" value={categoryRules[cat.name]?.km_over_45 || ''} onChange={e => handleRuleChange(cat.name, 'km_over_45', e.target.value)} placeholder="Ex: 2.50" className="font-bold text-slate-900 h-12" />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KM Noturno (R$)</Label>
                                                      <Input type="number" step="0.01" value={categoryRules[cat.name]?.night_km || ''} onChange={e => handleRuleChange(cat.name, 'night_km', e.target.value)} placeholder="Ex: 3.00" className="font-bold text-slate-900 h-12" />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Início Noturno</Label>
                                                      <Input type="time" value={categoryRules[cat.name]?.night_start || ''} onChange={e => handleRuleChange(cat.name, 'night_start', e.target.value)} className="font-bold text-slate-900 h-12" />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fim Noturno</Label>
                                                      <Input type="time" value={categoryRules[cat.name]?.night_end || ''} onChange={e => handleRuleChange(cat.name, 'night_end', e.target.value)} className="font-bold text-slate-900 h-12" />
                                                  </div>
                                              </div>
                                          </div>

                                          {/* Restrições */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                                              <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Restrições de Veículo</h5>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ano Mín</Label>
                                                      <Input type="number" value={categoryRules[cat.name]?.min || ''} onChange={e => handleRuleChange(cat.name, 'min', e.target.value)} placeholder="Ex: 2010" className="font-bold text-slate-900 h-12" />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ano Máx</Label>
                                                      <Input type="number" value={categoryRules[cat.name]?.max || ''} onChange={e => handleRuleChange(cat.name, 'max', e.target.value)} placeholder="Ex: 2016" className="font-bold text-slate-900 h-12" />
                                                  </div>
                                              </div>
                                          </div>

                                          <Button onClick={() => handleSaveCategory(cat)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl h-12 font-black shadow-md mt-2">
                                              SALVAR CATEGORIA E REGRAS
                                          </Button>
                                      </div>
                                  </div>
                              ))}
                          </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Configurações Globais */}
                          <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                              <CardHeader className="p-8 border-b border-slate-100">
                                  <CardTitle className="text-xl font-black text-slate-900">Configurações Gerais</CardTitle>
                                  <CardDescription className="text-slate-500">Habilite ou desabilite recursos globais do aplicativo.</CardDescription>
                              </CardHeader>
                              <CardContent className="p-8 space-y-4">
                                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200 transition-colors hover:bg-slate-100">
                                      <div className="flex gap-4 items-center">
                                          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200"><Banknote className="w-6 h-6 text-green-600" /></div>
                                          <div>
                                              <h4 className="font-black text-slate-900">Dinheiro</h4>
                                              <p className="text-sm font-medium text-slate-500">Permitir pagamentos em dinheiro.</p>
                                          </div>
                                      </div>
                                      <Switch checked={appSettings.enable_cash} onCheckedChange={() => handleToggleSetting('enable_cash', appSettings.enable_cash)} />
                                  </div>
                                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200 transition-colors hover:bg-slate-100">
                                      <div className="flex gap-4 items-center">
                                          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200"><Wallet className="w-6 h-6 text-blue-600" /></div>
                                          <div>
                                              <h4 className="font-black text-slate-900">Carteira (Wallet)</h4>
                                              <p className="text-sm font-medium text-slate-500">Permitir pagamentos com saldo.</p>
                                          </div>
                                      </div>
                                      <Switch checked={appSettings.enable_wallet} onCheckedChange={() => handleToggleSetting('enable_wallet', appSettings.enable_wallet)} />
                                  </div>
                              </CardContent>
                          </Card>

                          {/* Restrições de Veículo Genéricas */}
                          <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                              <CardHeader className="p-8 border-b border-slate-100 bg-yellow-50">
                                  <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2"><Shield className="w-5 h-5 text-yellow-600" /> Padrão Global de Veículos</CardTitle>
                                  <CardDescription className="text-slate-600">Alerta automático para novos motoristas durante aprovação.</CardDescription>
                              </CardHeader>
                              <CardContent className="p-8 space-y-6">
                                  <div className="space-y-3">
                                      <Label className="text-sm font-bold text-slate-900">Ano Mínimo Permitido na Plataforma</Label>
                                      <div className="flex gap-3">
                                          <Input 
                                              type="number" 
                                              value={minCarYear} 
                                              onChange={(e) => setMinCarYear(e.target.value)} 
                                              className="h-14 font-black text-slate-900 text-xl text-center border-slate-200 bg-slate-50"
                                          />
                                          <Button 
                                              onClick={handleSaveMinYear} 
                                              className="h-14 bg-black hover:bg-zinc-800 text-white font-bold rounded-xl px-8"
                                              disabled={savingYear}
                                          >
                                              {savingYear ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Regra"}
                                          </Button>
                                      </div>
                                      <p className="text-xs text-slate-500">Ao analisar um novo cadastro, você receberá um alerta se o veículo for mais antigo que {minCarYear}.</p>
                                  </div>
                              </CardContent>
                          </Card>
                      </div>

                  </div>
              )}

          </div>
      </main>

      {/* MODAL DE REVISÃO DE MOTORISTA */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-w-2xl bg-white rounded-[40px] border-0 shadow-2xl p-0 overflow-hidden outline-none">
              <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center justify-between">
                  <div>
                      <DialogTitle className="text-2xl font-black">Revisar Cadastro</DialogTitle>
                      <DialogDescription className="text-slate-400">Verifique os documentos e selfie antes de aprovar.</DialogDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsReviewModalOpen(false)} className="text-white hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></Button>
              </DialogHeader>
              
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Identificação e Selfie */}
                  <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                      <div className="relative">
                          <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                              <img 
                                src={selectedUser?.face_photo_url || selectedUser?.avatar_url} 
                                alt="Selfie" 
                                className="w-full h-full object-cover"
                              />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-yellow-500 p-2 rounded-xl shadow-lg border-2 border-white">
                              <Camera className="w-4 h-4 text-black" />
                          </div>
                      </div>
                      <div className="text-center md:text-left">
                          <h3 className="text-2xl font-black text-slate-900">{selectedUser?.first_name} {selectedUser?.last_name}</h3>
                          <p className="text-slate-500 font-bold mt-1">{selectedUser?.email}</p>
                          <div className="flex items-center gap-2 mt-3 justify-center md:justify-start">
                              <Badge className="bg-slate-900 text-white font-bold h-7 px-3">{selectedUser?.phone || 'Sem Telefone'}</Badge>
                              <Badge variant="outline" className="border-slate-200 font-bold h-7 px-3">Motorista Parceiro</Badge>
                          </div>
                      </div>
                  </div>
                  
                  {/* Veículo */}
                  <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[2px] ml-1">Dados do Veículo</h4>
                      <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Modelo</p>
                              <p className="font-bold text-slate-900 truncate">{selectedUser?.car_model || 'N/A'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Ano</p>
                              <p className="font-black text-slate-900 truncate">{selectedUser?.car_year || 'N/A'}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Placa</p>
                              <p className="font-black text-slate-900 uppercase truncate">{selectedUser?.car_plate || 'N/A'}</p>
                          </div>
                      </div>
                      {/* Alerta de Ano do Veículo */}
                      {selectedUser?.car_year && parseInt(selectedUser.car_year) < parseInt(minCarYear) && (
                          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3">
                              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                              <p className="text-xs text-red-700 font-bold">Veículo mais antigo que o permitido ({minCarYear})!</p>
                          </div>
                      )}
                  </div>

                  {/* Documentos (CNH) */}
                  <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[2px] ml-1">Documentos do Motorista</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Frente */}
                          <div className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase ml-1">CNH (Frente)</p>
                              <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video">
                                  {selectedUser?.cnh_front_url ? (
                                      <>
                                          <img src={selectedUser.cnh_front_url} className="w-full h-full object-cover" alt="CNH Frente" />
                                          <button 
                                            onClick={() => window.open(selectedUser.cnh_front_url, '_blank')}
                                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2"
                                          >
                                              <Eye className="w-5 h-5" /> Ver Original
                                          </button>
                                      </>
                                  ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                          <FileText className="w-10 h-10 mb-2" />
                                          <p className="text-xs font-bold">Não enviado</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                          {/* Verso */}
                          <div className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase ml-1">CNH (Verso)</p>
                              <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video">
                                  {selectedUser?.cnh_back_url ? (
                                      <>
                                          <img src={selectedUser.cnh_back_url} className="w-full h-full object-cover" alt="CNH Verso" />
                                          <button 
                                            onClick={() => window.open(selectedUser.cnh_back_url, '_blank')}
                                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2"
                                          >
                                              <Eye className="w-5 h-5" /> Ver Original
                                          </button>
                                      </>
                                  ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                          <FileText className="w-10 h-10 mb-2" />
                                          <p className="text-xs font-bold">Não enviado</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              
              <DialogFooter className="p-8 bg-slate-50 flex gap-4 border-t border-slate-100">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-14 rounded-2xl text-red-600 border-red-200 hover:bg-red-50 font-bold" 
                    onClick={() => handleUpdateUserStatus(selectedUser.id, 'REJECTED')}
                  >
                      REJEITAR
                  </Button>
                  <Button 
                    className="flex-1 h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-lg shadow-md" 
                    onClick={() => handleUpdateUserStatus(selectedUser.id, 'APPROVED')}
                  >
                      APROVAR AGORA
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;