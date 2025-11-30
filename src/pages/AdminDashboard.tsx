import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, RefreshCw, Shield,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, 
  CheckCircle, TrendingUp, Trash2, Edit, Mail, Search,
  CreditCard, BellRing, Save, AlertTriangle, Smartphone, Globe,
  Menu, FileCheck, XCircle, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]); // KYC
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Estados de Gerenciamento (Edit/Delete/KYC)
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isKYCDialogOpen, setIsKYCDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ first_name: "", last_name: "", phone: "" });

  // Configurações
  const [paymentConfig, setPaymentConfig] = useState({ cash: true, wallet: true });
  const [platformFee, setPlatformFee] = useState("20");

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

        // 1. Corridas
        const { data: ridesData } = await supabase.from('rides').select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`);
        setRides(ridesData || []);

        // 2. Perfis
        const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        const allProfiles = profilesData || [];
        setPassengers(allProfiles.filter((p: any) => p.role === 'client'));
        setDrivers(allProfiles.filter((p: any) => p.role === 'driver'));
        setPendingDrivers(allProfiles.filter((p: any) => p.role === 'driver' && p.driver_status === 'PENDING'));

        // 3. Configurações
        const { data: settings } = await supabase.from('app_settings').select('*');
        if(settings) {
            const cash = settings.find(s => s.key === 'payment_cash')?.value ?? true;
            const wallet = settings.find(s => s.key === 'payment_wallet')?.value ?? true;
            setPaymentConfig({ cash, wallet });
        }

        // 4. Stats Básicos
        setStats({
            revenue: (ridesData || []).reduce((acc, r) => acc + (r.status==='COMPLETED' ? Number(r.price) : 0), 0),
            adminRevenue: (ridesData || []).reduce((acc, r) => acc + Number(r.platform_fee || 0), 0),
            ridesToday: (ridesData || []).length, // Simplificado
            activeRides: (ridesData || []).filter(r => ['SEARCHING','IN_PROGRESS'].includes(r.status)).length
        });

    } catch (e: any) {
        showError("Erro ao carregar: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // --- ACTIONS KYC ---
  const handleApproveDriver = async (id: string) => {
      await supabase.from('profiles').update({ driver_status: 'APPROVED' }).eq('id', id);
      showSuccess("Motorista Aprovado!");
      setIsKYCDialogOpen(false);
      fetchData();
  };

  const handleRejectDriver = async (id: string) => {
      await supabase.from('profiles').update({ driver_status: 'REJECTED' }).eq('id', id);
      showError("Motorista Reprovado.");
      setIsKYCDialogOpen(false);
      fetchData();
  };

  // --- ACTIONS CONFIG ---
  const handleSavePaymentConfig = async () => {
      await supabase.from('app_settings').upsert([
          { key: 'payment_cash', value: paymentConfig.cash },
          { key: 'payment_wallet', value: paymentConfig.wallet }
      ]);
      showSuccess("Configurações salvas!");
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />

      {/* --- SIDEBAR --- */}
      <aside className={`hidden lg:flex flex-col z-20 transition-all duration-300 border-r border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
         <div className="p-6 flex items-center justify-between">
             {!sidebarCollapsed && (
                 <div className="flex items-center gap-2 text-2xl font-black tracking-tighter">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><Shield className="w-6 h-6" /></div>
                    <span>Gold<span className="text-yellow-500">Admin</span></span>
                 </div>
             )}
             {sidebarCollapsed && <Shield className="w-6 h-6 mx-auto" />}
             <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto"><PanelLeftClose className="w-5 h-5" /></Button>
         </div>

         <nav className="flex-1 px-4 space-y-2 mt-4">
             {[
                 { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                 { id: 'requests', label: 'Solicitações', icon: FileCheck, badge: pendingDrivers.length },
                 { id: 'rides', label: 'Corridas', icon: MapIcon },
                 { id: 'users', label: 'Passageiros', icon: Users },
                 { id: 'drivers', label: 'Motoristas', icon: Car },
                 { id: 'config', label: 'Configurações', icon: Settings },
             ].map(item => (
                 <button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-100'} ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
                     <item.icon className="w-5 h-5 shrink-0" />
                     {!sidebarCollapsed && <span>{item.label}</span>}
                     {item.badge ? <span className="absolute right-4 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{item.badge}</span> : null}
                 </button>
             ))}
         </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
          <header className="lg:hidden h-16 bg-white/80 border-b px-4 flex items-center justify-between sticky top-0 z-50">
               <div className="font-black text-xl">GoldAdmin</div>
               <Sheet><SheetTrigger><Button variant="ghost"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-72"><div className="p-6 font-black text-2xl">Menu</div><div className="px-4 space-y-2">{['overview', 'requests', 'rides', 'users', 'drivers', 'config'].map(id => (<Button key={id} variant="ghost" className="w-full justify-start text-lg capitalize h-14" onClick={() => setActiveTab(id)}>{id}</Button>))}</div></SheetContent></Sheet>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div><h1 className="text-4xl font-black capitalize mb-1">{activeTab}</h1><p className="text-muted-foreground">Painel de Controle</p></div>
                      <div className="flex gap-3"><Button variant="outline" onClick={fetchData}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button><Button variant="destructive" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" /> Sair</Button></div>
                  </div>

                  {/* OVERVIEW */}
                  {activeTab === 'overview' && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">R$ {stats.revenue.toFixed(2)}</div></CardContent></Card>
                          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Solicitações Pendentes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{pendingDrivers.length}</div></CardContent></Card>
                      </div>
                  )}

                  {/* SOLICITAÇÕES (KYC) */}
                  {activeTab === 'requests' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {pendingDrivers.length === 0 ? <p className="col-span-3 text-center text-gray-500 py-10">Nenhuma solicitação pendente.</p> : 
                           pendingDrivers.map(d => (
                              <Card key={d.id} className="overflow-hidden">
                                  <div className="h-24 bg-slate-100 relative"><div className="absolute -bottom-8 left-6"><Avatar className="w-16 h-16 border-4 border-white"><AvatarImage src={d.face_photo_url} /><AvatarFallback>{d.first_name[0]}</AvatarFallback></Avatar></div></div>
                                  <CardContent className="pt-10 pb-4 px-6">
                                      <h3 className="font-bold text-lg">{d.first_name} {d.last_name}</h3>
                                      <p className="text-sm text-gray-500 mb-4">CPF: {d.cpf || 'Não informado'}</p>
                                      <div className="text-sm space-y-1 mb-4">
                                          <p><span className="font-bold">Carro:</span> {d.car_model} - {d.car_color}</p>
                                          <p><span className="font-bold">Placa:</span> {d.car_plate}</p>
                                      </div>
                                      <Button className="w-full bg-slate-900" onClick={() => { setSelectedUser(d); setIsKYCDialogOpen(true); }}>Analisar Documentos</Button>
                                  </CardContent>
                              </Card>
                          ))}
                      </div>
                  )}

                  {/* CONFIGURAÇÕES */}
                  {activeTab === 'config' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card>
                              <CardHeader><CardTitle>Métodos de Pagamento</CardTitle><CardDescription>Controle quais opções aparecem para os passageiros.</CardDescription></CardHeader>
                              <CardContent className="space-y-6">
                                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                      <div className="flex items-center gap-3"><Wallet className="w-5 h-5 text-slate-500"/><span className="font-bold">Carteira Virtual (Saldo)</span></div>
                                      <Switch checked={paymentConfig.wallet} onCheckedChange={c => setPaymentConfig({...paymentConfig, wallet: c})} />
                                  </div>
                                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                      <div className="flex items-center gap-3"><DollarSign className="w-5 h-5 text-green-600"/><span className="font-bold">Dinheiro / PIX Direto</span></div>
                                      <Switch checked={paymentConfig.cash} onCheckedChange={c => setPaymentConfig({...paymentConfig, cash: c})} />
                                  </div>
                              </CardContent>
                              <CardFooter><Button className="w-full" onClick={handleSavePaymentConfig}>Salvar Configurações</Button></CardFooter>
                          </Card>
                      </div>
                  )}

                  {/* OUTRAS TABELAS (SIMPLIFICADO) */}
                  {(activeTab === 'users' || activeTab === 'drivers') && (
                      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                          {(activeTab === 'users' ? passengers : drivers).map(u => (
                              <TableRow key={u.id}><TableCell>{u.first_name}</TableCell><TableCell>{u.email}</TableCell><TableCell><Badge variant="outline">{u.driver_status || 'N/A'}</Badge></TableCell></TableRow>
                          ))}
                      </TableBody></Table></CardContent></Card>
                  )}
              </div>
          </div>
      </main>

      {/* DIALOG DE KYC */}
      <Dialog open={isKYCDialogOpen} onOpenChange={setIsKYCDialogOpen}>
          <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Análise de Motorista</DialogTitle><DialogDescription>Verifique os documentos enviados.</DialogDescription></DialogHeader>
              {selectedUser && (
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div><Label>Selfie</Label><img src={selectedUser.face_photo_url} className="w-full h-48 object-cover rounded-lg bg-gray-100" /></div>
                          <div className="space-y-2">
                              <div><Label>CNH Frente</Label><img src={selectedUser.cnh_front_url} className="w-full h-32 object-cover rounded-lg bg-gray-100" /></div>
                              <div><Label>CNH Verso</Label><img src={selectedUser.cnh_back_url} className="w-full h-32 object-cover rounded-lg bg-gray-100" /></div>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                          <p><strong>Nome:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                          <p><strong>CPF:</strong> {selectedUser.cpf}</p>
                          <p><strong>Veículo:</strong> {selectedUser.car_model} ({selectedUser.car_year}) - {selectedUser.car_plate}</p>
                      </div>
                      <div className="flex gap-4">
                          <Button variant="destructive" className="flex-1 h-12" onClick={() => handleRejectDriver(selectedUser.id)}><XCircle className="mr-2"/> Reprovar</Button>
                          <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700" onClick={() => handleApproveDriver(selectedUser.id)}><Check className="mr-2"/> Aprovar</Button>
                      </div>
                  </div>
              )}
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;