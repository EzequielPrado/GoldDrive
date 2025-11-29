import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  CheckCircle, TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, BellRing, Save, AlertTriangle, Smartphone, Globe,
  Menu, Download
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
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';
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
  const [financeData, setFinanceData] = useState<any[]>([]);

  // Estados de Gerenciamento
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ first_name: "", last_name: "", phone: "" });

  // Configurações
  const [config, setConfig] = useState({ platformFee: "20" });

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
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            setAdminProfile(data);
            if (data?.role !== 'admin') { showError("Acesso restrito."); navigate('/'); return; }
        }

        // 1. Corridas (Sem joins complexos iniciais para evitar erro RLS)
        const { data: ridesData } = await supabase.from('rides').select('*').order('created_at', { ascending: false });
        const currentRides = ridesData || [];

        // Enriquecer dados de corrida sob demanda na UI, ou pegar o basico agora
        // Para a tabela, precisamos de nomes. Vamos pegar profiles separados e mapear no frontend.
        // Isso é MUITO mais rápido e evita problemas de RLS em JOINs.
        const { data: allProfiles } = await supabase.from('profiles').select('*');
        const profilesMap = new Map(allProfiles?.map(p => [p.id, p]) || []);

        const enrichedRides = currentRides.map(r => ({
            ...r,
            customer: profilesMap.get(r.customer_id),
            driver: r.driver_id ? profilesMap.get(r.driver_id) : null
        }));
        setRides(enrichedRides);

        setPassengers(allProfiles?.filter(p => p.role === 'client') || []);
        setDrivers(allProfiles?.filter(p => p.role === 'driver') || []);

        // Stats
        const totalRev = currentRides.filter(r => r.status === 'COMPLETED').reduce((acc, r) => acc + Number(r.price), 0);
        const adminRev = currentRides.reduce((acc, r) => acc + Number(r.platform_fee || 0), 0);
        
        setStats({
            revenue: totalRev,
            adminRevenue: adminRev,
            ridesToday: currentRides.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
            activeRides: currentRides.filter(r => ['SEARCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(r.status)).length
        });

        // Charts Data
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
        }).reverse();

        const chart = last7Days.map(date => {
             const dayTotal = currentRides
                .filter(r => r.status === 'COMPLETED' && new Date(r.created_at).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) === date)
                .reduce((acc, r) => acc + Number(r.price), 0);
             return { date, total: dayTotal };
        });
        setChartData(chart);

        // Finance Data (Bar Chart)
        setFinanceData([
            { name: 'Receita Bruta', value: totalRev, fill: '#22c55e' },
            { name: 'Pagos a Motoristas', value: totalRev - adminRev, fill: '#3b82f6' },
            { name: 'Lucro Líquido', value: adminRev, fill: '#eab308' },
        ]);

        // Transactions
        const { data: trans } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(20);
        setTransactions(trans?.map(t => ({...t, user_name: profilesMap.get(t.user_id)?.first_name || 'Usuário'})) || []);

    } catch (e: any) {
        console.error(e);
        // Não mostrar erro na tela se for apenas detalhe, pra não assustar
    } finally {
        setLoading(false);
    }
  };

  // --- ACTIONS ---

  const openEditUser = (user: any) => { setSelectedUser(user); setEditFormData({ first_name: user.first_name || "", last_name: user.last_name || "", phone: user.phone || "" }); setIsEditDialogOpen(true); };
  const handleSaveUser = async () => { if(!selectedUser) return; await supabase.from('profiles').update(editFormData).eq('id', selectedUser.id); showSuccess("Salvo!"); setIsEditDialogOpen(false); fetchData(); };
  const openDeleteUser = (user: any) => { setSelectedUser(user); setIsDeleteDialogOpen(true); };
  const handleDeleteUser = async () => { if(!selectedUser) return; await supabase.from('profiles').delete().eq('id', selectedUser.id); showSuccess("Deletado!"); setIsDeleteDialogOpen(false); fetchData(); };
  const handleResetPassword = async (email: string) => { await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/update-password' }); showSuccess("Email enviado!"); };
  const handleSaveConfig = () => { showSuccess("Configurações salvas!"); };

  // --- SUB-COMPONENTS ---
  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
      <Card className="border-0 shadow-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
          <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground uppercase">{title}</p><h3 className="text-3xl font-black mt-1">{value}</h3></div>
              <div className={`p-4 rounded-2xl ${colorClass} bg-opacity-10 text-white`}><Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} /></div>
          </CardContent>
      </Card>
  );

  const UserTable = ({ data, type }: any) => {
      const filtered = data.filter((u:any) => (u.first_name?.toLowerCase()||'').includes(searchTerm.toLowerCase()));
      return (
          <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/40 p-4 rounded-2xl"><h2 className="font-bold text-xl">{type === 'client' ? 'Passageiros' : 'Motoristas'}</h2><div className="relative w-64"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><Input placeholder="Buscar..." className="pl-9 bg-white" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div></div>
              <Card className="border-0 shadow-xl overflow-hidden rounded-[32px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
                  <Table><TableHeader><TableRow><TableHead className="pl-6">Nome</TableHead><TableHead>Email</TableHead><TableHead>Saldo</TableHead><TableHead className="text-right pr-6">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>{filtered.map((u:any) => (<TableRow key={u.id}><TableCell className="pl-6 font-bold flex items-center gap-3"><Avatar><AvatarImage src={u.avatar_url}/><AvatarFallback>{u.first_name?.[0]}</AvatarFallback></Avatar>{u.first_name} {u.last_name}</TableCell><TableCell>{u.email}</TableCell><TableCell className="font-bold text-green-600">R$ {u.balance?.toFixed(2)}</TableCell><TableCell className="text-right pr-6"><Button variant="ghost" size="sm" onClick={()=>openEditUser(u)}><Edit className="w-4 h-4 text-blue-500"/></Button><Button variant="ghost" size="sm" onClick={()=>openDeleteUser(u)}><Trash2 className="w-4 h-4 text-red-500"/></Button></TableCell></TableRow>))}</TableBody></Table>
              </Card>
          </div>
      );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className={`hidden lg:flex flex-col z-20 border-r bg-white/80 dark:bg-slate-900/80 backdrop-blur-md ${sidebarCollapsed ? 'w-20' : 'w-72'} transition-all`}>
         <div className="p-6 flex justify-between items-center">{!sidebarCollapsed && <span className="font-black text-2xl">Gold<span className="text-yellow-500">Admin</span></span>}<Button variant="ghost" size="icon" onClick={()=>setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen/> : <PanelLeftClose/>}</Button></div>
         <nav className="flex-1 px-4 space-y-2 mt-4">{[{id:'overview', l:'Dashboard', i:LayoutDashboard}, {id:'rides', l:'Corridas', i:MapIcon}, {id:'users', l:'Passageiros', i:Users}, {id:'drivers', l:'Motoristas', i:Car}, {id:'finance', l:'Financeiro', i:Wallet}, {id:'config', l:'Configurações', i:Settings}].map(x=>(<button key={x.id} onClick={()=>setActiveTab(x.id)} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab===x.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-100 text-gray-500'} ${sidebarCollapsed ? 'justify-center px-2':''}`}><x.i className="w-5 h-5"/>{!sidebarCollapsed && x.l}</button>))}</nav>
         <div className="p-4"><div className="flex items-center gap-3 p-3 bg-slate-100 rounded-2xl"><Avatar><AvatarFallback>AD</AvatarFallback></Avatar>{!sidebarCollapsed && <div className="flex-1 overflow-hidden"><p className="font-bold text-sm truncate">Admin</p><p className="text-xs text-gray-500">Online</p></div>}</div></div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                  <div className="flex justify-between items-center">
                      <div><h1 className="text-4xl font-black capitalize">{activeTab}</h1><p className="text-gray-500">Gestão completa da plataforma.</p></div>
                      <div className="flex gap-2"><Button variant="outline" onClick={fetchData} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading?'animate-spin':''}`}/> Atualizar</Button><Button variant="destructive" onClick={()=>navigate('/')}><LogOut className="w-4 h-4 mr-2"/> Sair</Button></div>
                  </div>

                  {activeTab === 'overview' && (
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <StatCard title="Receita Total" value={`R$ ${stats.revenue.toLocaleString('pt-BR',{minimumFractionDigits:2})}`} icon={DollarSign} colorClass="bg-green-500" />
                              <StatCard title="Lucro Líquido" value={`R$ ${stats.adminRevenue.toLocaleString('pt-BR',{minimumFractionDigits:2})}`} icon={Wallet} colorClass="bg-blue-500" />
                              <StatCard title="Corridas Hoje" value={stats.ridesToday} icon={TrendingUp} colorClass="bg-red-500" />
                              <StatCard title="Usuários Ativos" value={passengers.length + drivers.length} icon={Users} colorClass="bg-yellow-500" />
                          </div>
                          <Card className="border-0 shadow-xl bg-white/60 rounded-[32px] p-6 h-[400px]">
                              <CardTitle className="mb-6">Crescimento de Receita</CardTitle>
                              <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/><stop offset="95%" stopColor="#eab308" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={0.1}/><XAxis dataKey="date"/><YAxis/><Tooltip/><Area type="monotone" dataKey="total" stroke="#eab308" fill="url(#colorTotal)"/></AreaChart></ResponsiveContainer>
                          </Card>
                      </div>
                  )}

                  {activeTab === 'rides' && (
                      <Card className="border-0 shadow-xl bg-white/60 rounded-[32px] overflow-hidden">
                          <CardHeader><CardTitle>Monitoramento de Corridas</CardTitle></CardHeader>
                          <CardContent className="p-0">
                              <Table><TableHeader><TableRow><TableHead className="pl-6">ID</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-6">Valor</TableHead></TableRow></TableHeader>
                              <TableBody>{rides.map((r:any)=>(<TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={()=>setSelectedRide(r)}><TableCell className="pl-6 font-mono text-xs text-gray-400">#{r.id.slice(0,6)}</TableCell><TableCell className="font-bold">{r.customer?.first_name || 'N/A'}</TableCell><TableCell>{r.driver?.first_name || '-'}</TableCell><TableCell><Badge>{r.status}</Badge></TableCell><TableCell className="text-right pr-6 font-bold">R$ {Number(r.price).toFixed(2)}</TableCell></TableRow>))}</TableBody></Table>
                          </CardContent>
                      </Card>
                  )}

                  {activeTab === 'users' && <UserTable data={passengers} type="client" />}
                  {activeTab === 'drivers' && <UserTable data={drivers} type="driver" />}

                  {activeTab === 'finance' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom">
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                               <div className="bg-slate-900 text-white rounded-[32px] p-10 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                                   <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full blur-[100px] opacity-20"/>
                                   <div className="relative z-10 flex justify-between items-start"><CreditCard className="w-12 h-12 text-yellow-500"/><span className="font-mono opacity-50">GOLD ADMIN</span></div>
                                   <div className="relative z-10 space-y-1"><p className="text-sm font-bold uppercase text-gray-400">Saldo Consolidado</p><h2 className="text-6xl font-black">R$ {stats.adminRevenue.toLocaleString('pt-BR',{minimumFractionDigits:2})}</h2></div>
                                   <div className="relative z-10 pt-8 border-t border-white/10 mt-8 flex justify-between items-center"><div><p className="text-xs uppercase font-bold text-gray-500">Status</p><p className="font-bold text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Operacional</p></div><Button className="bg-white text-black hover:bg-gray-200 rounded-xl font-bold">Solicitar Saque</Button></div>
                               </div>
                               
                               <Card className="border-0 shadow-xl bg-white/60 rounded-[32px] p-6">
                                   <CardTitle className="mb-6">Distribuição Financeira</CardTitle>
                                   <ResponsiveContainer width="100%" height={250}><BarChart data={financeData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1}/><XAxis type="number"/><YAxis dataKey="name" type="category" width={120}/><Tooltip/><Bar dataKey="value" fill="#8884d8" radius={[0, 10, 10, 0]} barSize={40}/></BarChart></ResponsiveContainer>
                               </Card>
                           </div>

                           <Card className="border-0 shadow-xl bg-white/60 rounded-[32px] overflow-hidden">
                               <CardHeader><CardTitle>Extrato de Transações</CardTitle></CardHeader>
                               <CardContent className="p-0">
                                   <Table><TableHeader><TableRow><TableHead className="pl-6">Descrição</TableHead><TableHead>Usuário</TableHead><TableHead>Data</TableHead><TableHead className="text-right pr-6">Valor</TableHead></TableRow></TableHeader>
                                   <TableBody>{transactions.map((t:any, i)=>(<TableRow key={i}><TableCell className="pl-6 font-bold">{t.description}</TableCell><TableCell>{t.user_name}</TableCell><TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell><TableCell className="text-right pr-6 font-black text-green-600">+ R$ {t.amount.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table>
                               </CardContent>
                           </Card>
                      </div>
                  )}

                  {activeTab === 'config' && (
                      <Card className="border-0 shadow-xl bg-white/60 rounded-[32px] max-w-lg">
                          <CardHeader><CardTitle>Configurações Globais</CardTitle></CardHeader>
                          <CardContent className="space-y-4">
                              <div><Label>Taxa da Plataforma (%)</Label><Input type="number" value={config.platformFee} onChange={e=>setConfig({...config, platformFee:e.target.value})} className="h-12 rounded-xl mt-1"/></div>
                              <Button onClick={handleSaveConfig} className="w-full h-12 bg-black rounded-xl font-bold">Salvar Parâmetros</Button>
                          </CardContent>
                      </Card>
                  )}
              </div>
          </div>
      </main>

      {/* Modals */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader><div className="space-y-4 py-4"><Input value={editFormData.first_name} onChange={e=>setEditFormData({...editFormData, first_name:e.target.value})} placeholder="Nome"/><Input value={editFormData.last_name} onChange={e=>setEditFormData({...editFormData, last_name:e.target.value})} placeholder="Sobrenome"/><Input value={editFormData.phone} onChange={e=>setEditFormData({...editFormData, phone:e.target.value})} placeholder="Telefone"/></div><DialogFooter><Button onClick={handleSaveUser}>Salvar</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-red-600">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={!!selectedRide} onOpenChange={o=>!o&&setSelectedRide(null)}><DialogContent className="rounded-[32px]"><DialogHeader><DialogTitle>Detalhes da Corrida</DialogTitle></DialogHeader><div className="py-4 space-y-4"><div><p className="text-xs font-bold text-gray-400">ORIGEM</p><p className="font-bold">{selectedRide?.pickup_address}</p></div><div><p className="text-xs font-bold text-gray-400">DESTINO</p><p className="font-bold">{selectedRide?.destination_address}</p></div><div className="flex justify-between border-t pt-4"><p>Horário</p><p className="font-bold">{selectedRide ? new Date(selectedRide.created_at).toLocaleString() : ''}</p></div></div></DialogContent></Dialog>
    </div>
  );
};

export default AdminDashboard;