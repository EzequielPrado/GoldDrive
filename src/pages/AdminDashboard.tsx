import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, Search, Star, MoreHorizontal,
  ArrowUpRight, ArrowDownRight, Save, RefreshCw, Filter, Menu, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import MapComponent from "@/components/MapComponent";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Dados
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, rides: 0, users: 0, drivers: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setUserProfile(data);
        }

        // Corridas e Receita
        const { data: ridesData } = await supabase.from('rides').select('*').order('created_at', { ascending: false });
        
        const totalRevenue = ridesData?.filter(r => r.status === 'COMPLETED').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) || 0;
        const adminRev = ridesData?.reduce((acc, curr) => acc + (Number(curr.platform_fee) || 0), 0) || 0;
        
        // Dados para gráfico (Agrupar por data)
        const chartMap = new Map();
        ridesData?.forEach(r => {
            const date = new Date(r.created_at).toLocaleDateString();
            if(!chartMap.has(date)) chartMap.set(date, { date, total: 0, admin: 0 });
            const item = chartMap.get(date);
            item.total += Number(r.price || 0);
            item.admin += Number(r.platform_fee || 0);
        });
        setChartData(Array.from(chartMap.values()).reverse());

        // Usuários
        const { data: usersData } = await supabase.from('profiles').select('*');
        
        // Categorias
        const { data: catsData } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });

        setStats({
            revenue: totalRevenue,
            adminRevenue: adminRev,
            rides: ridesData?.length || 0,
            users: usersData?.filter((u:any) => u.role === 'client').length || 0,
            drivers: usersData?.filter((u:any) => u.role === 'driver').length || 0
        });

        if (ridesData) setRides(ridesData);
        if (usersData) setUsers(usersData);
        if (catsData) setCategories(catsData);

    } catch (e: any) {
        showError(e.message);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateCategory = async (id: string, field: string, value: string) => {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const saveCategory = async (cat: any) => {
      try {
          const { error } = await supabase.from('car_categories').update({
              base_fare: cat.base_fare,
              cost_per_km: cat.cost_per_km,
              min_fare: cat.min_fare
          }).eq('id', cat.id);
          if (error) throw error;
          showSuccess("Categoria atualizada!");
      } catch (e: any) {
          showError(e.message);
      }
  };

  const renderStars = (rating?: number) => {
      if (!rating) return <span className="text-gray-300 text-xs">-</span>;
      return <span className="text-yellow-500 font-bold text-xs">★ {rating}</span>;
  };

  // Componente de Navegação
  const NavContent = () => (
    <div className="flex flex-col h-full">
         <div className="p-8 pb-4">
             <div className="flex items-center gap-2 text-2xl font-black tracking-tighter text-slate-900">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <Car className="w-5 h-5" />
                </div>
                GoMove
             </div>
             <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider ml-10">Admin Console</p>
         </div>

         <nav className="flex-1 px-4 space-y-1 mt-6">
             {[
                 { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
                 { id: 'rides', label: 'Corridas', icon: MapIcon },
                 { id: 'users', label: 'Passageiros', icon: Users },
                 { id: 'drivers', label: 'Motoristas', icon: Car },
                 { id: 'finance', label: 'Financeiro', icon: Wallet },
                 { id: 'config', label: 'Configurações', icon: Settings },
             ].map(item => (
                 <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        activeTab === item.id 
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                 >
                     <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-blue-400' : ''}`} />
                     {item.label}
                 </button>
             ))}
         </nav>

         <div className="p-4 border-t space-y-2">
             <button onClick={() => navigate('/profile')} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 px-4 py-3 rounded-xl w-full transition-colors">
                 <User className="w-4 h-4" /> Meu Perfil
             </button>
             <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium text-red-500 hover:bg-red-50 px-4 py-3 rounded-xl w-full transition-colors">
                 <LogOut className="w-4 h-4" /> Sair
             </button>
         </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
         <NavContent />
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
          {/* Topbar Responsiva */}
          <header className="h-20 border-b bg-white/80 backdrop-blur px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                  {/* Menu Mobile Trigger */}
                  <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden">
                            <Menu className="w-6 h-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-72">
                        <NavContent />
                    </SheetContent>
                  </Sheet>

                  <div>
                      <h1 className="text-lg lg:text-xl font-bold text-slate-800 truncate">
                          {activeTab === 'overview' ? 'Painel de Controle' : 
                           activeTab === 'users' ? 'Gestão de Passageiros' :
                           activeTab === 'drivers' ? 'Gestão de Motoristas' :
                           activeTab === 'finance' ? 'Controle Financeiro' :
                           activeTab === 'rides' ? 'Monitoramento de Corridas' : 'Configurações'}
                      </h1>
                  </div>
              </div>

              <div className="flex items-center gap-2 lg:gap-4">
                  <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Avatar className="w-10 h-10 border-2 border-white shadow-sm cursor-pointer" onClick={() => navigate('/profile')}>
                      <AvatarImage src={userProfile?.avatar_url} />
                      <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
              </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              {/* VISÃO GERAL */}
              {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {[
                              { label: 'Vol. Transacionado', value: `R$ ${stats.revenue.toFixed(2)}`, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
                              { label: 'Receita Admin (20%)', value: `R$ ${stats.adminRevenue.toFixed(2)}`, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                              { label: 'Corridas Totais', value: stats.rides, icon: Car, color: 'text-blue-600', bg: 'bg-blue-50' },
                              { label: 'Passageiros', value: stats.users, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                          ].map((stat, i) => (
                              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                                  <CardContent className="p-6">
                                      <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                                          <stat.icon className="w-6 h-6" />
                                      </div>
                                      <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                      <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                  </CardContent>
                              </Card>
                          ))}
                      </div>

                      {/* Gráfico */}
                      <Card className="border-0 shadow-sm">
                          <CardHeader>
                              <CardTitle>Desempenho Financeiro</CardTitle>
                          </CardHeader>
                          <CardContent className="h-[300px]">
                              <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={chartData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="date" />
                                      <YAxis />
                                      <Tooltip />
                                      <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} name="Total" />
                                      <Line type="monotone" dataKey="admin" stroke="#10b981" strokeWidth={2} name="Receita Admin" />
                                  </LineChart>
                              </ResponsiveContainer>
                          </CardContent>
                      </Card>
                  </div>
              )}
              
              {/* FINANCEIRO (DETALHADO) */}
              {activeTab === 'finance' && (
                  <div className="space-y-6 animate-in slide-in-from-right">
                       <Card className="border-0 shadow-sm">
                          <CardHeader>
                              <CardTitle>Fluxo de Caixa</CardTitle>
                              <CardDescription>Análise detalhada de receitas e taxas</CardDescription>
                          </CardHeader>
                          <CardContent className="h-[400px]">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={chartData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="date" />
                                      <YAxis />
                                      <Tooltip />
                                      <Bar dataKey="total" fill="#2563eb" name="Vol. Total" radius={[4,4,0,0]} />
                                      <Bar dataKey="admin" fill="#10b981" name="Lucro Admin" radius={[4,4,0,0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </CardContent>
                      </Card>
                  </div>
              )}

              {/* CORRIDAS (TABELA DETALHADA) */}
              {(activeTab === 'rides' || activeTab === 'overview') && (
                  <Card className="border-0 shadow-sm mt-6">
                      <CardHeader>
                          <CardTitle>{activeTab === 'rides' ? 'Todas as Corridas' : 'Últimas Corridas'}</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="overflow-x-auto">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>ID</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Avaliação (Mot/Pass)</TableHead>
                                          <TableHead>Total</TableHead>
                                          <TableHead>Lucro Admin</TableHead>
                                          <TableHead>Mot. Ganho</TableHead>
                                          <TableHead className="text-right">Data</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {(activeTab === 'overview' ? rides.slice(0, 5) : rides).map(ride => (
                                          <TableRow key={ride.id}>
                                              <TableCell className="font-mono text-xs text-gray-400">{ride.id.substring(0,6)}</TableCell>
                                              <TableCell>
                                                  <Badge className={
                                                      ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                                      ride.status === 'CANCELLED' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                      'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                                  }>{ride.status}</Badge>
                                              </TableCell>
                                              <TableCell>
                                                  <div className="flex flex-col gap-1 min-w-[100px]">
                                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                                          M: {renderStars(ride.driver_rating)}
                                                      </div>
                                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                                          P: {renderStars(ride.customer_rating)}
                                                      </div>
                                                  </div>
                                              </TableCell>
                                              <TableCell className="font-bold">R$ {ride.price}</TableCell>
                                              <TableCell className="text-emerald-600 font-medium">R$ {ride.platform_fee || 0}</TableCell>
                                              <TableCell className="text-blue-600 font-medium">R$ {ride.driver_earnings || 0}</TableCell>
                                              <TableCell className="text-right text-gray-500 text-xs whitespace-nowrap">
                                                  {new Date(ride.created_at).toLocaleDateString()} {new Date(ride.created_at).toLocaleTimeString()}
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </div>
                      </CardContent>
                  </Card>
              )}

              {/* LISTA DE USUÁRIOS */}
              {(activeTab === 'users' || activeTab === 'drivers') && (
                  <Card className="border-0 shadow-sm animate-in fade-in">
                      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                              <CardTitle>Base de {activeTab === 'users' ? 'Passageiros' : 'Motoristas'}</CardTitle>
                              <CardDescription>Gerencie os usuários cadastrados</CardDescription>
                          </div>
                          <div className="relative w-full sm:w-64">
                              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input placeholder="Buscar por nome..." className="pl-9 bg-slate-50 border-0" />
                          </div>
                      </CardHeader>
                      <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>Saldo Atual</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users
                                        .filter(u => u.role === (activeTab === 'users' ? 'client' : 'driver'))
                                        .map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={user.avatar_url} />
                                                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                                            {user.first_name?.[0]}{user.last_name?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium text-slate-900 whitespace-nowrap">{user.first_name} {user.last_name}</p>
                                                        <p className="text-xs text-slate-500 md:hidden">{user.id.substring(0,8)}...</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold">
                                                R$ {user.balance?.toFixed(2) || '0.00'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Ativo</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                          </div>
                      </CardContent>
                  </Card>
              )}

              {/* CONFIGURAÇÕES */}
              {activeTab === 'config' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-right">
                      {categories.map((cat) => (
                          <Card key={cat.id} className="border-0 shadow-md hover:shadow-xl transition-all duration-300">
                              <CardHeader className="pb-4">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <Badge variant="secondary" className="mb-2">{cat.name}</Badge>
                                          <CardTitle className="text-lg">Preços</CardTitle>
                                      </div>
                                      <Car className="w-8 h-8 text-slate-200" />
                                  </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">Tarifa Base</label>
                                      <div className="relative">
                                          <span className="absolute left-3 top-2.5 text-slate-400">R$</span>
                                          <Input 
                                              type="number" 
                                              className="pl-8 font-bold"
                                              value={cat.base_fare} 
                                              onChange={(e) => updateCategory(cat.id, 'base_fare', e.target.value)}
                                          />
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">Por Km</label>
                                      <div className="relative">
                                          <span className="absolute left-3 top-2.5 text-slate-400">R$</span>
                                          <Input 
                                              type="number" 
                                              className="pl-8 font-bold"
                                              value={cat.cost_per_km} 
                                              onChange={(e) => updateCategory(cat.id, 'cost_per_km', e.target.value)}
                                          />
                                      </div>
                                  </div>
                                  <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={() => saveCategory(cat)}>
                                      <Save className="w-4 h-4 mr-2" /> Salvar
                                  </Button>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              )}
          </div>
      </main>
    </div>
  );
};

export default AdminDashboard;