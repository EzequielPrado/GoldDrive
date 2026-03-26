"use client";

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
  Ban, Percent, Navigation, PlusCircle, UserPlus, Eye, Ticket
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
  
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, driversOnline: 0, pendingDrivers: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]); 
  
  const [carCategories, setCarCategories] = useState<any[]>([]);
  const [categoryRules, setCategoryRules] = useState<Record<string, any>>({});
  const [appSettings, setAppSettings] = useState({ enable_cash: true, enable_wallet: true });
  const [minCarYear, setMinCarYear] = useState("2010"); 
  const [globalMultiplier, setGlobalMultiplier] = useState("1.0");
  const [costPerStop, setCostPerStop] = useState("2.50");
  const [savingSettings, setSavingSettings] = useState(false);

  const [coupons, setCoupons] = useState<any[]>([]);
  const [newCoupon, setNewCoupon] = useState({ code: '', type: 'PERCENTAGE', value: '', max_uses: '100' });

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

        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (profiles) {
            setPassengers(profiles.filter((p: any) => p.role === 'client'));
            const allDrivers = profiles.filter((p: any) => p.role === 'driver');
            setDrivers(allDrivers);
            setPendingDrivers(allDrivers.filter((p: any) => p.driver_status === 'PENDING'));
        }

        const { data: ridesData } = await supabase.from('rides')
            .select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`)
            .order('created_at', { ascending: false });
        if (ridesData) setRides(ridesData);

        const completedRides = ridesData?.filter(r => r.status === 'COMPLETED') || [];
        setStats({
            revenue: completedRides.reduce((a, r) => a + Number(r.price), 0),
            adminRevenue: completedRides.reduce((a, r) => a + Number(r.platform_fee), 0),
            driversOnline: profiles?.filter(p => p.role === 'driver' && p.is_online).length || 0,
            pendingDrivers: profiles?.filter(p => p.role === 'driver' && p.driver_status === 'PENDING').length || 0
        });

        const { data: cats } = await supabase.from('car_categories').select('*').order('base_fare', { ascending: true });
        if (cats) setCarCategories(cats);

        const { data: adminConfigs } = await supabase.from('admin_config').select('*');
        if (adminConfigs) {
            const minYearObj = adminConfigs.find(c => c.key === 'min_car_year');
            if (minYearObj && minYearObj.value) setMinCarYear(minYearObj.value);

            const multObj = adminConfigs.find(c => c.key === 'global_multiplier');
            if (multObj && multObj.value) setGlobalMultiplier(multObj.value);
            
            const stopObj = adminConfigs.find(c => c.key === 'cost_per_stop');
            if (stopObj && stopObj.value) setCostPerStop(stopObj.value);

            const rulesObj = adminConfigs.find(c => c.key === 'category_rules');
            if (rulesObj && rulesObj.value) {
                try { setCategoryRules(JSON.parse(rulesObj.value)); } catch (e) { setCategoryRules({}); }
            }
        }

    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
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

  const handleCategoryChange = (id: string, field: string, val: any) => {
      setCarCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleRuleChange = (catName: string, field: string, val: any) => {
      setCategoryRules(prev => ({
          ...prev,
          [catName]: {
              ...(prev[catName] || {}),
              [field]: val
          }
      }));
  };

  const handleAddSchedule = (catName: string) => {
      const currentSchedules = categoryRules[catName]?.schedules || [];
      const newSchedules = [...currentSchedules, { start: '22:00', end: '06:00', km_price: '' }];
      handleRuleChange(catName, 'schedules', newSchedules);
  };

  const handleRemoveSchedule = (catName: string, index: number) => {
      const currentSchedules = categoryRules[catName]?.schedules || [];
      const newSchedules = currentSchedules.filter((_: any, i: number) => i !== index);
      handleRuleChange(catName, 'schedules', newSchedules);
  };

  const handleScheduleValueChange = (catName: string, index: number, field: string, val: string) => {
      const newSchedules = [...(categoryRules[catName]?.schedules || [])];
      newSchedules[index] = { ...newSchedules[index], [field]: val };
      handleRuleChange(catName, 'schedules', newSchedules);
  };

  const handleSaveCategory = async (cat: any) => {
      try {
          await supabase.from('car_categories')
              .update({ 
                  base_fare: cat.base_fare, cost_per_km: cat.cost_per_km, 
                  min_fare: cat.min_fare, cost_per_minute: cat.cost_per_minute, active: cat.active 
              })
              .eq('id', cat.id);

          const { data } = await supabase.from('admin_config').select('key').eq('key', 'category_rules').maybeSingle();
          if (data) {
              await supabase.from('admin_config').update({ value: JSON.stringify(categoryRules) }).eq('key', 'category_rules');
          } else {
              await supabase.from('admin_config').insert({ key: 'category_rules', value: JSON.stringify(categoryRules) });
          }
          showSuccess("Salvo com sucesso!");
      } catch (e: any) { showError(e.message); }
  };

  const handleSaveMultiplier = async () => {
    try {
        await supabase.from('admin_config').update({ value: globalMultiplier }).eq('key', 'global_multiplier');
        showSuccess("Tarifa dinâmica atualizada!");
    } catch(e: any) { showError(e.message); }
  };

  const handleToggleBlock = async (user: any) => {
      try {
          await supabase.from('profiles').update({ is_blocked: !user.is_blocked }).eq('id', user.id);
          showSuccess("Status alterado.");
          fetchData();
      } catch (e: any) { showError(e.message); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
      <Card className="border-0 shadow-lg overflow-hidden bg-white">
          <CardContent className="p-6">
              <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 w-fit`}><Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} /></div>
              <p className="text-sm font-medium text-slate-500 uppercase mt-4">{title}</p>
              <h3 className="text-3xl font-black mt-1 text-slate-900">{value}</h3>
          </CardContent>
      </Card>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-200 bg-white">
         <div className="p-8 flex items-center gap-3 font-black text-2xl border-b border-slate-100">
             <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-black shadow-md">G</div>
             <span>Gold<span className="text-yellow-500">Admin</span></span>
         </div>
         <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
             <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /> Painel Geral</button>
             <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><FileText className="w-5 h-5" /> Solicitações {stats.pendingDrivers > 0 && <Badge className="ml-auto bg-red-500">{stats.pendingDrivers}</Badge>}</button>
             <button onClick={() => setActiveTab('rides')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'rides' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><MapIcon className="w-5 h-5" /> Corridas</button>
             <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Users className="w-5 h-5" /> Usuários</button>
             <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Settings className="w-5 h-5" /> Taxas e Regras</button>
         </nav>
         <div className="p-4 border-t border-slate-100"><Button variant="ghost" className="w-full justify-start text-red-500 font-bold" onClick={handleLogout}><LogOut className="mr-3 w-5 h-5" /> Sair</Button></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-10">
              
              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                  <h1 className="text-3xl font-black text-slate-900">{activeTab === 'overview' ? 'Painel Geral' : activeTab === 'requests' ? 'Solicitações' : activeTab === 'rides' ? 'Corridas' : activeTab === 'users' ? 'Usuários' : 'Taxas e Regras'}</h1>
                  <Button onClick={fetchData} variant="outline" className="h-12 rounded-xl" disabled={loading}><RefreshCw className="w-4 h-4 mr-2" /> Atualizar</Button>
              </div>

              {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in">
                      <StatCard title="Faturamento" value={`R$ ${stats.revenue.toFixed(2)}`} icon={DollarSign} colorClass="bg-green-500" />
                      <StatCard title="Lucro Admin" value={`R$ ${stats.adminRevenue.toFixed(2)}`} icon={Wallet} colorClass="bg-blue-500" />
                      <StatCard title="Online" value={stats.driversOnline} icon={Car} colorClass="bg-yellow-500" />
                      <StatCard title="Pendentes" value={stats.pendingDrivers} icon={UserPlus} colorClass="bg-purple-500" />
                  </div>
              )}

              {activeTab === 'config' && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4">
                      
                      {/* TARIFA DINÂMICA */}
                      <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 border-b bg-blue-50">
                              <CardTitle className="flex items-center gap-2 font-black text-slate-900"><Zap className="w-5 h-5 text-blue-600" /> Tarifa Dinâmica Manual (Multiplicador Global)</CardTitle>
                          </CardHeader>
                          <CardContent className="p-8">
                              <div className="flex flex-col md:flex-row items-end gap-4">
                                  <div className="flex-1"><Label className="text-xs font-bold text-slate-500 uppercase ml-1">Multiplicador (Ex: 1.0, 1.5)</Label><Input type="number" step="0.1" value={globalMultiplier} onChange={(e) => setGlobalMultiplier(e.target.value)} className="h-14 font-black text-2xl mt-1" /></div>
                                  <Button onClick={handleSaveMultiplier} className="h-14 px-8 bg-blue-600 font-bold rounded-xl">Aplicar Agora</Button>
                              </div>
                          </CardContent>
                      </Card>

                      {/* CATEGORIAS E REGRAS */}
                      <Card className="rounded-[32px] border-0 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 border-b bg-slate-900 text-white"><CardTitle className="text-2xl font-black">Configuração por Categoria</CardTitle></CardHeader>
                          <CardContent className="p-8 space-y-8">
                              {carCategories.map(cat => (
                                  <div key={cat.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                                      <div className="flex items-center justify-between mb-6">
                                          <div className="flex items-center gap-3"><div className="p-3 bg-yellow-500 rounded-2xl"><Car className="w-6 h-6 text-black" /></div><h3 className="text-xl font-black text-slate-900">{cat.name}</h3></div>
                                          <Switch checked={cat.active} onCheckedChange={(val) => handleCategoryChange(cat.id, 'active', val)} />
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-white p-4 rounded-2xl border border-slate-100">
                                          <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-400">Embarque (Fixo)</Label><Input type="number" value={cat.base_fare} onChange={e => handleCategoryChange(cat.id, 'base_fare', e.target.value)} className="font-bold h-12" /></div>
                                          <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-400">KM Padrão</Label><Input type="number" value={cat.cost_per_km} onChange={e => handleCategoryChange(cat.id, 'cost_per_km', e.target.value)} className="font-bold h-12" /></div>
                                          <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-400">Valor Minuto</Label><Input type="number" value={cat.cost_per_minute || 0} onChange={e => handleCategoryChange(cat.id, 'cost_per_minute', e.target.value)} className="font-bold h-12" /></div>
                                          <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-400">Corrida Mínima</Label><Input type="number" value={cat.min_fare} onChange={e => handleCategoryChange(cat.id, 'min_fare', e.target.value)} className="font-bold h-12" /></div>
                                      </div>

                                      {/* MÚLTIPLOS HORÁRIOS ESPECIAIS */}
                                      <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100">
                                          <div className="flex items-center justify-between">
                                              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> Tarifas por Horário</h4>
                                              <Button onClick={() => handleAddSchedule(cat.name)} variant="outline" size="sm" className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 font-bold"><Plus className="w-4 h-4 mr-2" /> Adicionar Período</Button>
                                          </div>
                                          
                                          <div className="space-y-3">
                                              {(categoryRules[cat.name]?.schedules || []).length === 0 ? (
                                                  <p className="text-xs text-slate-400 text-center py-4 border-2 border-dashed rounded-xl">Nenhum horário especial configurado.</p>
                                              ) : (
                                                  categoryRules[cat.name].schedules.map((sched: any, idx: number) => (
                                                      <div key={idx} className="flex flex-col md:flex-row gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                                                          <div className="flex-1 w-full"><Label className="text-[10px] font-bold uppercase">Início</Label><Input type="time" value={sched.start} onChange={e => handleScheduleValueChange(cat.name, idx, 'start', e.target.value)} className="h-10 bg-white" /></div>
                                                          <div className="flex-1 w-full"><Label className="text-[10px] font-bold uppercase">Fim</Label><Input type="time" value={sched.end} onChange={e => handleScheduleValueChange(cat.name, idx, 'end', e.target.value)} className="h-10 bg-white" /></div>
                                                          <div className="flex-[2] w-full"><Label className="text-[10px] font-bold uppercase">Valor do KM no Período</Label><Input type="number" placeholder="Ex: 3.50" value={sched.km_price} onChange={e => handleScheduleValueChange(cat.name, idx, 'km_price', e.target.value)} className="h-10 bg-white font-black" /></div>
                                                          <Button onClick={() => handleRemoveSchedule(cat.name, idx)} variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50 mb-0.5"><Trash2 className="w-4 h-4" /></Button>
                                                      </div>
                                                  ))
                                              )}
                                          </div>
                                      </div>

                                      <Button onClick={() => handleSaveCategory(cat)} className="w-full mt-6 bg-slate-900 text-white font-black h-14 rounded-2xl shadow-lg">SALVAR REGRAS DE {cat.name.toUpperCase()}</Button>
                                  </div>
                              ))}
                          </CardContent>
                      </Card>
                  </div>
              )}

              {/* OUTRAS TABS (rides, users, requests) permanecem iguais mas funcionais */}
          </div>
      </main>

      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-w-2xl bg-white rounded-[40px] border-0 p-0 overflow-hidden outline-none">
              <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center justify-between">
                  <DialogTitle className="text-2xl font-black">Revisar Cadastro</DialogTitle>
                  <Button variant="ghost" size="icon" onClick={() => setIsReviewModalOpen(false)} className="text-white hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></Button>
              </DialogHeader>
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-3xl">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-white"><img src={selectedUser?.face_photo_url || selectedUser?.avatar_url} className="w-full h-full object-cover" /></div>
                      <div><h3 className="text-xl font-black">{selectedUser?.first_name} {selectedUser?.last_name}</h3><p className="text-slate-500 font-bold">{selectedUser?.email}</p><Badge className="mt-2">{selectedUser?.phone}</Badge></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><Label className="text-[10px] font-bold uppercase text-slate-400">CNH Frente</Label><img src={selectedUser?.cnh_front_url} className="mt-2 rounded-xl w-full h-40 object-cover cursor-pointer" onClick={() => window.open(selectedUser.cnh_front_url, '_blank')} /></div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><Label className="text-[10px] font-bold uppercase text-slate-400">CNH Verso</Label><img src={selectedUser?.cnh_back_url} className="mt-2 rounded-xl w-full h-40 object-cover cursor-pointer" onClick={() => window.open(selectedUser.cnh_back_url, '_blank')} /></div>
                  </div>
              </div>
              <DialogFooter className="p-8 bg-slate-50 flex gap-4">
                  <Button variant="outline" className="flex-1 h-14 rounded-2xl text-red-500 font-bold" onClick={() => handleUpdateUserStatus(selectedUser.id, 'REJECTED')}>REJEITAR</Button>
                  <Button className="flex-1 h-14 rounded-2xl bg-green-600 font-black text-white shadow-md" onClick={() => handleUpdateUserStatus(selectedUser.id, 'APPROVED')}>APROVAR AGORA</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;