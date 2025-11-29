import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, Users, Car, Settings, Wallet, 
  Map as MapIcon, LogOut, Search, Star, MoreHorizontal,
  ArrowUpRight, ArrowDownRight, Save, RefreshCw, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import MapComponent from "@/components/MapComponent";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  
  // Dados
  const [stats, setStats] = useState({ revenue: 0, rides: 0, users: 0, drivers: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
        // Corridas e Receita
        const { data: ridesData } = await supabase.from('rides').select('*').order('created_at', { ascending: false });
        const revenue = ridesData?.filter(r => r.status === 'COMPLETED').reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) || 0;
        
        // Usuários
        const { data: usersData } = await supabase.from('profiles').select('*');
        
        // Categorias
        const { data: catsData } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });

        setStats({
            revenue,
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

  // Helper para renderizar estrelas
  const renderStars = (rating?: number) => {
      if (!rating) return <span className="text-gray-300 text-xs">Sem avaliação</span>;
      return (
          <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < rating ? 'fill-current' : 'text-gray-200'}`} />
              ))}
          </div>
      );
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar Elegante */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
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

         <div className="p-4 border-t">
             <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium text-red-500 hover:bg-red-50 px-4 py-3 rounded-xl w-full transition-colors">
                 <LogOut className="w-4 h-4" /> Sair
             </button>
         </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
          {/* Topbar */}
          <header className="h-20 border-b bg-white/80 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-10">
              <div>
                  <h1 className="text-xl font-bold text-slate-800">
                      {activeTab === 'overview' ? 'Painel de Controle' : 
                       activeTab === 'users' ? 'Gestão de Passageiros' :
                       activeTab === 'drivers' ? 'Gestão de Motoristas' :
                       activeTab === 'finance' ? 'Controle Financeiro' : 'Configurações'}
                  </h1>
                  <p className="text-xs text-slate-400">Atualizado em tempo real</p>
              </div>
              <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                      <AvatarImage src="https://github.com/shadcn.png" />
                  </div>
              </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
              
              {/* VISÃO GERAL */}
              {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          {[
                              { label: 'Faturamento', value: `R$ ${stats.revenue.toFixed(2)}`, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
                              { label: 'Corridas Totais', value: stats.rides, icon: Car, color: 'text-blue-600', bg: 'bg-blue-50' },
                              { label: 'Passageiros', value: stats.users, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                              { label: 'Motoristas', value: stats.drivers, icon: Car, color: 'text-orange-600', bg: 'bg-orange-50' },
                          ].map((stat, i) => (
                              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                                  <CardContent className="p-6">
                                      <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                                          <stat.icon className="w-6 h-6" />
                                      </div>
                                      <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                      <h3 className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                  </CardContent>
                              </Card>
                          ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <Card className="lg:col-span-2 border-0 shadow-sm">
                              <CardHeader>
                                  <CardTitle>Últimas Corridas</CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <Table>
                                      <TableHeader>
                                          <TableRow>
                                              <TableHead>Status</TableHead>
                                              <TableHead>Avaliação (Mot/Pass)</TableHead>
                                              <TableHead>Valor</TableHead>
                                              <TableHead className="text-right">Data</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {rides.slice(0, 5).map(ride => (
                                              <TableRow key={ride.id}>
                                                  <TableCell>
                                                      <Badge className={
                                                          ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                                          ride.status === 'CANCELLED' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                          'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                                      }>{ride.status}</Badge>
                                                  </TableCell>
                                                  <TableCell>
                                                      <div className="flex flex-col gap-1">
                                                          <div className="flex items-center gap-1 text-xs text-gray-500">
                                                              M: {renderStars(ride.driver_rating)}
                                                          </div>
                                                          <div className="flex items-center gap-1 text-xs text-gray-500">
                                                              P: {renderStars(ride.customer_rating)}
                                                          </div>
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="font-bold">R$ {ride.price}</TableCell>
                                                  <TableCell className="text-right text-gray-500 text-xs">
                                                      {new Date(ride.created_at).toLocaleDateString()}
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              </CardContent>
                          </Card>
                          
                          <Card className="border-0 shadow-sm overflow-hidden flex flex-col h-[400px]">
                              <CardHeader className="bg-white border-b z-10">
                                  <CardTitle>Mapa em Tempo Real</CardTitle>
                              </CardHeader>
                              <div className="flex-1 relative">
                                  <MapComponent />
                              </div>
                          </Card>
                      </div>
                  </div>
              )}

              {/* LISTA DE USUÁRIOS (GENÉRICA PARA DRIVER E PASSAGEIRO) */}
              {(activeTab === 'users' || activeTab === 'drivers') && (
                  <Card className="border-0 shadow-sm animate-in fade-in">
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                              <CardTitle>Base de {activeTab === 'users' ? 'Passageiros' : 'Motoristas'}</CardTitle>
                              <CardDescription>Gerencie os usuários cadastrados</CardDescription>
                          </div>
                          <div className="relative w-64">
                              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input placeholder="Buscar por nome..." className="pl-9 bg-slate-50 border-0" />
                          </div>
                      </CardHeader>
                      <CardContent>
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Usuário</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>ID</TableHead>
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
                                                      <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                                          {user.first_name?.[0]}{user.last_name?.[0]}
                                                      </AvatarFallback>
                                                  </Avatar>
                                                  <div>
                                                      <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                                                      <p className="text-xs text-slate-500">{user.id}</p>
                                                  </div>
                                              </div>
                                          </TableCell>
                                          <TableCell>
                                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Ativo</Badge>
                                          </TableCell>
                                          <TableCell className="font-mono text-xs text-gray-400">{user.id}</TableCell>
                                          <TableCell className="text-right">
                                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </CardContent>
                  </Card>
              )}

              {/* CONFIGURAÇÕES E FINANCEIRO */}
              {(activeTab === 'config' || activeTab === 'finance') && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-right">
                      {categories.map((cat) => (
                          <Card key={cat.id} className="border-0 shadow-md hover:shadow-xl transition-all duration-300">
                              <CardHeader className="pb-4">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <Badge variant="secondary" className="mb-2">{cat.name}</Badge>
                                          <CardTitle className="text-lg">Configuração de Preço</CardTitle>
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
                                      <Save className="w-4 h-4 mr-2" /> Salvar Alterações
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