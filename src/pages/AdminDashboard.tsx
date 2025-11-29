import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  CheckCircle, TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, BellRing, Save, AlertTriangle, Smartphone, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { useTheme } from "@/components/theme-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Dados Principais
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, ridesToday: 0, activeRides: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Estados de Gerenciamento (Edit/Delete)
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ first_name: "", last_name: "", phone: "" });

  // Configurações Mock
  const [config, setConfig] = useState({
      platformFee: "20",
      maintenanceMode: false,
      allowRegistrations: true,
      minRidePrice: "10.00"
  });

  // Filtros
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setAdminProfile(data);
            if (data?.role !== 'admin') {
                showError("Acesso restrito.");
                navigate('/');
                return;
            }
        }

        // 1. Buscar Corridas
        const { data: ridesData } = await supabase
            .from('rides')
            .select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`)
            .order('created_at', { ascending: false });

        const currentRides = ridesData || [];
        setRides(currentRides);

        // 2. Buscar Perfis
        const { data: profilesData, error: profileError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        
        if (profileError) console.error("Erro profiles:", profileError);

        const allProfiles = profilesData || [];
        setPassengers(allProfiles.filter((p: any) => p.role === 'client'));
        setDrivers(allProfiles.filter((p: any) => p.role === 'driver'));

        // 3. Calcular Estatísticas
        const today = new Date().toDateString();
        const ridesTodayCount = currentRides.filter(r => new Date(r.created_at).toDateString() === today).length;
        const totalRevenue = currentRides.filter(r => r.status === 'COMPLETED').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
        const adminRev = currentRides.reduce((acc, curr) => acc + (Number(curr.platform_fee) || 0), 0);
        const activeCount = currentRides.filter(r => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)).length;

        // Gráfico
        const chartMap = new Map();
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            chartMap.set(dateStr, { date: dateStr, total: 0 });
        }
        currentRides.forEach(r => {
            if (r.status === 'COMPLETED') {
                const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if(chartMap.has(date)) {
                    const curr = chartMap.get(date);
                    curr.total += Number(r.price || 0);
                }
            }
        });
        setChartData(Array.from(chartMap.values()));
        
        // Stats Finais
        setStats({
            revenue: totalRevenue,
            adminRevenue: adminRev,
            ridesToday: ridesTodayCount,
            activeRides: activeCount
        });

        // Mock Transactions
        const recentTrans = currentRides.slice(0, 15).map(r => ({
            id: r.id, 
            date: r.created_at, 
            amount: Number(r.platform_fee || 0), 
            description: `Taxa da Corrida`,
            status: 'completed',
            user: r.driver?.first_name || 'Motorista'
        }));
        setTransactions(recentTrans);

    } catch (e: any) {
        showError("Erro ao carregar: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  // --- ACTIONS DE GESTÃO ---

  const openEditUser = (user: any) => {
      setSelectedUser(user);
      setEditFormData({ first_name: user.first_name || "", last_name: user.last_name || "", phone: user.phone || "" });
      setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
      if (!selectedUser) return;
      try {
          const { error } = await supabase.from('profiles').update(editFormData).eq('id', selectedUser.id);
          if (error) throw error;
          showSuccess("Usuário atualizado!");
          setIsEditDialogOpen(false);
          fetchData();
      } catch (e: any) { showError(e.message); }
  };

  const openDeleteUser = (user: any) => {
      setSelectedUser(user);
      setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
      if (!selectedUser) return;
      try {
          const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
          if (error) throw error;
          showSuccess("Perfil removido do sistema.");
          setIsDeleteDialogOpen(false);
          fetchData();
      } catch (e: any) { showError(e.message); }
  };

  const handleResetPassword = async (email: string) => {
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/update-password' });
          if (error) throw error;
          showSuccess(`Email de redefinição enviado para ${email}`);
      } catch (e: any) { showError(e.message); }
  };

  const handleSaveConfig = () => {
      showSuccess("Configurações atualizadas com sucesso!");
  };

  // --- UI COMPONENTS ---

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

  const UserManagementTable = ({ data, type }: { data: any[], type: 'client' | 'driver' }) => {
      const filtered = data.filter(u => 
        (u.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );

      return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row justify-between items-center bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl backdrop-blur-md gap-4">
                   <div className="flex gap-4 text-sm font-bold text-muted-foreground w-full md:w-auto">
                       <div className="flex items-center gap-2"><Users className="w-4 h-4"/> Total: <span className="text-foreground">{data.length}</span></div>
                       <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500"/> Ativos: <span className="text-foreground">{data.length}</span></div>
                   </div>
                   <div className="relative w-full md:w-64">
                       <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                       <Input placeholder="Buscar por nome ou email..." className="pl-9 bg-white/50 dark:bg-slate-900/50 border-0 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
              </div>

              <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                  <CardHeader><CardTitle>Gerenciar {type === 'client' ? 'Passageiros' : 'Motoristas'}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                      {loading ? (
                          <div className="p-10 text-center flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-yellow-500" /><p className="text-muted-foreground">Carregando usuários...</p></div>
                      ) : filtered.length === 0 ? (
                          <div className="p-10 text-center text-muted-foreground"><p>Nenhum usuário encontrado.</p></div>
                      ) : (
                          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                              <Table>
                                  <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md"><TableRow><TableHead className="pl-8">Usuário</TableHead><TableHead>Contato</TableHead>{type === 'driver' && <TableHead>Veículo</TableHead>}<TableHead>Saldo</TableHead><TableHead className="text-right pr-8">Ações</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                      {filtered.map(u => (
                                          <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50">
                                              <TableCell className="pl-8"><div className="flex items-center gap-3"><Avatar className="w-10 h-10 border-2 border-white shadow-sm"><AvatarImage src={u.avatar_url}/><AvatarFallback>{u.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-sm">{u.first_name} {u.last_name}</p><p className="text-xs text-muted-foreground">ID: {u.id.substring(0,6)}</p></div></div></TableCell>
                                              <TableCell><div className="text-sm"><p>{u.email}</p><p className="text-muted-foreground text-xs">{u.phone || 'Sem telefone'}</p></div></TableCell>
                                              {type === 'driver' && <TableCell><Badge variant="secondary" className="font-mono">{u.car_model || 'N/A'} • {u.car_plate}</Badge></TableCell>}
                                              <TableCell className="font-bold text-green-600">R$ {u.balance?.toFixed(2)}</TableCell>
                                              <TableCell className="text-right pr-8">
                                                  <div className="flex justify-end gap-2">
                                                      <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditUser(u)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                                                      <Button variant="ghost" size="icon" title="Resetar Senha" onClick={() => handleResetPassword(u.email)}><Mail className="w-4 h-4 text-yellow-500" /></Button>
                                                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => openDeleteUser(u)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                                  </div>
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </div>
                      )}
                  </CardContent>
              </Card>
          </div>
      );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* --- SIDEBAR --- */}
      <aside className={`hidden lg:flex flex-col z-20 transition-all duration-300 border-r border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
         <div className="p-6 flex items-center justify-between">
             {!sidebarCollapsed && (
                 <div className="flex items-center gap-2 text-2xl font-black tracking-tighter">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-black rounded-xl flex items-center justify-center shadow-lg"><Shield className="w-6 h-6" /></div>
                    <span>Gold<span className="text-yellow-500">Admin</span></span>
                 </div>
             )}
             {sidebarCollapsed && <div className="mx-auto w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><Shield className="w-6 h-6" /></div>}
             <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto text-muted-foreground hover:text-foreground">{sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}</Button>
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
                 <button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 group overflow-hidden ${activeTab === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg shadow-slate-900/20' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'} ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
                     <item.icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-yellow-500' : ''}`} />
                     {!sidebarCollapsed && <span>{item.label}</span>}
                     {activeTab === item.id && !sidebarCollapsed && <div className="absolute right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                 </button>
             ))}
         </nav>

         <div className="p-4 mt-auto">
             <div className={`flex items-center gap-3 w-full p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-border/50 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                 <Avatar className="w-10 h-10 border-2 border-white dark:border-slate-700 shadow-sm"><AvatarImage src={adminProfile?.avatar_url} /><AvatarFallback className="bg-yellow-500 text-black font-bold">AD</AvatarFallback></Avatar>
                 {!sidebarCollapsed && (
                     <div className="text-left overflow-hidden flex-1 min-w-0"><p className="text-sm font-bold truncate text-foreground">{adminProfile?.first_name || 'Admin'}</p><p className="text-xs text-muted-foreground truncate flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span> Online</p></div>
                 )}
                 {!sidebarCollapsed && <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</Button>}
             </div>
         </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
          <header className="lg:hidden h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b px-4 flex items-center justify-between sticky top-0 z-50">
               <div className="flex items-center gap-2 font-black text-xl">Gold<span className="text-yellow-500">Admin</span></div>
               <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger><SheetContent side="left" className="p-0 border-r-0 bg-slate-900 text-white w-72"><div className="p-6 font-black text-2xl">Menu</div><div className="px-4 space-y-2">{['overview', 'rides', 'users', 'drivers', 'finance', 'config'].map(id => (<Button key={id} variant="ghost" className="w-full justify-start text-lg capitalize h-14 rounded-xl" onClick={() => setActiveTab(id)}>{id}</Button>))}</div></SheetContent></Sheet>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                  
                  {/* Header da Página */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                      <div><h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white capitalize mb-1">{activeTab}</h1><p className="text-muted-foreground">Bem-vindo ao painel de controle.</p></div>
                      <div className="flex gap-3"><Button variant="outline" className="rounded-xl h-12" onClick={fetchData}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button><Button variant="destructive" className="rounded-xl h-12 font-bold px-6 shadow-red-500/20 shadow-lg" onClick={() => navigate('/')}><LogOut className="w-4 h-4 mr-2" /> Sair</Button></div>
                  </div>

                  {/* --- TAB: OVERVIEW --- */}
                  {activeTab === 'overview' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                          {/* Stats Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <StatCard title="Receita Total" value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} colorClass="bg-green-500" subtext="+12% esse mês" />
                              <StatCard title="Lucro Plataforma" value={`R$ ${stats.adminRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} colorClass="bg-blue-500" subtext="20% taxa" />
                              <StatCard title="Corridas Hoje" value={stats.ridesToday} icon={TrendingUp} colorClass="bg-red-500" subtext="Últimas 24h" />
                              <StatCard title="Ativos Agora" value={stats.activeRides} icon={Clock} colorClass="bg-yellow-500" subtext="Em tempo real" />
                          </div>

                          {/* Charts Row */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              <Card className="lg:col-span-2 border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                                  <CardHeader><CardTitle>Fluxo de Receita</CardTitle><CardDescription>Últimos 7 dias</CardDescription></CardHeader>
                                  <CardContent className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/><stop offset="95%" stopColor="#eab308" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} stroke="#888" dy={10} /><YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#888" tickFormatter={(v) => `R$${v}`} /><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} itemStyle={{ color: '#fbbf24' }} formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Receita']} /><Area type="monotone" dataKey="total" stroke="#eab308" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" /></AreaChart></ResponsiveContainer></CardContent>
                              </Card>
                              <div className="space-y-6">
                                  {/* Stats Users Overview */}
                                  <div className="grid grid-cols-2 gap-4">
                                      <Card className="border-0 shadow-lg bg-indigo-500 text-white rounded-[24px] overflow-hidden relative h-40">
                                          <div className="absolute -right-4 -bottom-4 opacity-20"><Users className="w-24 h-24" /></div>
                                          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
                                              <p className="font-bold text-sm uppercase opacity-80">Passageiros</p>
                                              <h3 className="text-3xl font-black">{passengers.length}</h3>
                                          </CardContent>
                                      </Card>
                                      <Card className="border-0 shadow-lg bg-orange-500 text-white rounded-[24px] overflow-hidden relative h-40">
                                          <div className="absolute -right-4 -bottom-4 opacity-20"><Car className="w-24 h-24" /></div>
                                          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
                                              <p className="font-bold text-sm uppercase opacity-80">Motoristas</p>
                                              <h3 className="text-3xl font-black">{drivers.length}</h3>
                                          </CardContent>
                                      </Card>
                                  </div>

                                  <Card className="border-0 shadow-xl bg-slate-900 text-white rounded-[32px] overflow-hidden relative h-auto">
                                      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full blur-[80px] opacity-20" />
                                      <CardHeader className="relative z-10 pb-2"><CardTitle>Status da Frota</CardTitle></CardHeader>
                                      <CardContent className="relative z-10 space-y-6">
                                          <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]" /> <span>Em Corrida</span></div><span className="font-bold text-2xl">{stats.activeRides}</span></div>
                                          <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-3 h-3 bg-blue-500 rounded-full" /> <span>Disponíveis</span></div><span className="font-bold text-2xl">{Math.max(0, drivers.length - stats.activeRides)}</span></div>
                                          <div className="pt-4 border-t border-white/10"><Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold h-12 rounded-xl">Enviar Comunicado</Button></div>
                                      </CardContent>
                                  </Card>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* --- TAB: RIDES --- */}
                  {activeTab === 'rides' && (
                      <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                           <CardHeader className="flex flex-row items-center justify-between px-8 pt-8"><div><CardTitle className="text-2xl">Gerenciamento de Corridas</CardTitle><CardDescription>Total de {rides.length} corridas</CardDescription></div><div className="flex items-center gap-3"><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[180px] h-10 rounded-xl bg-white dark:bg-slate-800"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os Status</SelectItem><SelectItem value="COMPLETED">Finalizadas</SelectItem><SelectItem value="CANCELLED">Canceladas</SelectItem><SelectItem value="IN_PROGRESS">Em Andamento</SelectItem></SelectContent></Select></div></CardHeader>
                           <CardContent className="p-0">
                               <Table>
                                   <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">ID</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-8">Valor</TableHead></TableRow></TableHeader>
                                   <TableBody>
                                       {rides.filter(r => filterStatus === 'ALL' ? true : r.status === filterStatus).map(r => (
                                           <TableRow key={r.id} onClick={()=>setSelectedRide(r)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-border/50">
                                               <TableCell className="pl-8 font-mono text-xs opacity-50">#{r.id.substring(0,8)}</TableCell>
                                               <TableCell><div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.customer?.avatar_url}/><AvatarFallback>{r.customer?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-medium">{r.customer?.first_name || 'Usuário'}</span></div></TableCell>
                                               <TableCell>{r.driver ? <div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.driver?.avatar_url}/><AvatarFallback>{r.driver?.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{r.driver.first_name}</p></div></div> : <span className="text-muted-foreground text-sm italic">--</span>}</TableCell>
                                               <TableCell><Badge className={`rounded-lg px-3 py-1 ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : r.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.status}</Badge></TableCell>
                                               <TableCell className="text-right pr-8 font-bold text-base">R$ {r.price}</TableCell>
                                           </TableRow>
                                       ))}
                                   </TableBody>
                               </Table>
                           </CardContent>
                      </Card>
                  )}

                  {/* --- TAB: USERS & DRIVERS (AVANÇADO) --- */}
                  {activeTab === 'users' && <UserManagementTable data={passengers} type="client" />}
                  {activeTab === 'drivers' && <UserManagementTable data={drivers} type="driver" />}

                  {/* --- TAB: FINANCEIRO (Restaurado e Melhorado) --- */}
                  {activeTab === 'finance' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {/* Cartão de Crédito Style */}
                              <div className="bg-slate-900 text-white rounded-[32px] p-8 shadow-2xl relative overflow-hidden h-64 flex flex-col justify-between group hover:scale-[1.01] transition-transform">
                                   <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-full blur-[80px]" />
                                   <div className="relative z-10 flex justify-between items-start">
                                       <CreditCard className="w-10 h-10 text-yellow-500" />
                                       <span className="font-mono text-sm opacity-60">GOLD PLATFORM</span>
                                   </div>
                                   <div className="relative z-10">
                                       <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1">Saldo Disponível</p>
                                       <h2 className="text-5xl font-black tracking-tight">R$ {stats.adminRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                                   </div>
                                   <div className="relative z-10 flex justify-between items-end">
                                       <div>
                                           <p className="text-xs text-slate-500 uppercase font-bold">Titular</p>
                                           <p className="font-bold">ADMINISTRADOR</p>
                                       </div>
                                       <div className="flex gap-2">
                                            <div className="w-8 h-8 rounded-full bg-red-500/80" />
                                            <div className="w-8 h-8 rounded-full bg-yellow-500/80 -ml-4" />
                                       </div>
                                   </div>
                              </div>

                              <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <Card className="rounded-[24px] border-0 shadow-lg bg-green-500 text-white p-6 flex flex-col justify-center items-center text-center">
                                          <TrendingUp className="w-8 h-8 mb-2" />
                                          <p className="font-bold text-sm uppercase opacity-90">Entradas (Mês)</p>
                                          <p className="text-2xl font-black">+ R$ {stats.adminRevenue.toFixed(2)}</p>
                                      </Card>
                                      <Card className="rounded-[24px] border-0 shadow-lg bg-red-500 text-white p-6 flex flex-col justify-center items-center text-center">
                                          <LogOut className="w-8 h-8 mb-2" />
                                          <p className="font-bold text-sm uppercase opacity-90">Saídas (Mês)</p>
                                          <p className="text-2xl font-black">- R$ 0.00</p>
                                      </Card>
                                  </div>
                                  <Button className="w-full h-16 rounded-[24px] text-lg font-bold bg-white text-black hover:bg-gray-100 shadow-xl border border-gray-200">
                                      <Wallet className="mr-2" /> Solicitar Saque
                                  </Button>
                              </div>
                          </div>

                          <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                              <CardHeader><CardTitle>Histórico de Transações</CardTitle></CardHeader>
                              <CardContent className="p-0">
                                  <Table>
                                      <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">Descrição</TableHead><TableHead>Usuário</TableHead><TableHead>Data</TableHead><TableHead className="text-right pr-8">Valor</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {transactions.map((t, i) => (
                                              <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50">
                                                  <TableCell className="pl-8 font-bold">{t.description}</TableCell>
                                                  <TableCell>{t.user}</TableCell>
                                                  <TableCell className="text-muted-foreground">{new Date(t.date).toLocaleDateString()}</TableCell>
                                                  <TableCell className="text-right pr-8 font-black text-green-600">+ R$ {t.amount.toFixed(2)}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </CardContent>
                          </Card>
                      </div>
                  )}

                  {/* --- TAB: CONFIGURAÇÕES (Restaurada e Completa) --- */}
                  {activeTab === 'config' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8">
                          <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] h-fit">
                              <CardHeader>
                                  <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Parâmetros do Sistema</CardTitle>
                                  <CardDescription>Ajuste as variáveis globais da plataforma.</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-6">
                                  <div className="space-y-2">
                                      <Label>Taxa da Plataforma (%)</Label>
                                      <div className="flex gap-2 items-center">
                                          <Input type="number" value={config.platformFee} onChange={e => setConfig({...config, platformFee: e.target.value})} className="rounded-xl h-12" />
                                          <span className="text-muted-foreground font-bold">%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">Porcentagem retida de cada corrida.</p>
                                  </div>
                                  <Separator />
                                  <div className="space-y-2">
                                      <Label>Preço Mínimo da Corrida (R$)</Label>
                                      <Input type="number" value={config.minRidePrice} onChange={e => setConfig({...config, minRidePrice: e.target.value})} className="rounded-xl h-12" />
                                  </div>
                              </CardContent>
                              <CardFooter>
                                  <Button onClick={handleSaveConfig} className="w-full h-12 rounded-xl font-bold bg-slate-900 text-white"><Save className="w-4 h-4 mr-2" /> Salvar Alterações</Button>
                              </CardFooter>
                          </Card>

                          <div className="space-y-6">
                              <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px]">
                                  <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Controle do App</CardTitle></CardHeader>
                                  <CardContent className="space-y-6">
                                      <div className="flex items-center justify-between">
                                          <div className="space-y-0.5">
                                              <Label className="text-base">Modo Manutenção</Label>
                                              <p className="text-xs text-muted-foreground">Bloqueia acesso de todos os usuários.</p>
                                          </div>
                                          <Switch checked={config.maintenanceMode} onCheckedChange={c => setConfig({...config, maintenanceMode: c})} />
                                      </div>
                                      <Separator />
                                      <div className="flex items-center justify-between">
                                          <div className="space-y-0.5">
                                              <Label className="text-base">Permitir Novos Cadastros</Label>
                                              <p className="text-xs text-muted-foreground">Aceitar novos motoristas e passageiros.</p>
                                          </div>
                                          <Switch checked={config.allowRegistrations} onCheckedChange={c => setConfig({...config, allowRegistrations: c})} />
                                      </div>
                                  </CardContent>
                              </Card>

                              <Card className="border-0 shadow-xl bg-slate-900 text-white rounded-[32px] overflow-hidden">
                                  <CardHeader><CardTitle className="flex items-center gap-2 text-red-500"><AlertTriangle className="w-5 h-5" /> Zona de Perigo</CardTitle></CardHeader>
                                  <CardContent className="space-y-4">
                                      <p className="text-sm text-gray-400">Ações irreversíveis que afetam toda a base de dados.</p>
                                      <Button variant="destructive" className="w-full h-12 rounded-xl font-bold">Limpar Cache de Sessões</Button>
                                  </CardContent>
                              </Card>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </main>
      
      {/* DIALOGS DE GESTÃO */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div><Label>Nome</Label><Input value={editFormData.first_name} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} /></div>
                  <div><Label>Sobrenome</Label><Input value={editFormData.last_name} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} /></div>
                  <div><Label>Telefone</Label><Input value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
              </div>
              <DialogFooter><Button onClick={handleSaveUser}>Salvar Alterações</Button></DialogFooter>
          </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Usuário?</AlertDialogTitle><AlertDialogDescription>Isso removerá o perfil do sistema. A conta de login permanecerá mas sem acesso aos dados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-red-600">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Detalhes da Corrida Modal */}
      <Dialog open={!!selectedRide} onOpenChange={(o) => !o && setSelectedRide(null)}>
          <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-[32px] border-0 shadow-2xl">
              <DialogHeader><DialogTitle>Detalhes da Corrida</DialogTitle></DialogHeader>
              <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 gap-4">
                      <div><p className="text-xs font-bold text-muted-foreground uppercase">Origem</p><p className="font-medium text-lg">{selectedRide?.pickup_address}</p></div>
                      <div><p className="text-xs font-bold text-muted-foreground uppercase">Destino</p><p className="font-medium text-lg">{selectedRide?.destination_address}</p></div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
                       <div className="flex items-center gap-3"><Avatar><AvatarImage src={selectedRide?.driver?.avatar_url} /><AvatarFallback>DR</AvatarFallback></Avatar><div><p className="font-bold">{selectedRide?.driver?.first_name || 'Sem motorista'}</p></div></div>
                       <div className="text-right"><p className="text-xs text-muted-foreground uppercase font-bold">Total</p><p className="text-2xl font-black text-green-600">R$ {selectedRide?.price}</p></div>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;