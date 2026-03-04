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
  Ban, Percent, Navigation, PlusCircle
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
import { useTheme } from "@/components/theme-provider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  
  // Dados Principais
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, driversOnline: 0, pendingDrivers: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]); 
  
  // Estados de Gerenciamento
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/');
  };

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
      <Card className="border-0 shadow-lg overflow-hidden relative">
          <CardContent className="p-6">
              <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}><Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} /></div>
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase mt-4">{title}</p>
              <h3 className="text-3xl font-black mt-1">{value}</h3>
          </CardContent>
      </Card>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground overflow-hidden">
      {/* Sidebar Fixo */}
      <aside className="hidden lg:flex flex-col w-72 border-r bg-white dark:bg-slate-900">
         <div className="p-8 flex items-center gap-3 font-black text-2xl border-b">
             <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-black">G</div>
             <span>Gold<span className="text-yellow-500">Admin</span></span>
         </div>
         <nav className="flex-1 px-4 py-8 space-y-2">
             <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                 <LayoutDashboard className="w-5 h-5" /> Painel Geral
             </button>
             <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                 <FileText className="w-5 h-5" /> Solicitações {stats.pendingDrivers > 0 && <Badge className="ml-auto bg-red-500">{stats.pendingDrivers}</Badge>}
             </button>
             <button onClick={() => setActiveTab('rides')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'rides' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                 <MapIcon className="w-5 h-5" /> Corridas
             </button>
             <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                 <Users className="w-5 h-5" /> Motoristas e Clientes
             </button>
             <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                 <Settings className="w-5 h-5" /> Configurações
             </button>
         </nav>
         <div className="p-4 border-t">
             <Button variant="ghost" className="w-full justify-start text-red-500 font-bold h-12 rounded-xl" onClick={handleLogout}><LogOut className="mr-3 w-5 h-5" /> Sair</Button>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-10">
              
              {/* Header Mobile/Top */}
              <div className="flex justify-between items-center">
                  <div>
                      <h1 className="text-4xl font-black tracking-tight">{activeTab === 'overview' ? 'Painel Geral' : activeTab === 'requests' ? 'Solicitações de Motoristas' : activeTab === 'rides' ? 'Monitor de Corridas' : activeTab === 'users' ? 'Gestão de Usuários' : 'Configurações'}</h1>
                      <p className="text-slate-400 font-medium mt-1">Bem-vindo de volta, Administrador.</p>
                  </div>
                  <Button onClick={fetchData} variant="outline" className="h-12 rounded-xl" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Atualizar</Button>
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

                      <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden">
                          <CardHeader className="p-8 border-b"><CardTitle className="text-xl font-black">Corridas em Tempo Real</CardTitle></CardHeader>
                          <Table>
                              <TableHeader><TableRow className="bg-slate-50 border-0"><TableHead className="pl-8">ID / Data</TableHead><TableHead>Passageiro</TableHead><TableHead>Motorista</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-8">Ação</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {rides.slice(0, 5).map(ride => (
                                      <TableRow key={ride.id} className="border-b hover:bg-slate-50/50">
                                          <TableCell className="pl-8 font-medium">#{ride.id.slice(0,5)}<p className="text-[10px] text-slate-400 font-bold">{new Date(ride.created_at).toLocaleString()}</p></TableCell>
                                          <TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={ride.customer?.avatar_url} /><AvatarFallback>{ride.customer?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-bold text-sm">{ride.customer?.first_name || ride.guest_name}</span></div></TableCell>
                                          <TableCell>{ride.driver ? <div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={ride.driver?.avatar_url} /><AvatarFallback>{ride.driver?.first_name?.[0]}</AvatarFallback></Avatar><span className="font-bold text-sm">{ride.driver?.first_name}</span></div> : <span className="text-xs text-slate-400">Pendente...</span>}</TableCell>
                                          <TableCell className="font-black">R$ {Number(ride.price).toFixed(2)}</TableCell>
                                          <TableCell><Badge className={ride.status === 'COMPLETED' ? 'bg-green-500' : ride.status === 'CANCELLED' ? 'bg-red-500' : 'bg-yellow-500'}>{ride.status}</Badge></TableCell>
                                          <TableCell className="text-right pr-8"><Button variant="ghost" size="sm" onClick={() => { setActiveTab('rides'); }}>Ver Todas</Button></TableCell>
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
                      <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden">
                          <CardHeader className="p-8 bg-slate-900 text-white"><CardTitle className="text-2xl font-black">Pendentes de Aprovação</CardTitle><CardDescription className="text-slate-400">Novos motoristas aguardando verificação de documentos.</CardDescription></CardHeader>
                          <Table>
                              <TableHeader><TableRow><TableHead className="pl-8">Motorista</TableHead><TableHead>Veículo</TableHead><TableHead>Data Cadastro</TableHead><TableHead className="text-right pr-8">Ação</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {pendingDrivers.length === 0 ? <TableRow><TableCell colSpan={4} className="h-60 text-center text-slate-400 font-bold">Nenhuma solicitação pendente no momento.</TableCell></TableRow> : pendingDrivers.map(d => (
                                      <TableRow key={d.id} className="hover:bg-slate-50 transition-colors">
                                          <TableCell className="pl-8"><div className="flex items-center gap-4"><Avatar className="h-12 w-12 border-2 border-white shadow-sm"><AvatarImage src={d.avatar_url} /><AvatarFallback>{d.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-black text-slate-900">{d.first_name} {d.last_name}</p><p className="text-xs text-slate-400">{d.email}</p></div></div></TableCell>
                                          <TableCell><p className="font-bold text-sm text-slate-900">{d.car_model}</p><Badge variant="outline" className="font-mono text-[10px] mt-1 uppercase">{d.car_plate}</Badge></TableCell>
                                          <TableCell className="text-slate-500 text-sm">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-6">
                                              <Button onClick={() => { setSelectedUser(d); setIsReviewModalOpen(true); }} className="bg-black text-white rounded-xl font-bold h-11 px-6">Analisar</Button>
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
                       <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden">
                          <CardHeader className="p-8 border-b flex flex-row items-center justify-between">
                              <div><CardTitle className="text-2xl font-black">Monitoramento de Viagens</CardTitle><CardDescription>Acompanhe todas as atividades da plataforma.</CardDescription></div>
                              <div className="flex gap-4">
                                  <Input placeholder="Filtrar por nome ou ID..." className="w-64 h-12 rounded-xl" />
                              </div>
                          </CardHeader>
                          <Table>
                              <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-8">Início / Destino</TableHead><TableHead>Pessoas Envolvidas</TableHead><TableHead>Pagamento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-8">Detalhes</TableHead></TableRow></TableHeader>
                              <TableBody>
                                  {rides.map(ride => (
                                      <TableRow key={ride.id} className="border-b hover:bg-slate-50/50">
                                          <TableCell className="pl-8 max-w-[200px]"><div className="space-y-1"><p className="text-xs font-black text-slate-900 truncate">📍 {ride.pickup_address}</p><p className="text-xs font-medium text-slate-400 truncate">🏁 {ride.destination_address}</p></div></TableCell>
                                          <TableCell><div className="flex -space-x-3"><Avatar className="border-2 border-white"><AvatarImage src={ride.customer?.avatar_url} /><AvatarFallback>{ride.customer?.first_name?.[0]}</AvatarFallback></Avatar><Avatar className="border-2 border-white"><AvatarImage src={ride.driver?.avatar_url} /><AvatarFallback>{ride.driver?.first_name?.[0]}</AvatarFallback></Avatar></div></TableCell>
                                          <TableCell><Badge variant="secondary" className="font-bold text-[10px] uppercase">{ride.payment_method}</Badge></TableCell>
                                          <TableCell className="font-black text-lg">R$ {Number(ride.price).toFixed(2)}</TableCell>
                                          <TableCell><Badge className={`font-black ${ride.status === 'COMPLETED' ? 'bg-green-500' : ride.status === 'CANCELLED' ? 'bg-red-500' : 'bg-yellow-500'}`}>{ride.status}</Badge></TableCell>
                                          <TableCell className="text-right pr-8"><Button variant="ghost" size="icon" onClick={() => showError("Em breve: Detalhes completos da rota.")}><ExternalLink className="w-4 h-4" /></Button></TableCell>
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
                          <TabsList className="h-14 bg-white p-1 rounded-2xl shadow-sm mb-6">
                              <TabsTrigger value="drivers" className="px-8 font-black rounded-xl">Motoristas ({drivers.length})</TabsTrigger>
                              <TabsTrigger value="clients" className="px-8 font-black rounded-xl">Passageiros ({passengers.length})</TabsTrigger>
                          </TabsList>
                          <TabsContent value="drivers">
                              <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden">
                                  <Table>
                                      <TableHeader><TableRow><TableHead className="pl-8">Motorista</TableHead><TableHead>Veículo</TableHead><TableHead>Status</TableHead><TableHead>Saldo</TableHead><TableHead className="text-right pr-8">Ações</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {drivers.map(d => (
                                              <TableRow key={d.id} className={d.is_blocked ? 'opacity-50 grayscale bg-slate-100' : ''}>
                                                  <TableCell className="pl-8 py-5"><div className="flex items-center gap-4"><Avatar className="h-10 w-10"><AvatarImage src={d.avatar_url} /><AvatarFallback>{d.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-slate-900 flex items-center gap-2">{d.first_name} {d.last_name} {d.is_blocked && <Ban className="w-3 h-3 text-red-500" />}</p><p className="text-xs text-slate-400">{d.email}</p></div></div></TableCell>
                                                  <TableCell><p className="text-xs font-bold">{d.car_model || '---'}</p><p className="text-[10px] text-slate-400 uppercase font-mono">{d.car_plate || '---'}</p></TableCell>
                                                  <TableCell><Badge className={d.driver_status === 'APPROVED' ? 'bg-green-500' : 'bg-yellow-500'}>{d.driver_status}</Badge></TableCell>
                                                  <TableCell className="font-bold">R$ {Number(d.balance).toFixed(2)}</TableCell>
                                                  <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-6">
                                                       <Button variant="outline" size="sm" onClick={() => handleToggleBlock(d)} className={d.is_blocked ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}>{d.is_blocked ? 'Desbloquear' : 'Bloquear'}</Button>
                                                       <Button variant="ghost" size="icon" onClick={() => showError("Recurso de edição em breve")}><Pencil className="w-4 h-4" /></Button>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </Card>
                          </TabsContent>
                          <TabsContent value="clients">
                              <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden">
                                  <Table>
                                      <TableHeader><TableRow><TableHead className="pl-8">Passageiro</TableHead><TableHead>Data Cadastro</TableHead><TableHead>Saldo Carteira</TableHead><TableHead className="text-right pr-8">Ações</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {passengers.map(p => (
                                              <TableRow key={p.id} className={p.is_blocked ? 'opacity-50 grayscale' : ''}>
                                                  <TableCell className="pl-8 py-5"><div className="flex items-center gap-4"><Avatar className="h-10 w-10"><AvatarImage src={p.avatar_url} /><AvatarFallback>{p.first_name?.[0]}</AvatarFallback></Avatar><div><p className="font-bold text-slate-900">{p.first_name} {p.last_name}</p><p className="text-xs text-slate-400">{p.email}</p></div></div></TableCell>
                                                  <TableCell className="text-slate-500 text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                                  <TableCell className="font-black text-blue-600">R$ {Number(p.balance).toFixed(2)}</TableCell>
                                                  <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-6">
                                                       <Button variant="outline" size="sm" onClick={() => handleToggleBlock(p)} className={p.is_blocked ? 'text-green-600' : 'text-red-600'}>{p.is_blocked ? 'Desbloquear' : 'Bloquear'}</Button>
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

              {/* CONFIG (MANTIDO DO CÓDIGO ANTERIOR) */}
              {activeTab === 'config' && (
                   <div className="bg-white rounded-[32px] p-10 shadow-xl text-center">
                       <Settings className="w-16 h-16 mx-auto mb-6 text-slate-200" />
                       <h2 className="text-2xl font-black mb-2">Painel de Configuração</h2>
                       <p className="text-slate-400 mb-8 max-w-sm mx-auto">Gerencie taxas, preços e recursos da plataforma Gold Mobile aqui.</p>
                       <Button onClick={() => setActiveTab('overview')} className="bg-black text-white px-8 h-12 rounded-xl">Voltar ao Painel</Button>
                   </div>
              )}

          </div>
      </main>

      {/* MODAL DE REVISÃO DE MOTORISTA */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-w-xl bg-white rounded-[40px] border-0 shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="p-8 bg-slate-900 text-white"><DialogTitle className="text-2xl font-black">Revisar Cadastro</DialogTitle><DialogDescription className="text-slate-400">Verifique os dados antes de aprovar.</DialogDescription></DialogHeader>
              <div className="p-8 space-y-8">
                  <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-3xl">
                      <Avatar className="h-20 w-20 border-4 border-white shadow-xl"><AvatarImage src={selectedUser?.avatar_url} /><AvatarFallback>{selectedUser?.first_name?.[0]}</AvatarFallback></Avatar>
                      <div><h3 className="text-2xl font-black text-slate-900">{selectedUser?.first_name} {selectedUser?.last_name}</h3><p className="text-slate-500 font-medium">{selectedUser?.phone || 'Telefone não informado'}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Modelo do Carro</p><p className="font-bold text-slate-900 text-lg">{selectedUser?.car_model || 'N/A'}</p></div>
                      <div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Placa do Carro</p><p className="font-black text-slate-900 text-lg uppercase">{selectedUser?.car_plate || 'N/A'}</p></div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-3xl flex items-start gap-4">
                      <Shield className="w-6 h-6 text-yellow-600 shrink-0 mt-1" />
                      <p className="text-sm text-yellow-800 font-medium">Ao aprovar, o motorista receberá acesso imediato para aceitar corridas e gerenciar sua carteira.</p>
                  </div>
              </div>
              <DialogFooter className="p-8 bg-slate-50 flex gap-4">
                  <Button variant="outline" className="flex-1 h-14 rounded-2xl text-red-500 font-bold" onClick={() => handleUpdateUserStatus(selectedUser.id, 'REJECTED')}>REJEITAR</Button>
                  <Button className="flex-1 h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-lg" onClick={() => handleUpdateUserStatus(selectedUser.id, 'APPROVED')}>APROVAR AGORA</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;