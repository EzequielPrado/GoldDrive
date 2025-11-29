import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Filter, Menu, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  CheckCircle, XCircle, TrendingUp, ArrowUpRight, ArrowDownLeft, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import { useTheme } from "@/components/theme-provider";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Dados
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, rides: 0, users: 0, drivers: 0, activeRides: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Modais e Seleções
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setAdminProfile(data);
            
            // Verificação de segurança extra
            if (data?.role !== 'admin') {
                showError("Acesso restrito a administradores.");
                navigate('/');
                return;
            }
        }

        console.log("Iniciando busca de dados do Admin...");

        // Busca Corridas usando as novas FKs explícitas
        const { data: ridesData, error: ridesError } = await supabase
            .from('rides')
            .select(`
                *,
                driver:profiles!public_rides_driver_id_fkey(first_name, last_name, avatar_url, car_model, car_plate),
                customer:profiles!public_rides_customer_id_fkey(first_name, last_name, avatar_url)
            `)
            .order('created_at', { ascending: false });

        if (ridesError) {
            console.error("Erro ao buscar corridas:", ridesError);
            throw ridesError;
        }

        // Busca Usuários
        const { data: usersData, error: usersError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        
        if (usersError) {
             console.error("Erro ao buscar usuários:", usersError);
        }

        // Processamento de Estatísticas
        const currentRides = ridesData || [];
        const currentUsers = usersData || [];

        // Transações simuladas baseadas nas corridas (para demo)
        const recentTrans = currentRides.slice(0, 10).map(r => ({
            id: r.id,
            type: 'income',
            amount: Number(r.platform_fee || 0),
            date: r.created_at,
            description: `Taxa da corrida #${r.id.substring(0,4)}`
        }));
        setTransactions(recentTrans);

        const totalRevenue = currentRides.filter(r => r.status === 'COMPLETED').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
        const adminRev = currentRides.reduce((acc, curr) => acc + (Number(curr.platform_fee) || 0), 0);
        const activeCount = currentRides.filter(r => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)).length;

        // Gráfico
        const chartMap = new Map();
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            chartMap.set(dateStr, { date: dateStr, total: 0, count: 0 });
        }
        currentRides.forEach(r => {
            if (r.status === 'COMPLETED') {
                const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if(chartMap.has(date)) {
                    const curr = chartMap.get(date);
                    curr.total += Number(r.price || 0);
                    curr.count += 1;
                }
            }
        });
        setChartData(Array.from(chartMap.values()));

        setStats({
            revenue: totalRevenue,
            adminRevenue: adminRev,
            rides: currentRides.length,
            activeRides: activeCount,
            users: currentUsers.filter((u:any) => u.role === 'client').length,
            drivers: currentUsers.filter((u:any) => u.role === 'driver').length
        });

        setRides(currentRides);
        setUsers(currentUsers);

    } catch (e: any) {
        console.error("Erro geral no Dashboard:", e);
        showError("Erro ao carregar dados: " + (e.message || "Erro desconhecido"));
    } finally {
        setLoading(false);
    }
  };

  const filteredRides = rides.filter(r => filterStatus === 'ALL' ? true : r.status === filterStatus);

  // Componente de Card Stats com Hover Effect
  const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
      <Card className="border-0 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group overflow-hidden relative">
          <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
              <Icon className="w-24 h-24" />
          </div>
          <CardContent className="p-6 relative z-10">
              <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 text-white`}>
                      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
                  </div>
                  {subtext && <Badge variant="outline" className="font-mono">{subtext}</Badge>}
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
              <h3 className="text-3xl font-black mt-1 tracking-tight">{value}</h3>
          </CardContent>
      </Card>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* --- SIDEBAR DESKTOP --- */}
      <aside className={`hidden lg:flex flex-col z-20 transition-all duration-300 border-r border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
         <div className="p-6 flex items-center justify-between">
             {!sidebarCollapsed && (
                 <div className="flex items-center gap-2 text-2xl font-black tracking-tighter">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-black rounded-xl flex items-center justify-center shadow-lg">
                        <Shield className="w-6 h-6" />
                    </div>
                    <span>Gold<span className="text-yellow-500">Admin</span></span>
                 </div>
             )}
             {sidebarCollapsed && <div className="mx-auto w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><Shield className="w-6 h-6" /></div>}
             
             <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto text-muted-foreground hover:text-foreground">
                 {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
             </Button>
         </div>

         <nav className="flex-1 px-4 space-y-2 mt-4">
             {[
                 { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                 { id: 'rides', label: 'Corridas', icon: MapIcon },
                 { id: 'users', label: 'Passageiros', icon: Users },
                 { id: 'drivers', label: 'Motoristas', icon: Car },
                 { id: 'finance', label: 'Financeiro', icon: Wallet },
                 { id: 'config', label: 'Configurações', icon: Settings },
             ].map(item => (
                 <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 group overflow-hidden
                    ${activeTab === item.id 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg shadow-slate-900/20' 
                        : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'}
                    ${sidebarCollapsed ? 'justify-center px-2' : ''}
                    `}
                 >
                     <item.icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-yellow-500' : ''}`} />
                     {!sidebarCollapsed && <span>{item.label}</span>}
                     {activeTab === item.id && !sidebarCollapsed && <div className="absolute right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                 </button>
             ))}
         </nav>

         <div className="p-4 mt-auto">
             <div className={`flex items-center gap-3 w-full p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-border/50 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                 <Avatar className="w-10 h-10 border-2 border-white dark:border-slate-700 shadow-sm">
                     <AvatarImage src={adminProfile?.avatar_url} />
                     <AvatarFallback className="bg-yellow-500 text-black font-bold">AD</AvatarFallback>
                 </Avatar>
                 {!sidebarCollapsed && (
                     <div className="text-left overflow-hidden flex-1 min-w-0">
                         <p className="text-sm font-bold truncate text-foreground">{adminProfile?.first_name || 'Admin'}</p>
                         <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span> Online</p>
                     </div>
                 )}
                 {!sidebarCollapsed && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </Button>
                 )}
             </div>
         </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
          {/* Header Mobile */}
          <header className="lg:hidden h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b px-4 flex items-center justify-between sticky top-0 z-50">
               <div className="flex items-center gap-2 font-black text-xl">Gold<span className="text-yellow-500">Admin</span></div>
               <Sheet>
                  <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger>
                  <SheetContent side="left" className="p-0 border-r-0 bg-slate-900 text-white w-72">
                      <div className="p-6 font-black text-2xl">Menu</div>
                      <div className="px-4 space-y-2">
                          {['overview', 'rides', 'users', 'drivers', 'finance', 'config'].map(id => (
                              <Button key={id} variant="ghost" className="w-full justify-start text-lg capitalize h-14 rounded-xl" onClick={() => setActiveTab(id)}>{id}</Button>
                          ))}
                      </div>
                  </SheetContent>
               </Sheet>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                  
                  {/* Header da Página */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                      <div>
                          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white capitalize mb-1">{activeTab === 'overview' ? 'Visão Geral' : activeTab === 'config' ? 'Configurações' : activeTab === 'users' ? 'Passageiros' : activeTab === 'rides' ? 'Corridas' : activeTab === 'drivers' ? 'Motoristas' : 'Financeiro'}</h1>
                          <p className="text-muted-foreground">Bem-vindo ao painel de controle GoldDrive.</p>
                      </div>
                      <div className="flex gap-3">
                          <Button variant="outline" className="rounded-xl h-12 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50" onClick={fetchData}>
                              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                          </Button>
                          <Button variant="destructive" className="rounded-xl h-12 font-bold px-6 shadow-red-500/20 shadow-lg hover:shadow-red-500/30 transition-all" onClick={() => navigate('/')}>
                              <LogOut className="w-4 h-4 mr-2" /> Sair
                          </Button>
                      </div>
                  </div>

                  {/* --- TAB: OVERVIEW --- */}
                  {activeTab === 'overview' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                          {/* Stats Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <StatCard title="Receita Total" value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} colorClass="bg-green-500" subtext="+12% esse mês" />
                              <StatCard title="Lucro Plataforma" value={`R$ ${stats.adminRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} colorClass="bg-blue-500" subtext="20% taxa" />
                              <StatCard title="Corridas Ativas" value={stats.activeRides} icon={Clock} colorClass="bg-yellow-500" subtext="Agora" />
                              <StatCard title="Total Motoristas" value={stats.drivers} icon={Car} colorClass="bg-purple-500" subtext={`${stats.drivers > 0 ? '85% online' : '0 online'}`} />
                          </div>

                          {/* Charts Row */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              <Card className="lg:col-span-2 border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                                  <CardHeader>
                                      <CardTitle>Fluxo de Receita</CardTitle>
                                      <CardDescription>Movimentação financeira dos últimos 7 dias</CardDescription>
                                  </CardHeader>
                                  <CardContent className="h-[350px]">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <AreaChart data={chartData}>
                                              <defs>
                                                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/><stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                                  </linearGradient>
                                              </defs>
                                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                              <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} stroke="#888" dy={10} />
                                              <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#888" tickFormatter={(v) => `R$${v}`} />
                                              <Tooltip 
                                                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }} 
                                                  itemStyle={{ color: '#fbbf24' }}
                                                  formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Receita']}
                                              />
                                              <Area type="monotone" dataKey="total" stroke="#eab308" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                                          </AreaChart>
                                      </ResponsiveContainer>
                                  </CardContent>
                              </Card>

                              <Card className="border-0 shadow-xl bg-slate-900 text-white rounded-[32px] overflow-hidden relative">
                                  <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full blur-[80px] opacity-20" />
                                  <CardHeader className="relative z-10"><CardTitle>Status da Frota</CardTitle></CardHeader>
                                  <CardContent className="relative z-10 space-y-6">
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]" /> <span>Em Corrida</span></div>
                                          <span className="font-bold text-2xl">{stats.activeRides}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3"><div className="w-3 h-3 bg-blue-500 rounded-full" /> <span>Disponíveis</span></div>
                                          <span className="font-bold text-2xl">{Math.max(0, stats.drivers - stats.activeRides)}</span>
                                      </div>
                                      <div className="flex items-center justify-between opacity-50">
                                          <div className="flex items-center gap-3"><div className="w-3 h-3 bg-gray-500 rounded-full" /> <span>Offline</span></div>
                                          <span className="font-bold text-2xl">0</span>
                                      </div>
                                      
                                      <div className="pt-6 mt-6 border-t border-white/10">
                                          <h4 className="font-medium text-gray-400 mb-2">Ação Rápida</h4>
                                          <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold h-12 rounded-xl">Enviar Comunicado</Button>
                                      </div>
                                  </CardContent>
                              </Card>
                          </div>
                      </div>
                  )}

                  {/* --- TAB: RIDES --- */}
                  {activeTab === 'rides' && (
                      <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                           <CardHeader className="flex flex-row items-center justify-between px-8 pt-8">
                               <div><CardTitle className="text-2xl">Gerenciamento de Corridas</CardTitle><CardDescription>Total de {rides.length} corridas registradas</CardDescription></div>
                               <div className="flex items-center gap-3">
                                   <Badge variant="outline" className="h-10 px-4 rounded-xl text-sm gap-2"><Filter className="w-4 h-4"/> Filtros</Badge>
                                   <Select value={filterStatus} onValueChange={setFilterStatus}>
                                       <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white dark:bg-slate-800"><SelectValue placeholder="Status" /></SelectTrigger>
                                       <SelectContent><SelectItem value="ALL">Todos os Status</SelectItem><SelectItem value="COMPLETED">Finalizadas</SelectItem><SelectItem value="CANCELLED">Canceladas</SelectItem><SelectItem value="IN_PROGRESS">Em Andamento</SelectItem></SelectContent>
                                   </Select>
                               </div>
                           </CardHeader>
                           <CardContent className="p-0">
                               <Table>
                                   <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">ID</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-8">Valor</TableHead></TableRow></TableHeader>
                                   <TableBody>
                                       {filteredRides.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma corrida encontrada</TableCell></TableRow> : filteredRides.map(r => (
                                           <TableRow key={r.id} onClick={()=>setSelectedRide(r)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-border/50">
                                               <TableCell className="pl-8 font-mono text-xs opacity-50">#{r.id.substring(0,8)}</TableCell>
                                               <TableCell><div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.customer?.avatar_url}/><AvatarFallback>{r.customer?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-medium">{r.customer?.first_name || 'Usuário'}</span></div></TableCell>
                                               <TableCell>{r.driver ? <div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.driver?.avatar_url}/><AvatarFallback>{r.driver?.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{r.driver.first_name}</p><p className="text-[10px] text-muted-foreground">{r.driver.car_model}</p></div></div> : <span className="text-muted-foreground text-sm italic">--</span>}</TableCell>
                                               <TableCell>
                                                   <Badge className={`rounded-lg px-3 py-1 ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' : r.status === 'CANCELLED' ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                       {r.status === 'COMPLETED' ? <CheckCircle className="w-3 h-3 mr-1" /> : r.status === 'CANCELLED' ? <XCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                                                       {r.status}
                                                   </Badge>
                                               </TableCell>
                                               <TableCell className="text-right pr-8 font-bold text-base">R$ {r.price}</TableCell>
                                           </TableRow>
                                       ))}
                                   </TableBody>
                               </Table>
                           </CardContent>
                      </Card>
                  )}

                  {/* --- TAB: USERS & DRIVERS (Shared Logic Layout) --- */}
                  {(activeTab === 'users' || activeTab === 'drivers') && (
                       <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                           <CardHeader className="px-8 pt-8"><CardTitle>{activeTab === 'users' ? 'Passageiros Cadastrados' : 'Frota de Motoristas'}</CardTitle></CardHeader>
                           <CardContent className="p-0">
                               <Table>
                                   <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">Nome</TableHead><TableHead>Contato</TableHead>{activeTab === 'drivers' && <TableHead>Veículo</TableHead>}<TableHead>Cadastro</TableHead><TableHead className="text-right pr-8">Saldo</TableHead></TableRow></TableHeader>
                                   <TableBody>
                                       {users.filter(u => u.role === (activeTab === 'users' ? 'client' : 'driver')).map(u => (
                                           <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50">
                                               <TableCell className="pl-8"><div className="flex items-center gap-3"><Avatar className="w-10 h-10 border-2 border-white shadow-sm"><AvatarImage src={u.avatar_url}/><AvatarFallback>{u.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-sm">{u.first_name} {u.last_name}</p><p className="text-xs text-muted-foreground">{u.id.substring(0,8)}</p></div></div></TableCell>
                                               <TableCell><div className="text-sm"><p>{u.email}</p><p className="text-muted-foreground text-xs">{u.phone || 'Sem telefone'}</p></div></TableCell>
                                               {activeTab === 'drivers' && <TableCell><Badge variant="secondary" className="font-mono">{u.car_model || 'N/A'} • {u.car_plate}</Badge></TableCell>}
                                               <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at || new Date()).toLocaleDateString()}</TableCell>
                                               <TableCell className="text-right pr-8 font-bold text-green-600">R$ {u.balance?.toFixed(2)}</TableCell>
                                           </TableRow>
                                       ))}
                                   </TableBody>
                               </Table>
                           </CardContent>
                       </Card>
                  )}

                  {/* --- TAB: FINANCEIRO --- */}
                  {activeTab === 'finance' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <Card className="bg-slate-900 text-white border-0 shadow-2xl rounded-[32px] overflow-hidden relative col-span-2">
                                  <div className="absolute right-0 bottom-0 w-64 h-64 bg-green-500 rounded-full blur-[100px] opacity-20" />
                                  <CardContent className="p-8 relative z-10 flex flex-col justify-between h-full">
                                      <div className="flex justify-between items-start">
                                          <div><p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-1">Saldo da Plataforma</p><h2 className="text-5xl font-black">R$ {stats.adminRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2></div>
                                          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><Wallet className="w-8 h-8 text-green-400" /></div>
                                      </div>
                                      <div className="flex gap-4 mt-8">
                                          <Button className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold h-12 rounded-xl">Solicitar Saque</Button>
                                          <Button variant="outline" className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white h-12 rounded-xl">Configurar Taxas</Button>
                                      </div>
                                  </CardContent>
                              </Card>
                              <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px]">
                                  <CardHeader><CardTitle>Taxas Atuais</CardTitle></CardHeader>
                                  <CardContent className="space-y-4">
                                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><span className="font-medium">Comissão</span> <Badge>20%</Badge></div>
                                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><span className="font-medium">Taxa Fixa</span> <Badge>R$ 0,00</Badge></div>
                                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><span className="font-medium">Saque Mín.</span> <Badge>R$ 50,00</Badge></div>
                                  </CardContent>
                              </Card>
                          </div>
                          
                          <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                              <CardHeader><CardTitle>Últimas Movimentações</CardTitle></CardHeader>
                              <CardContent>
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {transactions.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center">Sem transações recentes</TableCell></TableRow> : transactions.map((t, i) => (
                                              <TableRow key={i}>
                                                  <TableCell>{new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString()}</TableCell>
                                                  <TableCell>{t.description}</TableCell>
                                                  <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><ArrowUpRight className="w-3 h-3 mr-1" /> Entrada</Badge></TableCell>
                                                  <TableCell className="text-right font-bold text-green-600">+ R$ {t.amount.toFixed(2)}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </CardContent>
                          </Card>
                      </div>
                  )}

                  {/* --- TAB: CONFIG --- */}
                  {activeTab === 'config' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8">
                          <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px]">
                              <CardHeader><CardTitle>Geral do Sistema</CardTitle><CardDescription>Ajustes globais da plataforma</CardDescription></CardHeader>
                              <CardContent className="space-y-6">
                                  <div className="flex items-center justify-between">
                                      <div className="space-y-0.5"><Label className="text-base">Manutenção</Label><p className="text-sm text-muted-foreground">Desativa o app para usuários</p></div>
                                      <Switch />
                                  </div>
                                  <div className="flex items-center justify-between">
                                      <div className="space-y-0.5"><Label className="text-base">Novos Cadastros</Label><p className="text-sm text-muted-foreground">Permitir novos usuários</p></div>
                                      <Switch defaultChecked />
                                  </div>
                                  <div className="space-y-2 pt-4">
                                      <Label>Nome da Plataforma</Label>
                                      <Input defaultValue="GoldDrive" className="h-12 rounded-xl" />
                                  </div>
                              </CardContent>
                          </Card>
                          
                          <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px]">
                               <CardHeader><CardTitle>Segurança</CardTitle><CardDescription>Controle de acesso e verificação</CardDescription></CardHeader>
                               <CardContent className="space-y-6">
                                  <div className="flex items-center justify-between">
                                      <div className="space-y-0.5"><Label className="text-base">Aprovação Manual</Label><p className="text-sm text-muted-foreground">Motoristas precisam de aprovação</p></div>
                                      <Switch defaultChecked />
                                  </div>
                                  <div className="space-y-2 pt-4">
                                      <Label>Email de Suporte</Label>
                                      <Input defaultValue="suporte@golddrive.com" className="h-12 rounded-xl" />
                                  </div>
                                  <Button className="w-full bg-slate-900 text-white h-12 rounded-xl font-bold mt-4">Salvar Configurações</Button>
                               </CardContent>
                          </Card>
                      </div>
                  )}

              </div>
          </div>
      </main>
      
      {/* Detalhes da Corrida Modal */}
      <Dialog open={!!selectedRide} onOpenChange={(o) => !o && setSelectedRide(null)}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-[32px] border-0 shadow-2xl">
              <DialogHeader><DialogTitle>Detalhes da Corrida #{selectedRide?.id.substring(0,8)}</DialogTitle></DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center gap-1 mt-1">
                              <div className="w-3 h-3 bg-slate-900 dark:bg-white rounded-full" />
                              <div className="w-0.5 h-10 bg-gray-200 dark:bg-gray-700" />
                              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                          </div>
                          <div className="flex-1 space-y-6">
                              <div><p className="text-xs font-bold text-muted-foreground uppercase mb-1">Origem</p><p className="font-medium text-lg leading-tight">{selectedRide?.pickup_address}</p></div>
                              <div><p className="text-xs font-bold text-muted-foreground uppercase mb-1">Destino</p><p className="font-medium text-lg leading-tight">{selectedRide?.destination_address}</p></div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
                       <div className="flex items-center gap-3">
                           <Avatar className="h-12 w-12 border-2 border-white"><AvatarImage src={selectedRide?.driver?.avatar_url} /><AvatarFallback>DR</AvatarFallback></Avatar>
                           <div><p className="font-bold">{selectedRide?.driver?.first_name || 'Sem motorista'}</p><p className="text-xs text-muted-foreground">{selectedRide?.driver?.car_model}</p></div>
                       </div>
                       <div className="text-right">
                           <p className="text-xs text-muted-foreground uppercase font-bold">Total</p>
                           <p className="text-2xl font-black text-green-600">R$ {selectedRide?.price}</p>
                       </div>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;