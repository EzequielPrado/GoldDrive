import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, Loader2, Save, AlertTriangle, Menu,
  Phone, Calendar, Star, CheckCircle2, FileText, XCircle, Banknote,
  MapPin, Navigation, ArrowRight, KeyRound, ZoomIn, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { useTheme } from "@/components/theme-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Estados de Gerenciamento
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [viewUserData, setViewUserData] = useState<any>(null);
  const [userRidesList, setUserRidesList] = useState<any[]>([]); 
  const [userStats, setUserStats] = useState({ totalRides: 0, totalMoney: 0, lastRide: '', canceledRides: 0 });
  
  // Aprovação Motorista
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null); // Novo estado para zoom
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ first_name: "", last_name: "", phone: "", cpf: "" });

  // Detalhes da Corrida
  const [viewRideData, setViewRideData] = useState<any>(null);

  // Configurações
  const [paymentSettings, setPaymentSettings] = useState({ wallet: true, cash: true });
  const [platformFee, setPlatformFee] = useState("20");

  // Filtros
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: role } = await supabase.rpc('get_my_role');
            if (role !== 'admin') { showError("Acesso restrito."); navigate('/'); return; }
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            setAdminProfile(profileData);
        }

        const { data: ridesData } = await supabase.rpc('get_admin_rides');
        const currentRides = Array.isArray(ridesData) ? ridesData : [];
        setRides(currentRides);

        const { data: profilesData } = await supabase.rpc('get_admin_profiles');
        const allProfiles = Array.isArray(profilesData) ? profilesData : [];
        setPassengers(allProfiles.filter((p: any) => p.role === 'client'));
        setDrivers(allProfiles.filter((p: any) => p.role === 'driver' && p.driver_status === 'APPROVED'));
        setPendingDrivers(allProfiles.filter((p: any) => p.role === 'driver' && p.driver_status === 'PENDING'));

        const { data: settings } = await supabase.from('app_settings').select('*');
        if (settings) {
            const wallet = settings.find(s => s.key === 'payment_wallet')?.value ?? true;
            const cash = settings.find(s => s.key === 'payment_cash')?.value ?? true;
            setPaymentSettings({ wallet, cash });
        }

        const today = new Date().toDateString();
        setStats({
            revenue: currentRides.filter((r: any) => r.status === 'COMPLETED').reduce((acc: number, curr: any) => acc + (Number(curr.price) || 0), 0),
            adminRevenue: currentRides.reduce((acc: number, curr: any) => acc + (Number(curr.platform_fee) || 0), 0),
            ridesToday: currentRides.filter((r: any) => new Date(r.created_at).toDateString() === today).length,
            activeRides: currentRides.filter((r: any) => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)).length
        });

        const chartMap = new Map();
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            chartMap.set(dateStr, { date: dateStr, total: 0 });
        }
        currentRides.forEach((r: any) => {
            if (r.status === 'COMPLETED') {
                const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if(chartMap.has(date)) chartMap.get(date).total += Number(r.price || 0);
            }
        });
        setChartData(Array.from(chartMap.values()));

    } catch (e: any) { showError("Erro: " + e.message); } finally { setLoading(false); }
  };

  const handleApproveDriver = async (id: string, approve: boolean) => {
      try {
          const status = approve ? 'APPROVED' : 'REJECTED';
          await supabase.from('profiles').update({ driver_status: status }).eq('id', id);
          showSuccess(approve ? "Motorista aprovado!" : "Motorista reprovado.");
          setRequestModalOpen(false);
          fetchData();
      } catch (e: any) { showError(e.message); }
  };

  const handleTogglePayment = async (key: string, checked: boolean) => {
      const { error } = await supabase.from('app_settings').upsert({ key, value: checked });
      if (error) showError("Erro ao salvar config");
      else {
          setPaymentSettings(prev => ({ ...prev, [key === 'payment_wallet' ? 'wallet' : 'cash']: checked }));
          showSuccess("Configuração atualizada");
      }
  };

  // User Actions
  const openViewUser = (user: any) => {
      const userRides = rides.filter(r => user.role === 'driver' ? r.driver_id === user.id : r.customer_id === user.id);
      const completed = userRides.filter(r => r.status === 'COMPLETED');
      const canceled = userRides.filter(r => r.status === 'CANCELLED');
      const total = completed.reduce((acc, curr) => acc + (user.role === 'driver' ? Number(curr.driver_earnings||0) : Number(curr.price||0)), 0);
      
      setUserStats({ 
          totalRides: completed.length, 
          canceledRides: canceled.length, 
          totalMoney: total, 
          lastRide: userRides[0] ? new Date(userRides[0].created_at).toLocaleDateString() : 'Nunca' 
      });
      setUserRidesList(userRides);
      setViewUserData(user);
  };

  const openEditUser = (user: any) => { 
      setSelectedUser(user); 
      setEditFormData({ 
          first_name: user.first_name || "", 
          last_name: user.last_name || "", 
          phone: user.phone || "",
          cpf: user.cpf || ""
      }); 
      setIsEditDialogOpen(true); 
  };

  const handleSaveUser = async () => { 
      if (!selectedUser) return; 
      await supabase.from('profiles').update(editFormData).eq('id', selectedUser.id); 
      showSuccess("Dados atualizados!"); 
      setIsEditDialogOpen(false); 
      fetchData(); 
  };

  const openDeleteUser = (user: any) => { setSelectedUser(user); setIsDeleteDialogOpen(true); };
  
  const handleDeleteUser = async () => { 
      if (!selectedUser) return; 
      await supabase.from('profiles').delete().eq('id', selectedUser.id); 
      showSuccess("Usuário removido."); 
      setIsDeleteDialogOpen(false); 
      fetchData(); 
  };

  const handleResetPassword = async (email: string) => { 
      if (!email) return showError("Email inválido");
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/update-password' }); 
      showSuccess(`Email enviado para ${email}`); 
  };

  // --- COMPONENTS ---

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
      <Card className="border-0 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl hover:scale-[1.02] transition-transform relative overflow-hidden">
          <div className={`absolute -right-4 -top-4 opacity-10 ${colorClass} p-4 rounded-full`}><Icon className="w-24 h-24" /></div>
          <CardContent className="p-6 relative z-10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass} bg-opacity-20 text-white`}><Icon className="w-6 h-6" /></div>
              <p className="text-sm font-bold text-muted-foreground uppercase">{title}</p>
              <h3 className="text-3xl font-black">{value}</h3>
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
                   </div>
                   <div className="relative w-full md:w-64">
                       <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                       <Input placeholder="Buscar..." className="pl-9 bg-white/50 dark:bg-slate-900/50 border-0 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
              </div>

              <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                  <CardHeader><CardTitle>Gerenciar {type === 'client' ? 'Passageiros' : 'Motoristas'}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                      {loading ? (
                          <div className="p-10 text-center flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-yellow-500" /><p className="text-muted-foreground">Carregando...</p></div>
                      ) : filtered.length === 0 ? (
                          <div className="p-10 text-center text-muted-foreground"><p>Nenhum usuário encontrado.</p></div>
                      ) : (
                          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                              <Table>
                                  <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md"><TableRow><TableHead className="pl-8">Usuário</TableHead><TableHead>Contato</TableHead>{type === 'driver' && <TableHead>Veículo</TableHead>}<TableHead>Saldo</TableHead><TableHead className="text-right pr-8">Ações</TableHead></TableRow></TableHeader>
                                  <TableBody>
                                      {filtered.map(u => (
                                          <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50 cursor-pointer" onClick={() => openViewUser(u)}>
                                              <TableCell className="pl-8"><div className="flex items-center gap-3"><Avatar className="w-10 h-10 border-2 border-white shadow-sm"><AvatarImage src={u.avatar_url}/><AvatarFallback>{u.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-sm">{u.first_name} {u.last_name}</p><p className="text-xs text-muted-foreground">ID: {u.id.substring(0,6)}</p></div></div></TableCell>
                                              <TableCell><div className="text-sm"><p>{u.email}</p><p className="text-muted-foreground text-xs">{u.phone || 'Sem telefone'}</p></div></TableCell>
                                              {type === 'driver' && <TableCell><Badge variant="secondary" className="font-mono">{u.car_model || 'N/A'} • {u.car_plate}</Badge></TableCell>}
                                              <TableCell className="font-bold text-green-600">R$ {Number(u.balance || 0).toFixed(2)}</TableCell>
                                              <TableCell className="text-right pr-8">
                                                  <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                      <Button variant="ghost" size="icon" onClick={() => openEditUser(u)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                                                      <Button variant="ghost" size="icon" onClick={() => openDeleteUser(u)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
      {/* Sidebar */}
      <aside className={`hidden lg:flex flex-col z-20 transition-all border-r border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
         <div className="p-6 flex justify-between items-center">
             {!sidebarCollapsed && <div className="font-black text-2xl flex items-center gap-2"><Shield className="text-yellow-500"/> GoldAdmin</div>}
             <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen/> : <PanelLeftClose/>}</Button>
         </div>
         <nav className="flex-1 px-4 space-y-2 mt-4">
             {[
                 { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                 { id: 'requests', label: 'Solicitações', icon: FileText, badge: pendingDrivers.length },
                 { id: 'rides', label: 'Corridas', icon: MapIcon },
                 { id: 'users', label: 'Passageiros', icon: Users },
                 { id: 'drivers', label: 'Motoristas', icon: Car },
                 { id: 'config', label: 'Configurações', icon: Settings },
             ].map(item => (
                 <button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                     <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-yellow-500' : ''}`} />
                     {!sidebarCollapsed && <span>{item.label}</span>}
                     {!sidebarCollapsed && item.badge > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{item.badge}</span>}
                 </button>
             ))}
         </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                  <div className="flex justify-between items-center">
                      <h1 className="text-4xl font-black capitalize">{activeTab === 'requests' ? 'Solicitações' : activeTab}</h1>
                      <Button variant="outline" onClick={fetchData}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button>
                  </div>

                  {/* OVERVIEW */}
                  {activeTab === 'overview' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                              <StatCard title="Receita" value={`R$ ${stats.revenue.toFixed(2)}`} icon={DollarSign} colorClass="bg-green-500" />
                              <StatCard title="Lucro Admin" value={`R$ ${stats.adminRevenue.toFixed(2)}`} icon={Wallet} colorClass="bg-blue-500" />
                              <StatCard title="Pendentes" value={pendingDrivers.length} icon={FileText} colorClass="bg-orange-500" />
                              <StatCard title="Em Curso" value={stats.activeRides} icon={Car} colorClass="bg-yellow-500" />
                          </div>
                          <Card className="rounded-[32px] border-0 shadow-xl"><CardContent className="h-[300px] pt-6"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid opacity={0.1}/><XAxis dataKey="date"/><YAxis/><Tooltip/><Area type="monotone" dataKey="total" stroke="#eab308" fill="#eab308" fillOpacity={0.2}/></AreaChart></ResponsiveContainer></CardContent></Card>
                      </div>
                  )}

                  {/* REQUESTS */}
                  {activeTab === 'requests' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                          {pendingDrivers.length === 0 ? <div className="col-span-3 text-center py-20 text-gray-400">Nenhuma solicitação pendente.</div> : 
                           pendingDrivers.map(driver => (
                              <Card key={driver.id} className="rounded-[32px] border-0 shadow-lg overflow-hidden flex flex-col">
                                  <div className="h-24 bg-orange-100 flex items-center justify-center"><FileText className="w-10 h-10 text-orange-500 opacity-50"/></div>
                                  <CardContent className="p-6 flex-1 text-center -mt-10">
                                      <Avatar className="w-20 h-20 mx-auto border-4 border-white shadow-md"><AvatarImage src={driver.avatar_url}/><AvatarFallback>{driver.first_name[0]}</AvatarFallback></Avatar>
                                      <h3 className="text-xl font-black mt-2">{driver.first_name} {driver.last_name}</h3>
                                      <p className="text-sm text-gray-500 mb-4">{driver.car_model} • {driver.car_plate}</p>
                                      <Button className="w-full bg-slate-900 text-white rounded-xl font-bold" onClick={() => { setSelectedRequest(driver); setRequestModalOpen(true); }}>Analisar Documentos</Button>
                                  </CardContent>
                              </Card>
                          ))}
                      </div>
                  )}

                  {/* USERS/DRIVERS */}
                  {activeTab === 'users' && <UserManagementTable data={passengers} type="client" />}
                  {activeTab === 'drivers' && <UserManagementTable data={drivers} type="driver" />}

                  {/* RIDES (LISTA GERAL) */}
                  {activeTab === 'rides' && (
                      <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                           <CardHeader className="flex flex-row items-center justify-between px-8 pt-8"><div><CardTitle className="text-2xl">Gerenciamento de Corridas</CardTitle><CardDescription>Total de {rides.length} corridas</CardDescription></div><div className="flex items-center gap-3"><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[180px] h-10 rounded-xl bg-white dark:bg-slate-800"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os Status</SelectItem><SelectItem value="COMPLETED">Finalizadas</SelectItem><SelectItem value="CANCELLED">Canceladas</SelectItem><SelectItem value="IN_PROGRESS">Em Andamento</SelectItem></SelectContent></Select></div></CardHeader>
                           <CardContent className="p-0">
                               <Table>
                                   <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">ID</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Status</TableHead><TableHead>Taxa App</TableHead><TableHead className="text-right pr-8">Valor Total</TableHead></TableRow></TableHeader>
                                   <TableBody>
                                       {rides.filter((r: any) => filterStatus === 'ALL' ? true : r.status === filterStatus).map((r: any) => (
                                           <TableRow key={r.id} onClick={()=>setViewRideData(r)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-border/50">
                                               <TableCell className="pl-8 font-mono text-xs opacity-50">#{r.id.substring(0,8)}</TableCell>
                                               <TableCell><div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.customer?.avatar_url}/><AvatarFallback>{r.customer?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-medium">{r.customer?.first_name || 'Usuário'}</span></div></TableCell>
                                               <TableCell>{r.driver ? <div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.driver?.avatar_url}/><AvatarFallback>{r.driver?.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{r.driver.first_name}</p></div></div> : <span className="text-muted-foreground text-sm italic">--</span>}</TableCell>
                                               <TableCell><Badge className={`rounded-lg px-3 py-1 ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : r.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.status}</Badge></TableCell>
                                               <TableCell className="font-bold text-slate-500">R$ {Number(r.platform_fee || 0).toFixed(2)}</TableCell>
                                               <TableCell className="text-right pr-8 font-bold text-base">R$ {Number(r.price).toFixed(2)}</TableCell>
                                           </TableRow>
                                       ))}
                                   </TableBody>
                               </Table>
                           </CardContent>
                      </Card>
                  )}

                  {/* CONFIGURAÇÕES */}
                  {activeTab === 'config' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                          <Card className="rounded-[32px] border-0 shadow-xl">
                              <CardHeader><CardTitle>Métodos de Pagamento</CardTitle><CardDescription>Controle o que os passageiros podem usar.</CardDescription></CardHeader>
                              <CardContent className="space-y-6">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3"><div className="p-2 bg-green-100 text-green-700 rounded-lg"><Banknote className="w-5 h-5"/></div><div className="font-bold">Dinheiro / PIX Direto</div></div>
                                      <Switch checked={paymentSettings.cash} onCheckedChange={(c) => handleTogglePayment('payment_cash', c)} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3"><div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><Wallet className="w-5 h-5"/></div><div className="font-bold">Carteira Digital (Saldo)</div></div>
                                      <Switch checked={paymentSettings.wallet} onCheckedChange={(c) => handleTogglePayment('payment_wallet', c)} />
                                  </div>
                              </CardContent>
                          </Card>
                          <Card className="rounded-[32px] border-0 shadow-xl">
                              <CardHeader><CardTitle>Taxas</CardTitle></CardHeader>
                              <CardContent><div className="space-y-2"><Label>Taxa (%)</Label><Input value={platformFee} onChange={e => setPlatformFee(e.target.value)} className="rounded-xl"/></div><Button className="w-full mt-4 rounded-xl font-bold bg-slate-900" onClick={() => showSuccess("Salvo!")}>Salvar</Button></CardContent>
                          </Card>
                      </div>
                  )}
              </div>
          </div>
      </main>

      {/* MODAL: KYC REQUEST (Aprovação) */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent className="max-w-4xl bg-white rounded-[32px] border-0 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
              {/* Header do Modal */}
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
                  <div className="flex items-center gap-6 relative z-10">
                      <Avatar className="w-20 h-20 border-4 border-white/20 shadow-xl"><AvatarImage src={selectedRequest?.avatar_url}/><AvatarFallback>{selectedRequest?.first_name[0]}</AvatarFallback></Avatar>
                      <div>
                          <h2 className="text-3xl font-black mb-1">{selectedRequest?.first_name} {selectedRequest?.last_name}</h2>
                          <div className="flex items-center gap-3 text-slate-300">
                             <Badge variant="outline" className="text-white border-white/20 bg-white/5">CPF: {selectedRequest?.cpf || 'N/A'}</Badge>
                             <span>•</span>
                             <span className="text-sm">Cadastrado em {new Date(selectedRequest?.created_at).toLocaleDateString()}</span>
                          </div>
                      </div>
                  </div>
                  <Badge className="bg-orange-500 text-black px-4 py-1.5 text-sm font-bold shadow-lg">ANÁLISE PENDENTE</Badge>
              </div>

              {/* Corpo do Modal */}
              <div className="p-8 space-y-8 bg-slate-50/50">
                  
                  {/* Dados de Contato */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-2"><Mail className="w-3 h-3"/> Email</p>
                          <p className="font-medium text-slate-900">{selectedRequest?.email}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-2"><Phone className="w-3 h-3"/> Telefone</p>
                          <p className="font-medium text-slate-900">{selectedRequest?.phone || 'Não informado'}</p>
                      </div>
                  </div>

                  {/* Documentos */}
                  <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 flex items-center gap-2"><FileText className="w-4 h-4"/> Documentação Enviada</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {[
                              { label: "Rosto (Selfie)", src: selectedRequest?.face_photo_url },
                              { label: "CNH Frente", src: selectedRequest?.cnh_front_url },
                              { label: "CNH Verso", src: selectedRequest?.cnh_back_url }
                          ].map((doc, idx) => (
                              <div key={idx} className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                  <div className="aspect-[4/3] bg-slate-100 relative cursor-zoom-in" onClick={() => setZoomedImage(doc.src)}>
                                      <img src={doc.src} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={doc.label} />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                          <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 drop-shadow-md" />
                                      </div>
                                  </div>
                                  <div className="p-3 border-t border-slate-100 font-bold text-center text-sm text-slate-700">{doc.label}</div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Veículo */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                       <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-900 uppercase text-sm"><Car className="w-4 h-4"/> Veículo Cadastrado</h3>
                       <div className="flex flex-wrap gap-3">
                           <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 text-center min-w-[100px]">
                               <p className="text-[10px] text-muted-foreground uppercase font-bold">Modelo</p>
                               <p className="font-bold text-slate-900">{selectedRequest?.car_model}</p>
                           </div>
                           <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 text-center min-w-[100px]">
                               <p className="text-[10px] text-muted-foreground uppercase font-bold">Placa</p>
                               <p className="font-bold text-slate-900 font-mono">{selectedRequest?.car_plate}</p>
                           </div>
                           <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 text-center min-w-[100px]">
                               <p className="text-[10px] text-muted-foreground uppercase font-bold">Cor</p>
                               <p className="font-bold text-slate-900">{selectedRequest?.car_color}</p>
                           </div>
                           <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 text-center min-w-[100px]">
                               <p className="text-[10px] text-muted-foreground uppercase font-bold">Ano</p>
                               <p className="font-bold text-slate-900">{selectedRequest?.car_year}</p>
                           </div>
                       </div>
                  </div>
              </div>

              <DialogFooter className="p-6 bg-white border-t gap-4">
                  <Button variant="outline" className="flex-1 h-14 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold" onClick={() => handleApproveDriver(selectedRequest.id, false)}>
                      <XCircle className="mr-2 w-5 h-5"/> Reprovar Cadastro
                  </Button>
                  <Button className="flex-1 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-600/20" onClick={() => handleApproveDriver(selectedRequest.id, true)}>
                      <CheckCircle2 className="mr-2 w-5 h-5"/> Aprovar Motorista
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* MODAL ZOOM IMAGEM */}
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-[90vw] h-[90vh] bg-black/95 border-0 p-0 flex items-center justify-center overflow-hidden">
              <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 bg-black/50 p-2 rounded-full"><X className="w-8 h-8"/></button>
              <img src={zoomedImage || ''} className="max-w-full max-h-full object-contain" alt="Zoom" />
          </DialogContent>
      </Dialog>
      
      {/* MODAL: DETALHES DO USUÁRIO + LISTA DE CORRIDAS */}
      <Dialog open={!!viewUserData} onOpenChange={(o) => !o && setViewUserData(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] border-0 shadow-2xl overflow-hidden p-0 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className={`h-32 w-full relative ${viewUserData?.role === 'driver' ? 'bg-yellow-500' : 'bg-slate-800'}`}>
                <div className="absolute -bottom-10 left-8">
                    <Avatar className="w-24 h-24 border-4 border-white dark:border-slate-900 shadow-lg bg-white"><AvatarImage src={viewUserData?.avatar_url} className="object-cover" /><AvatarFallback className="text-2xl font-bold bg-slate-100">{viewUserData?.first_name?.[0]}</AvatarFallback></Avatar>
                </div>
                <div className="absolute bottom-4 right-8 flex gap-2">
                     <Badge className="bg-black/20 hover:bg-black/30 text-white backdrop-blur-md border-0 h-8 px-4">ID: {viewUserData?.id.substring(0,6)}</Badge>
                     <Badge className="bg-white text-black hover:bg-gray-100 border-0 font-bold uppercase h-8 px-4">{viewUserData?.role === 'client' ? 'Passageiro' : 'Motorista'}</Badge>
                </div>
            </div>

            <div className="pt-12 px-8 pb-8">
                {/* Info Principal */}
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">{viewUserData?.first_name} {viewUserData?.last_name}</h2>
                        <div className="flex flex-col gap-1 mt-2">
                            <p className="text-muted-foreground flex items-center gap-2 font-medium"><Phone className="w-4 h-4 text-slate-400" /> {viewUserData?.phone || 'Sem telefone cadastrado'}</p>
                            <p className="text-muted-foreground text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Cadastrado em: {viewUserData?.created_at ? new Date(viewUserData.created_at).toLocaleDateString() : '--'}</p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto bg-slate-50 dark:bg-slate-800 sm:bg-transparent sm:dark:bg-transparent p-4 sm:p-0 rounded-2xl">
                        <p className="text-sm font-bold text-muted-foreground uppercase">Saldo em Carteira</p>
                        <h3 className={`text-4xl font-black ${Number(viewUserData?.balance) < 0 ? 'text-red-500' : 'text-green-600'}`}>R$ {Number(viewUserData?.balance || 0).toFixed(2)}</h3>
                    </div>
                </div>

                {/* Grid Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{viewUserData?.role === 'driver' ? 'Total Ganho' : 'Total Gasto'}</p><p className="text-xl font-black text-slate-900 dark:text-white truncate">R$ {userStats.totalMoney.toFixed(2)}</p></div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Viagens Feitas</p><p className="text-xl font-black text-slate-900 dark:text-white">{userStats.totalRides}</p></div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Cancelamentos</p><p className="text-xl font-black text-red-600 dark:text-red-400">{userStats.canceledRides}</p></div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Última Vez</p><p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={userStats.lastRide}>{userStats.lastRide.split(' ')[0] || 'Nunca'}</p></div>
                </div>

                {/* Info Específica Motorista */}
                {viewUserData?.role === 'driver' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-5 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 mb-8 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-500 shrink-0"><Car className="w-8 h-8" /></div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase mb-1">Veículo Cadastrado</p>
                            <p className="font-black text-slate-900 dark:text-white text-xl">{viewUserData.car_model || 'Modelo não informado'}</p>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                                <span className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg border border-black/5 font-mono font-bold text-sm shadow-sm">{viewUserData.car_plate || 'SEM-PLACA'}</span>
                                <span className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg border border-black/5 text-sm">{viewUserData.car_color}</span>
                                <span className="bg-white dark:bg-black/20 px-3 py-1 rounded-lg border border-black/5 text-sm">{viewUserData.car_year}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* HISTÓRICO DE CORRIDAS DO USUÁRIO */}
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-4 flex items-center gap-2"><MapIcon className="w-4 h-4"/> Histórico de Viagens</h3>
                    <ScrollArea className="h-[250px] pr-4">
                        <div className="space-y-3">
                            {userRidesList.length === 0 ? <p className="text-center py-6 text-gray-400">Nenhuma viagem encontrada.</p> : 
                            userRidesList.map(ride => (
                                <div key={ride.id} onClick={() => setViewRideData(ride)} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ride.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {ride.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">{new Date(ride.created_at).toLocaleDateString()} <span className="text-muted-foreground font-normal">• {new Date(ride.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></p>
                                            <p className="text-xs text-muted-foreground truncate max-w-[150px] md:max-w-[200px]">{ride.destination_address}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900 dark:text-white">R$ {Number(ride.price).toFixed(2)}</p>
                                        <span className="text-[10px] text-blue-500 font-bold group-hover:underline flex items-center justify-end gap-1">Ver Detalhes <ArrowRight className="w-3 h-3"/></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="gap-3 sm:gap-0 flex-col sm:flex-row">
                    <Button variant="outline" className="flex-1 h-14 rounded-xl text-base" onClick={() => setViewUserData(null)}>Fechar</Button>
                    <Button className="flex-1 h-14 rounded-xl bg-slate-900 text-white font-bold text-base shadow-xl" onClick={() => { setViewUserData(null); openEditUser(viewUserData); }}><Edit className="w-4 h-4 mr-2" /> Editar Dados</Button>
                </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDIÇÃO DE USUÁRIO (Dados + Senha) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-2xl bg-white dark:bg-slate-900 border-0 shadow-2xl">
              <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Nome</Label><Input className="h-12 rounded-xl" value={editFormData.first_name} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Sobrenome</Label><Input className="h-12 rounded-xl" value={editFormData.last_name} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} /></div>
                  </div>
                  <div className="space-y-2"><Label>CPF</Label><Input className="h-12 rounded-xl" value={editFormData.cpf} onChange={e => setEditFormData({...editFormData, cpf: e.target.value})} placeholder="000.000.000-00" /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input className="h-12 rounded-xl" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mt-4 border border-blue-100 dark:border-blue-900/50">
                      <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4"/> Segurança</h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">Envie um email para o usuário redefinir a senha.</p>
                      <Button variant="secondary" className="w-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900" onClick={() => handleResetPassword(selectedUser?.email)}>Enviar Email de Redefinição</Button>
                  </div>
              </div>
              <DialogFooter><Button className="w-full h-12 rounded-xl font-bold bg-slate-900 text-white" onClick={handleSaveUser}>Salvar Alterações</Button></DialogFooter>
          </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl bg-white dark:bg-slate-900 border-0"><AlertDialogHeader><AlertDialogTitle>Excluir Usuário?</AlertDialogTitle><AlertDialogDescription>Isso removerá o perfil do sistema. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl h-12">Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700 rounded-xl h-12 font-bold">Excluir Definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* MODAL: DETALHES COMPLETOS DA CORRIDA (PREMIUM) */}
      <Dialog open={!!viewRideData} onOpenChange={(o) => !o && setViewRideData(null)}>
          <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* Header Visual da Corrida */}
              <div className={`h-24 w-full relative flex items-center justify-between px-8 ${viewRideData?.status === 'COMPLETED' ? 'bg-green-600' : viewRideData?.status === 'CANCELLED' ? 'bg-red-600' : 'bg-blue-600'}`}>
                  <div className="text-white">
                      <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Corrida #{viewRideData?.id.substring(0,8)}</p>
                      <h2 className="text-2xl font-black">{viewRideData?.status === 'COMPLETED' ? 'FINALIZADA' : viewRideData?.status === 'CANCELLED' ? 'CANCELADA' : 'EM ANDAMENTO'}</h2>
                  </div>
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-white">
                      {viewRideData?.status === 'COMPLETED' ? <CheckCircle2 className="w-8 h-8"/> : <XCircle className="w-8 h-8"/>}
                  </div>
              </div>

              <div className="p-8 space-y-8">
                  {/* Rota */}
                  <div className="relative pl-6 space-y-8">
                      <div className="absolute left-[7px] top-2 bottom-6 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                      <div className="relative">
                          <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-slate-900 dark:bg-white ring-4 ring-slate-100 dark:ring-slate-800"></div>
                          <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Origem</p>
                          <p className="text-lg font-medium leading-tight">{viewRideData?.pickup_address}</p>
                      </div>
                      <div className="relative">
                          <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900/30"></div>
                          <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Destino</p>
                          <p className="text-lg font-medium leading-tight">{viewRideData?.destination_address}</p>
                      </div>
                  </div>

                  {/* Participantes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Card Passageiro */}
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Passageiro</p>
                          <div className="flex items-center gap-3">
                              <Avatar className="w-12 h-12 border-2 border-white shadow-sm"><AvatarImage src={viewRideData?.customer?.avatar_url}/><AvatarFallback>P</AvatarFallback></Avatar>
                              <div>
                                  <p className="font-bold text-sm">{viewRideData?.customer?.first_name || 'Desconhecido'}</p>
                                  <p className="text-xs text-muted-foreground">{viewRideData?.customer?.phone || '--'}</p>
                              </div>
                          </div>
                      </div>
                      {/* Card Motorista */}
                      <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
                          <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase mb-3">Motorista</p>
                          {viewRideData?.driver ? (
                              <div className="flex items-center gap-3">
                                  <Avatar className="w-12 h-12 border-2 border-white shadow-sm"><AvatarImage src={viewRideData?.driver?.avatar_url}/><AvatarFallback>M</AvatarFallback></Avatar>
                                  <div>
                                      <p className="font-bold text-sm text-slate-900 dark:text-white">{viewRideData.driver.first_name}</p>
                                      <p className="text-xs text-slate-500">{viewRideData.driver.car_model || '--'}</p>
                                  </div>
                              </div>
                          ) : <p className="text-sm italic text-muted-foreground">Não atribuído</p>}
                      </div>
                  </div>

                  {/* Detalhes Financeiros e Avaliação */}
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                      <div className="grid grid-cols-3 gap-4 mb-6 text-center border-b border-slate-200 dark:border-slate-600 pb-6">
                          <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total</p><p className="font-black text-xl">R$ {Number(viewRideData?.price).toFixed(2)}</p></div>
                          <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Motorista</p><p className="font-bold text-lg text-green-600">R$ {Number(viewRideData?.driver_earnings).toFixed(2)}</p></div>
                          <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Taxa App</p><p className="font-bold text-lg text-blue-600">R$ {Number(viewRideData?.platform_fee).toFixed(2)}</p></div>
                      </div>
                      
                      {/* Avaliação */}
                      {(viewRideData?.driver_rating || viewRideData?.customer_rating) && (
                          <div className="space-y-4">
                              <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500"/> Avaliações</h4>
                              {viewRideData?.driver_rating && (
                                  <div className="flex justify-between items-center text-sm">
                                      <span>Nota para o Motorista:</span>
                                      <div className="flex items-center gap-1"><span className="font-bold">{viewRideData.driver_rating}</span> <Star className="w-3 h-3 fill-yellow-500 text-yellow-500"/></div>
                                  </div>
                              )}
                              {viewRideData?.review_comment && (
                                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm italic text-slate-600 dark:text-slate-300">
                                      "{viewRideData.review_comment}"
                                  </div>
                              )}
                          </div>
                      )}

                      <div className="flex justify-between items-center pt-4 mt-2">
                           <span className="text-xs text-muted-foreground font-mono">ID: {viewRideData?.id}</span>
                           <span className="text-xs font-bold text-slate-400">{viewRideData ? new Date(viewRideData.created_at).toLocaleString() : ''}</span>
                      </div>
                  </div>
              </div>
              <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-800 border-t">
                  <Button className="w-full h-12 rounded-xl font-bold bg-slate-900 text-white" onClick={() => setViewRideData(null)}>Fechar Detalhes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;