import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  CheckCircle, TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, BellRing, Save, AlertTriangle, Smartphone, Globe,
  Menu, Banknote, FileText, Check, X, ExternalLink, Camera, User,
  Moon as MoonIcon, List, Plus, Power, Pencil
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reviewDriver, setReviewDriver] = useState<any>(null);
  const [justApproved, setJustApproved] = useState(false);
  const [editFormData, setEditFormData] = useState({ first_name: "", last_name: "", phone: "" });

  // Configurações
  const [config, setConfig] = useState({
      platformFee: "20",
      enableCash: true,
      enableWallet: true,
  });
  
  // Tabela de Preços, Configs Avançadas e Categorias
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [adminConfigs, setAdminConfigs] = useState({
      night_start: "21:00",
      night_end: "00:00",
      night_increase: "3",
      midnight_min_price: "25"
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
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            setAdminProfile(data);
            if (data?.role !== 'admin') {
                showError("Acesso restrito.");
                navigate('/');
                return;
            }
        }

        // 1. Buscar Corridas
        const { data: ridesData, error: rideError } = await supabase
            .from('rides')
            .select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`)
            .order('created_at', { ascending: false });

        if (rideError) throw rideError;
        const currentRides = ridesData || [];
        setRides(currentRides);

        // 2. Buscar Perfis
        const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        const allProfiles = profilesData || [];
        setPassengers(allProfiles.filter((p: any) => p.role === 'client'));
        const allDrivers = allProfiles.filter((p: any) => p.role === 'driver');
        setDrivers(allDrivers);
        setPendingDrivers(allDrivers.filter((p: any) => p.driver_status === 'PENDING'));

        // 3. Buscar Configurações Básicas (App Settings)
        const { data: settingsData } = await supabase.from('app_settings').select('*');
        if (settingsData) {
            const cash = settingsData.find(s => s.key === 'enable_cash');
            const wallet = settingsData.find(s => s.key === 'enable_wallet');
            setConfig(prev => ({ ...prev, enableCash: cash ? cash.value : true, enableWallet: wallet ? wallet.value : true }));
        }

        // 4. Buscar Tabela de Preços, Configs Admin e Categorias
        const { data: pricingData } = await supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true });
        if (pricingData) setPricingTiers(pricingData);

        const { data: categoriesData } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });
        if (categoriesData) setCategories(categoriesData);

        const { data: adminConfigData } = await supabase.from('admin_config').select('*');
        if (adminConfigData) {
            const newConf: any = {};
            adminConfigData.forEach((item: any) => newConf[item.key] = item.value);
            setAdminConfigs(prev => ({ ...prev, ...newConf }));
        }

        // 5. Calcular Estatísticas
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
        setStats({ revenue: totalRevenue, adminRevenue: adminRev, ridesToday: ridesTodayCount, activeRides: activeCount });
        
        const recentTrans = currentRides.slice(0, 15).map(r => ({
            id: r.id, date: r.created_at, amount: Number(r.platform_fee || 0), description: `Taxa Corrida #${r.id.substring(0,4)}`, status: 'completed', user: r.driver?.first_name || 'Motorista'
        }));
        setTransactions(recentTrans);

    } catch (e: any) {
        showError("Erro ao carregar: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try { await supabase.auth.signOut({ scope: 'global' }); setAdminProfile(null); navigate('/login/admin', { replace: true }); } catch (error) { showError('Erro ao fazer logout'); } finally { setLoading(false); }
  };

  // --- ACTIONS DE GESTÃO ---
  const handleSaveUser = async () => { if (!selectedUser) return; try { const { error } = await supabase.from('profiles').update(editFormData).eq('id', selectedUser.id); if (error) throw error; showSuccess("Usuário atualizado!"); setIsEditDialogOpen(false); fetchData(); } catch (e: any) { showError(e.message); } };
  const handleDeleteUser = async () => { if (!selectedUser) return; try { const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id); if (error) throw error; showSuccess("Perfil removido do sistema."); setIsDeleteDialogOpen(false); fetchData(); } catch (e: any) { showError(e.message); } };
  const handleResetPassword = async (email: string) => { try { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/update-password' }); if (error) throw error; showSuccess(`Email de redefinição enviado para ${email}`); } catch (e: any) { showError(e.message); } };
  
  const handleSaveConfig = async () => {
      setLoading(true);
      try { 
          // Salva Configs Básicas
          await supabase.from('app_settings').upsert([ { key: 'enable_cash', value: config.enableCash }, { key: 'enable_wallet', value: config.enableWallet } ]);
          
          // Salva Configs Admin (Horários e Taxas)
          const adminConfigUpdates = Object.entries(adminConfigs).map(([key, value]) => ({ key, value }));
          await supabase.from('admin_config').upsert(adminConfigUpdates);

          // Salva Tabela de Preços
          for (const tier of pricingTiers) {
              await supabase.from('pricing_tiers').update({ price: tier.price, label: tier.label }).eq('id', tier.id);
          }

          // Salva Categorias (Nome e Ativo)
          for (const cat of categories) {
              await supabase.from('car_categories').update({ name: cat.name, active: cat.active }).eq('id', cat.id);
          }

          showSuccess("Todas as configurações foram salvas!"); 
      } catch (e: any) { 
          showError(e.message); 
      } finally { 
          setLoading(false); 
      }
  };

  const updatePriceTier = (id: string, field: string, value: any) => {
      setPricingTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const updateCategory = (id: string, field: string, value: any) => {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // --- APPROVAL LOGIC ---
  const openReview = (driver: any) => { setReviewDriver(driver); setJustApproved(false); };
  const sendWhatsAppNotice = (driver: any) => {
      if (driver.phone) {
          const cleanPhone = driver.phone.replace(/\D/g, ''); 
          const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
          const message = encodeURIComponent(`Olá ${driver.first_name}! 🚗💨\n\nSua conta de motorista na GoldDrive foi *APROVADA* com sucesso! 🎉\n\nVocê já pode acessar o aplicativo e começar a aceitar corridas.\n\nBoas viagens!\nEquipe GoldDrive`);
          window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
      } else { showError("Motorista sem telefone cadastrado."); }
  };
  
  const approveDriver = async (driver: any) => {
      try { 
          // O banco agora deve ter a política correta
          const { error } = await supabase.from('profiles').update({ driver_status: 'APPROVED' }).eq('id', driver.id); 
          if (error) throw error; 
          showSuccess(`${driver.first_name} foi aprovado!`); 
          setJustApproved(true); 
          fetchData(); 
      } catch (e: any) { 
          showError("Erro ao aprovar: " + e.message); 
      }
  };
  
  const rejectDriver = async (driver: any) => {
      try { 
          const { error } = await supabase.from('profiles').update({ driver_status: 'REJECTED' }).eq('id', driver.id); 
          if (error) throw error; 
          showSuccess("Motorista reprovado."); 
          setReviewDriver(null); 
          fetchData(); 
      } catch (e: any) { 
          showError(e.message); 
      }
  };

  // ... (UI Components Mantidos - StatCard, UserManagementTable)
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
      const filtered = data.filter(u => (u.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
      return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row justify-between items-center bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl backdrop-blur-md gap-4">
                   <div className="flex gap-4 text-sm font-bold text-muted-foreground w-full md:w-auto"><div className="flex items-center gap-2"><Users className="w-4 h-4"/> Total: <span className="text-foreground">{data.length}</span></div></div>
                   <div className="relative w-full md:w-64"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9 bg-white/50 dark:bg-slate-900/50 border-0 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
              </div>
              <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                  <CardHeader><CardTitle>Gerenciar {type === 'client' ? 'Passageiros' : 'Motoristas'}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                      {loading ? <div className="p-10 text-center flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-yellow-500" /></div> : filtered.length === 0 ? <div className="p-10 text-center text-muted-foreground"><p>Nenhum usuário.</p></div> : (
                          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                              <Table><TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md"><TableRow><TableHead className="pl-8">Usuário</TableHead><TableHead>Contato</TableHead>{type === 'driver' && <TableHead>Status</TableHead>}<TableHead>Saldo</TableHead><TableHead className="text-right pr-8">Ações</TableHead></TableRow></TableHeader>
                                  <TableBody>{filtered.map(u => (
                                          <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50">
                                              <TableCell className="pl-8"><div className="flex items-center gap-3"><Avatar className="w-10 h-10 border-2 border-white shadow-sm"><AvatarImage src={u.avatar_url}/><AvatarFallback>{u.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-sm">{u.first_name} {u.last_name}</p><p className="text-xs text-muted-foreground">ID: {u.id.substring(0,6)}</p></div></div></TableCell>
                                              <TableCell><div className="text-sm"><p>{u.email}</p><p className="text-muted-foreground text-xs">{u.phone || 'Sem telefone'}</p></div></TableCell>
                                              {type === 'driver' && <TableCell><Badge variant="secondary" className={u.driver_status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>{u.driver_status}</Badge></TableCell>}
                                              <TableCell className="font-bold text-green-600">R$ {u.balance?.toFixed(2)}</TableCell>
                                              <TableCell className="text-right pr-8"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => { setSelectedUser(u); setEditFormData({ first_name: u.first_name, last_name: u.last_name, phone: u.phone }); setIsEditDialogOpen(true); }}><Edit className="w-4 h-4 text-blue-500" /></Button><Button variant="ghost" size="icon" onClick={() => handleResetPassword(u.email)}><Mail className="w-4 h-4 text-yellow-500" /></Button><Button variant="ghost" size="icon" onClick={() => { setSelectedUser(u); setIsDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4 text-red-500" /></Button></div></TableCell>
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
         {/* ... (Sidebar igual) ... */}
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
                 { id: 'requests', label: 'Solicitações', icon: FileText, badge: pendingDrivers.length },
                 { id: 'rides', label: 'Corridas', icon: MapIcon },
                 { id: 'users', label: 'Passageiros', icon: Users },
                 { id: 'drivers', label: 'Motoristas', icon: Car },
                 { id: 'finance', label: 'Financeiro', icon: Wallet },
                 { id: 'config', label: 'Configurações', icon: Settings },
             ].map(item => (
                 <button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 group overflow-hidden ${activeTab === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-lg shadow-slate-900/20' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground'} ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
                     <item.icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-yellow-500' : ''}`} />
                     {!sidebarCollapsed && <span>{item.label}</span>}
                     {item.badge ? (
                        <div className={`ml-auto ${sidebarCollapsed ? 'absolute top-2 right-2' : ''}`}>
                            <Badge className="bg-red-500 text-white hover:bg-red-600 border-0">{item.badge}</Badge>
                        </div>
                     ) : null}
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
               <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger><SheetContent side="left" className="p-0 border-r-0 bg-slate-900 text-white w-72"><div className="p-6 font-black text-2xl">Menu</div><div className="px-4 space-y-2">{['overview', 'requests', 'rides', 'users', 'drivers', 'finance', 'config'].map(id => (<Button key={id} variant="ghost" className="w-full justify-start text-lg capitalize h-14 rounded-xl" onClick={() => setActiveTab(id)}>{id}</Button>))}</div></SheetContent></Sheet>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                  
                  {/* Header da Página */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                      <div><h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white capitalize mb-1">{activeTab === 'requests' ? 'Solicitações' : activeTab}</h1><p className="text-muted-foreground">Bem-vindo ao painel de controle.</p></div>
                      <div className="flex gap-3"><Button variant="outline" className="rounded-xl h-12" onClick={fetchData}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button><Button variant="destructive" className="rounded-xl h-12 font-bold px-6 shadow-red-500/20 shadow-lg" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" /> Sair</Button></div>
                  </div>

                  {/* ... (TABS OVERVIEW, REQUESTS, RIDES, USERS, FINANCE permanecem iguais, apenas config muda) ... */}
                  {activeTab === 'overview' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                          {/* Stats Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <StatCard title="Receita Total" value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} colorClass="bg-green-500" subtext="+12% esse mês" />
                              <StatCard title="Lucro Plataforma" value={`R$ ${stats.adminRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} colorClass="bg-blue-500" subtext="20% taxa" />
                              <StatCard title="Corridas Hoje" value={stats.ridesToday} icon={TrendingUp} colorClass="bg-red-500" subtext="Últimas 24h" />
                              <StatCard title="Pendências" value={pendingDrivers.length} icon={FileText} colorClass="bg-orange-500" subtext="Aguardando Análise" />
                          </div>
                          {/* Charts Row */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              <Card className="lg:col-span-2 border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                                  <CardHeader><CardTitle>Fluxo de Receita</CardTitle><CardDescription>Últimos 7 dias</CardDescription></CardHeader>
                                  <CardContent className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/><stop offset="95%" stopColor="#eab308" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} stroke="#888" dy={10} /><YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#888" tickFormatter={(v) => `R$${v}`} /><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} itemStyle={{ color: '#fbbf24' }} formatter={(val: number) => [`R$ ${val.toFixed(2)}`, 'Receita']} /><Area type="monotone" dataKey="total" stroke="#eab308" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" /></AreaChart></ResponsiveContainer></CardContent>
                              </Card>
                              <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                      <Card className="border-0 shadow-lg bg-indigo-500 text-white rounded-[24px] overflow-hidden relative h-40">
                                          <div className="absolute -right-4 -bottom-4 opacity-20"><Users className="w-24 h-24" /></div>
                                          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10"><p className="font-bold text-sm uppercase opacity-80">Passageiros</p><h3 className="text-3xl font-black">{passengers.length}</h3></CardContent>
                                      </Card>
                                      <Card className="border-0 shadow-lg bg-orange-500 text-white rounded-[24px] overflow-hidden relative h-40">
                                          <div className="absolute -right-4 -bottom-4 opacity-20"><Car className="w-24 h-24" /></div>
                                          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10"><p className="font-bold text-sm uppercase opacity-80">Motoristas</p><h3 className="text-3xl font-black">{drivers.length}</h3></CardContent>
                                      </Card>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeTab === 'requests' && (
                    <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                        <CardHeader className="flex flex-row items-center justify-between px-8 pt-8"><div><CardTitle className="text-2xl flex items-center gap-2"><FileText className="w-6 h-6 text-yellow-500" /> Solicitações Pendentes</CardTitle><CardDescription>Motoristas aguardando aprovação de documentos.</CardDescription></div><Badge className="text-lg px-4 py-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-0">{pendingDrivers.length} Pendentes</Badge></CardHeader>
                        <CardContent className="p-0">
                            {pendingDrivers.length === 0 ? <div className="p-16 text-center"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-10 h-10 text-green-600" /></div><h3 className="text-xl font-bold text-slate-900 dark:text-white">Tudo limpo!</h3><p className="text-muted-foreground">Não há novas solicitações de motoristas no momento.</p></div> : 
                                <Table><TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">Motorista</TableHead><TableHead>Veículo</TableHead><TableHead>Data Cadastro</TableHead><TableHead className="text-right pr-8">Ação</TableHead></TableRow></TableHeader>
                                    <TableBody>{pendingDrivers.map(driver => (
                                            <TableRow key={driver.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50">
                                                <TableCell className="pl-8"><div className="flex items-center gap-3"><Avatar className="w-10 h-10 border-2 border-white shadow-sm"><AvatarImage src={driver.avatar_url} /><AvatarFallback>{driver.first_name[0]}</AvatarFallback></Avatar><div><p className="font-bold text-sm">{driver.first_name} {driver.last_name}</p><p className="text-xs text-muted-foreground flex items-center gap-1"><Smartphone className="w-3 h-3" /> {driver.phone}</p></div></div></TableCell>
                                                <TableCell><Badge variant="outline" className="font-mono">{driver.car_model || 'N/A'} • {driver.car_plate}</Badge></TableCell>
                                                <TableCell className="text-muted-foreground">{new Date(driver.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right pr-8"><Button onClick={() => openReview(driver)} className="bg-slate-900 text-white hover:bg-black font-bold h-10 px-6 rounded-xl shadow-lg shadow-slate-900/10">Analisar</Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            }
                        </CardContent>
                    </Card>
                  )}

                  {activeTab === 'rides' && <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-8"><CardHeader className="flex flex-row items-center justify-between px-8 pt-8"><div><CardTitle className="text-2xl">Gerenciamento de Corridas</CardTitle><CardDescription>Total de {rides.length} corridas</CardDescription></div><div className="flex items-center gap-3"><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[180px] h-10 rounded-xl bg-white dark:bg-slate-800"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos os Status</SelectItem><SelectItem value="COMPLETED">Finalizadas</SelectItem><SelectItem value="CANCELLED">Canceladas</SelectItem><SelectItem value="IN_PROGRESS">Em Andamento</SelectItem></SelectContent></Select></div></CardHeader><CardContent className="p-0"><Table><TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">ID</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Data/Hora</TableHead><TableHead>Status</TableHead><TableHead>Taxa (Lucro)</TableHead><TableHead className="text-right pr-8">Valor Total</TableHead></TableRow></TableHeader><TableBody>{rides.filter(r => filterStatus === 'ALL' ? true : r.status === filterStatus).map(r => (<TableRow key={r.id} onClick={()=>setSelectedRide(r)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-border/50"><TableCell className="pl-8 font-mono text-xs opacity-50">#{r.id.substring(0,8)}</TableCell><TableCell><div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.customer?.avatar_url}/><AvatarFallback>{r.customer?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-medium">{r.customer?.first_name || 'Usuário'}</span></div></TableCell><TableCell>{r.driver ? <div className="flex items-center gap-3"><Avatar className="w-8 h-8"><AvatarImage src={r.driver?.avatar_url}/><AvatarFallback>{r.driver?.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{r.driver.first_name}</p></div></div> : <span className="text-muted-foreground text-sm italic">--</span>}</TableCell><TableCell><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</span></TableCell><TableCell><Badge className={`rounded-lg px-3 py-1 ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : r.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.status}</Badge></TableCell><TableCell className="font-bold text-green-600">R$ {Number(r.platform_fee || 0).toFixed(2)}</TableCell><TableCell className="text-right pr-8 font-bold text-base">R$ {Number(r.price).toFixed(2)}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>}
                  {activeTab === 'users' && <UserManagementTable data={passengers} type="client" />}
                  {activeTab === 'drivers' && <UserManagementTable data={drivers} type="driver" />}
                  {activeTab === 'finance' && <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="bg-slate-900 text-white rounded-[32px] p-8 shadow-2xl relative overflow-hidden h-64 flex flex-col justify-between group hover:scale-[1.01] transition-transform"><div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-full blur-[80px]" /><div className="relative z-10 flex justify-between items-start"><CreditCard className="w-10 h-10 text-yellow-500" /><span className="font-mono text-sm opacity-60">GOLD PLATFORM</span></div><div className="relative z-10"><p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1">Saldo Disponível</p><h2 className="text-5xl font-black tracking-tight">R$ {stats.adminRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2></div><div className="relative z-10 flex justify-between items-end"><div><p className="text-xs text-slate-500 uppercase font-bold">Titular</p><p className="font-bold">ADMINISTRADOR</p></div><div className="flex gap-2"><div className="w-8 h-8 rounded-full bg-red-500/80" /><div className="w-8 h-8 rounded-full bg-yellow-500/80 -ml-4" /></div></div></div></div><Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden"><CardHeader><CardTitle>Histórico de Transações</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader className="bg-slate-50/50 dark:bg-slate-800/50"><TableRow><TableHead className="pl-8">Descrição</TableHead><TableHead>Usuário</TableHead><TableHead>Data</TableHead><TableHead className="text-right pr-8">Valor</TableHead></TableRow></TableHeader><TableBody>{transactions.map((t, i) => (<TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-border/50"><TableCell className="pl-8 font-bold">{t.description}</TableCell><TableCell>{t.user}</TableCell><TableCell className="text-muted-foreground">{new Date(t.date).toLocaleDateString()}</TableCell><TableCell className="text-right pr-8 font-black text-green-600">+ R$ {t.amount.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card></div>}

                  {/* --- TAB: CONFIGURAÇÕES (NOVO LAYOUT) --- */}
                  {activeTab === 'config' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
                          <Tabs defaultValue="general" className="w-full">
                              <TabsList className="bg-slate-200 dark:bg-slate-800 rounded-xl p-1 mb-6">
                                  <TabsTrigger value="general" className="rounded-lg">Geral</TabsTrigger>
                                  <TabsTrigger value="values" className="rounded-lg">Valores & Tabela</TabsTrigger>
                                  <TabsTrigger value="categories" className="rounded-lg">Categorias</TabsTrigger>
                              </TabsList>

                              <TabsContent value="general">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                      <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] h-fit">
                                          <CardHeader>
                                              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações Gerais</CardTitle>
                                              <CardDescription>Parâmetros globais da plataforma.</CardDescription>
                                          </CardHeader>
                                          <CardContent className="space-y-6">
                                              <div className="space-y-2">
                                                  <Label>Taxa da Plataforma (%)</Label>
                                                  <div className="flex gap-2 items-center">
                                                      <Input type="number" value={config.platformFee} onChange={e => setConfig({...config, platformFee: e.target.value})} className="rounded-xl h-12" />
                                                      <span className="text-muted-foreground font-bold">%</span>
                                                  </div>
                                              </div>
                                              <Separator />
                                              <div className="space-y-4">
                                                  <div className="flex items-center justify-between">
                                                      <div className="space-y-0.5">
                                                          <Label className="text-base font-bold flex items-center gap-2"><Banknote className="w-4 h-4 text-green-600" /> Dinheiro / PIX</Label>
                                                          <p className="text-sm text-muted-foreground">Permitir pagamentos diretos.</p>
                                                      </div>
                                                      <Switch checked={config.enableCash} onCheckedChange={(val) => setConfig({...config, enableCash: val})} />
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                      <div className="space-y-0.5">
                                                          <Label className="text-base font-bold flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-600" /> Carteira Digital</Label>
                                                          <p className="text-sm text-muted-foreground">Permitir uso do saldo do app.</p>
                                                      </div>
                                                      <Switch checked={config.enableWallet} onCheckedChange={(val) => setConfig({...config, enableWallet: val})} />
                                                  </div>
                                              </div>
                                          </CardContent>
                                          <CardFooter>
                                              <Button onClick={handleSaveConfig} disabled={loading} className="w-full h-12 rounded-xl font-bold bg-slate-900 text-white"><Save className="w-4 h-4 mr-2" /> Salvar Tudo</Button>
                                          </CardFooter>
                                      </Card>
                                  </div>
                              </TabsContent>

                              <TabsContent value="values">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                      {/* Coluna Esquerda: Horários e Infos */}
                                      <div className="space-y-6">
                                          <Card className="border-0 shadow-xl bg-slate-900 text-white rounded-[32px] overflow-hidden">
                                              <CardHeader>
                                                  <CardTitle className="flex items-center gap-2 text-yellow-500"><MoonIcon className="w-5 h-5" /> Taxa Noturna</CardTitle>
                                                  <CardDescription className="text-slate-400">Configuração de valores para a noite.</CardDescription>
                                              </CardHeader>
                                              <CardContent className="space-y-4">
                                                  <div className="grid grid-cols-2 gap-4">
                                                      <div className="space-y-2">
                                                          <Label className="text-slate-300">Início (21h)</Label>
                                                          <Input type="time" value={adminConfigs.night_start} onChange={e => setAdminConfigs({...adminConfigs, night_start: e.target.value})} className="bg-slate-800 border-0 text-white rounded-xl" />
                                                      </div>
                                                      <div className="space-y-2">
                                                          <Label className="text-slate-300">Fim (00h)</Label>
                                                          <Input type="time" value={adminConfigs.night_end} onChange={e => setAdminConfigs({...adminConfigs, night_end: e.target.value})} className="bg-slate-800 border-0 text-white rounded-xl" />
                                                      </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-slate-300">Acréscimo no Valor (R$)</Label>
                                                      <Input type="number" value={adminConfigs.night_increase} onChange={e => setAdminConfigs({...adminConfigs, night_increase: e.target.value})} className="bg-slate-800 border-0 text-white rounded-xl font-bold text-lg" />
                                                      <p className="text-xs text-slate-500">Valor somado à tabela normal neste horário.</p>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label className="text-slate-300">Mínima após 00h (R$)</Label>
                                                      <Input type="number" value={adminConfigs.midnight_min_price} onChange={e => setAdminConfigs({...adminConfigs, midnight_min_price: e.target.value})} className="bg-slate-800 border-0 text-white rounded-xl font-bold text-lg" />
                                                      <p className="text-xs text-slate-500">Nenhuma corrida será menor que este valor na madrugada.</p>
                                                  </div>
                                              </CardContent>
                                          </Card>

                                          <Card className="border-0 bg-yellow-100 border-yellow-200 text-yellow-900 rounded-[32px]">
                                              <CardContent className="p-6">
                                                  <h4 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Regras Importantes</h4>
                                                  <ul className="text-sm space-y-2 list-disc list-inside">
                                                      <li>Acima de 8 km o valor é negociado ou calculado livremente.</li>
                                                      <li>Paradas e "Bate e Volta" devem ser combinados no chat.</li>
                                                      <li>Estas configurações afetam o cálculo automático do app para o passageiro.</li>
                                                  </ul>
                                              </CardContent>
                                          </Card>
                                      </div>

                                      {/* Coluna Direita: Tabela de Preços */}
                                      <div className="lg:col-span-2">
                                          <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                                              <CardHeader className="flex flex-row items-center justify-between">
                                                  <div>
                                                      <CardTitle className="flex items-center gap-2"><List className="w-5 h-5" /> Tabela de Preços Fixa</CardTitle>
                                                      <CardDescription>Defina o valor cobrado por distância.</CardDescription>
                                                  </div>
                                                  <Button onClick={handleSaveConfig} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg"><Save className="w-4 h-4 mr-2" /> Salvar Alterações</Button>
                                              </CardHeader>
                                              <CardContent className="p-0">
                                                  <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                                      <Table>
                                                          <TableHeader className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                                                              <TableRow>
                                                                  <TableHead className="pl-6 w-1/2">Faixa de Distância</TableHead>
                                                                  <TableHead className="w-1/4">Valor (R$)</TableHead>
                                                                  <TableHead className="w-1/4"></TableHead>
                                                              </TableRow>
                                                          </TableHeader>
                                                          <TableBody>
                                                              {pricingTiers.map((tier) => (
                                                                  <TableRow key={tier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                      <TableCell className="pl-6">
                                                                          <span className="font-medium">{tier.label}</span>
                                                                      </TableCell>
                                                                      <TableCell>
                                                                          <div className="relative">
                                                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">R$</span>
                                                                              <Input 
                                                                                  type="number" 
                                                                                  value={tier.price} 
                                                                                  onChange={(e) => updatePriceTier(tier.id, 'price', e.target.value)}
                                                                                  className="pl-9 font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                                                                              />
                                                                          </div>
                                                                      </TableCell>
                                                                      <TableCell className="text-xs text-muted-foreground text-right pr-6">
                                                                          <Pencil className="w-4 h-4 opacity-50" />
                                                                      </TableCell>
                                                                  </TableRow>
                                                              ))}
                                                          </TableBody>
                                                      </Table>
                                                  </div>
                                              </CardContent>
                                          </Card>
                                      </div>
                                  </div>
                              </TabsContent>

                              <TabsContent value="categories">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                      <Card className="border-0 shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[32px] overflow-hidden">
                                          <CardHeader className="flex flex-row items-center justify-between">
                                              <div>
                                                  <CardTitle className="flex items-center gap-2"><Car className="w-5 h-5" /> Categorias de Veículos</CardTitle>
                                                  <CardDescription>Ative, desative ou renomeie as categorias.</CardDescription>
                                              </div>
                                              <Button onClick={handleSaveConfig} disabled={loading} className="bg-slate-900 text-white font-bold rounded-xl"><Save className="w-4 h-4 mr-2" /> Salvar</Button>
                                          </CardHeader>
                                          <CardContent className="p-0">
                                              <Table>
                                                  <TableHeader className="bg-slate-100 dark:bg-slate-800"><TableRow><TableHead className="pl-6">Nome da Categoria</TableHead><TableHead className="text-right pr-6">Status</TableHead></TableRow></TableHeader>
                                                  <TableBody>
                                                      {categories.map(cat => (
                                                          <TableRow key={cat.id} className="hover:bg-slate-50">
                                                              <TableCell className="pl-6">
                                                                  <Input value={cat.name} onChange={e => updateCategory(cat.id, 'name', e.target.value)} className="font-bold border-0 bg-transparent focus-visible:ring-0 p-0 h-auto text-base" />
                                                                  <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                                                              </TableCell>
                                                              <TableCell className="text-right pr-6">
                                                                  <div className="flex items-center justify-end gap-2">
                                                                      <span className={`text-xs font-bold ${cat.active ? 'text-green-600' : 'text-slate-400'}`}>{cat.active ? 'ATIVA' : 'INATIVA'}</span>
                                                                      <Switch checked={cat.active} onCheckedChange={(val) => updateCategory(cat.id, 'active', val)} />
                                                                  </div>
                                                              </TableCell>
                                                          </TableRow>
                                                      ))}
                                                  </TableBody>
                                              </Table>
                                          </CardContent>
                                      </Card>
                                  </div>
                              </TabsContent>
                          </Tabs>
                      </div>
                  )}
              </div>
          </div>
      </main>
      
      {/* DIALOG DE ANÁLISE KYC */}
      <Dialog open={!!reviewDriver} onOpenChange={(o) => !o && setReviewDriver(null)}>
        <DialogContent className="max-w-3xl bg-white dark:bg-slate-950 rounded-[32px] border-0 shadow-2xl p-0 overflow-hidden">
            {reviewDriver && (
                <div className="flex flex-col h-[85vh]">
                    {/* Header KYC */}
                    <div className="bg-slate-900 text-white p-6 shrink-0 relative overflow-hidden">
                        {justApproved && (
                             <div className="absolute inset-0 bg-green-600 z-0 flex items-center justify-center animate-in fade-in duration-500">
                                 <div className="absolute inset-0 bg-black/10 pattern-dots" />
                             </div>
                        )}
                        <div className="flex items-center gap-4 relative z-10">
                            <Avatar className="w-16 h-16 border-4 border-white shadow-xl">
                                <AvatarImage src={reviewDriver.face_photo_url || reviewDriver.avatar_url} />
                                <AvatarFallback className="text-black bg-yellow-500 font-bold text-xl">{reviewDriver.first_name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-2xl font-black">{justApproved ? "Motorista Aprovado!" : "Análise de Perfil"}</h2>
                                {justApproved && <span className="font-bold text-white flex items-center gap-2 mt-1"><CheckCircle className="w-4 h-4"/> Acesso liberado no sistema.</span>}
                                {!justApproved && <span className="text-sm text-gray-400">Verifique os dados abaixo com atenção.</span>}
                            </div>
                        </div>
                    </div>

                    {/* Content Scrollable */}
                    <ScrollArea className="flex-1 bg-gray-50 dark:bg-slate-900 p-6">
                        {!justApproved ? (
                            <div className="space-y-6">
                                {/* CARD DE DADOS PESSOAIS */}
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-border/50">
                                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Dados Pessoais
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">Nome Completo</p>
                                            <p className="font-bold truncate" title={`${reviewDriver.first_name} ${reviewDriver.last_name}`}>
                                                {reviewDriver.first_name} {reviewDriver.last_name}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">CPF</p>
                                            <p className="font-bold font-mono">{reviewDriver.cpf}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">Telefone</p>
                                            <p className="font-bold">{reviewDriver.phone}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Veículo Card */}
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-border/50">
                                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2"><Car className="w-4 h-4" /> Dados do Veículo</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">Modelo</p>
                                            <p className="font-bold">{reviewDriver.car_model}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">Placa</p>
                                            <p className="font-bold font-mono uppercase">{reviewDriver.car_plate}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">Cor</p>
                                            <p className="font-bold">{reviewDriver.car_color}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                                            <p className="text-xs text-muted-foreground">Ano</p>
                                            <p className="font-bold">{reviewDriver.car_year}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Fotos e Documentos */}
                                <div>
                                    <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2"><Camera className="w-4 h-4" /> Fotos de Cadastro</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        
                                        {/* Selfie */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold pl-2 text-blue-600">Selfie (Rosto)</p>
                                            <div className="aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-lg border-2 border-blue-100 dark:border-blue-900 relative group cursor-pointer" onClick={() => window.open(reviewDriver.face_photo_url || reviewDriver.avatar_url, '_blank')}>
                                                <img src={reviewDriver.face_photo_url || reviewDriver.avatar_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Selfie" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <ExternalLink className="text-white w-8 h-8" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* CNH Frente */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold pl-2">CNH Frente</p>
                                            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 relative group cursor-pointer" onClick={() => window.open(reviewDriver.cnh_front_url, '_blank')}>
                                                <img src={reviewDriver.cnh_front_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="CNH Frente" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <ExternalLink className="text-white w-8 h-8" />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* CNH Verso */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold pl-2">CNH Verso</p>
                                            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 relative group cursor-pointer" onClick={() => window.open(reviewDriver.cnh_back_url, '_blank')}>
                                                <img src={reviewDriver.cnh_back_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="CNH Verso" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <ExternalLink className="text-white w-8 h-8" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in zoom-in duration-300">
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-green-200 shadow-xl">
                                    <CheckCircle className="w-12 h-12 text-green-600" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">Sucesso!</h2>
                                <p className="text-gray-500 max-w-md mb-8">
                                    O motorista foi aprovado e o acesso ao aplicativo já foi liberado. Envie uma notificação para avisá-lo.
                                </p>
                                <Button 
                                    className="h-16 px-8 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-xl shadow-green-600/20 w-full max-w-sm animate-bounce"
                                    onClick={() => sendWhatsAppNotice(reviewDriver)}
                                >
                                    <Smartphone className="mr-2 w-6 h-6" /> Enviar Aviso no WhatsApp
                                </Button>
                                <Button variant="ghost" className="mt-4" onClick={() => setReviewDriver(null)}>Fechar Janela</Button>
                            </div>
                        )}
                    </ScrollArea>

                    {/* Footer Actions */}
                    {!justApproved && (
                        <div className="p-4 bg-white dark:bg-slate-950 border-t border-border flex gap-3 shrink-0">
                            <Button 
                                variant="destructive" 
                                className="flex-1 h-14 rounded-xl font-bold text-lg" 
                                onClick={() => rejectDriver(reviewDriver)}
                            >
                                <X className="mr-2 w-5 h-5" /> Reprovar
                            </Button>
                            <Button 
                                className="flex-[2] h-14 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-lg shadow-lg" 
                                onClick={() => approveDriver(reviewDriver)}
                            >
                                <Check className="mr-2 w-5 h-5" /> Aprovar Cadastro
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* ... (Outros dialogs iguais) ... */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div><Label>Nome</Label><Input value={editFormData.first_name} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} /></div><div><Label>Sobrenome</Label><Input value={editFormData.last_name} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} /></div><div><Label>Telefone</Label><Input value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div></div><DialogFooter><Button onClick={handleSaveUser}>Salvar Alterações</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Usuário?</AlertDialogTitle><AlertDialogDescription>Isso removerá o perfil do sistema.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} className="bg-red-600">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={!!selectedRide} onOpenChange={(o) => !o && setSelectedRide(null)}><DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-[32px] border-0 shadow-2xl"><DialogHeader><DialogTitle>Detalhes da Corrida</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-1 gap-4"><div><p className="text-xs font-bold text-muted-foreground uppercase">Origem</p><p className="font-medium text-lg">{selectedRide?.pickup_address}</p></div><div><p className="text-xs font-bold text-muted-foreground uppercase">Destino</p><p className="font-medium text-lg">{selectedRide?.destination_address}</p></div></div><div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between"><div className="flex items-center gap-3"><Avatar><AvatarImage src={selectedRide?.driver?.avatar_url} /><AvatarFallback>DR</AvatarFallback></Avatar><div><p className="font-bold">{selectedRide?.driver?.first_name || 'Sem motorista'}</p></div></div><div className="text-right"><p className="text-xs text-muted-foreground uppercase font-bold">Data/Hora</p><p className="font-bold text-sm">{selectedRide ? new Date(selectedRide.created_at).toLocaleString('pt-BR') : '--'}</p></div></div><div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3 border border-border/50"><div className="flex justify-between items-center pb-2 border-b border-border/50"><span className="text-sm text-muted-foreground font-medium">Preço Cobrado</span><span className="font-black text-lg">R$ {Number(selectedRide?.price).toFixed(2)}</span></div><div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Repasse Motorista (80%)</span><span className="font-bold">R$ {Number(selectedRide?.driver_earnings).toFixed(2)}</span></div><div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Taxa Plataforma (20%)</span><span className="font-bold text-green-600">R$ {Number(selectedRide?.platform_fee).toFixed(2)}</span></div>{selectedRide?.payment_method && (<div className="pt-2 flex justify-end"><Badge variant="outline" className="text-xs">{selectedRide.payment_method === 'WALLET' ? 'Pago via Carteira' : 'Pago em Dinheiro'}</Badge></div>)}</div></div></DialogContent></Dialog>
    </div>
  );
};

export default AdminDashboard;