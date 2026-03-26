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

        const { data: settings } = await supabase.from('app_settings').select('*');
        if (settings) {
            const cashObj = settings.find(s => s.key === 'enable_cash');
            const walletObj = settings.find(s => s.key === 'enable_wallet');
            setAppSettings({
                enable_cash: cashObj ? cashObj.value : true,
                enable_wallet: walletObj ? walletObj.value : true
            });
        }

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

        try {
            const { data: couponsData, error: couponError } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
            if (couponsData && !couponError) setCoupons(couponsData);
        } catch (e) {}

    } catch (e: any) { 
        showError(e.message); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleSaveCategory = async (cat: any) => {
      try {
          const { error } = await supabase.from('car_categories')
              .update({ 
                  base_fare: cat.base_fare, 
                  cost_per_km: cat.cost_per_km, 
                  min_fare: cat.min_fare,
                  cost_per_minute: cat.cost_per_minute,
                  active: cat.active 
              })
              .eq('id', cat.id);
          if (error) throw error;

          const { data } = await supabase.from('admin_config').select('key').eq('key', 'category_rules').maybeSingle();
          if (data) {
              const { error: errUpdate } = await supabase.from('admin_config').update({ value: JSON.stringify(categoryRules) }).eq('key', 'category_rules');
              if (errUpdate) throw errUpdate;
          } else {
              const { error: errInsert } = await supabase.from('admin_config').insert({ key: 'category_rules', value: JSON.stringify(categoryRules) });
              if (errInsert) throw errInsert;
          }

          showSuccess("Taxas salvas!");
      } catch (e: any) {
          showError(e.message || "Erro ao salvar.");
      }
  };

  const handleRuleChange = (catName: string, field: string, val: string) => {
      setCategoryRules(prev => ({
          ...prev,
          [catName]: {
              ...(prev[catName] || {}),
              [field]: val
          }
      }));
  };

  const handleCategoryChange = (id: string, field: string, val: any) => {
      setCarCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-200 bg-white">
         <div className="p-8 flex items-center gap-3 font-black text-2xl border-b border-slate-100">
             <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-black shadow-md">G</div>
             <span className="text-slate-900">Gold<span className="text-yellow-500">Admin</span></span>
         </div>
         <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
             <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <LayoutDashboard className="w-5 h-5" /> Painel Geral
             </button>
             <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <FileText className="w-5 h-5" /> Solicitações {stats.pendingDrivers > 0 && <Badge className="ml-auto bg-red-500 text-white">{stats.pendingDrivers}</Badge>}
             </button>
             <button onClick={() => setActiveTab('rides')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'rides' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <MapIcon className="w-5 h-5" /> Corridas
             </button>
             <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <Users className="w-5 h-5" /> Usuários
             </button>
             <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <Settings className="w-5 h-5" /> Taxas e Configurações
             </button>
             <button onClick={() => setActiveTab('coupons')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'coupons' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                 <Ticket className="w-5 h-5" /> Cupons de Desconto
             </button>
         </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-10">
              
              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                  <h1 className="text-3xl font-black text-slate-900">Configurações do Sistema</h1>
                  <Button onClick={fetchData} variant="outline" className="h-12 rounded-xl" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Atualizar</Button>
              </div>

              {activeTab === 'config' && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                      <Card className="rounded-[32px] border border-slate-100 shadow-xl overflow-hidden bg-white">
                          <CardHeader className="p-8 bg-slate-900 text-white">
                              <CardTitle className="text-2xl font-black">Preços por Categoria</CardTitle>
                              <CardDescription className="text-slate-400">Configure as taxas base e tarifas especiais (Noturna e Faixas).</CardDescription>
                          </CardHeader>
                          <CardContent className="p-8 space-y-8">
                              {carCategories.map(cat => (
                                  <div key={cat.id} className={`p-6 rounded-3xl border ${cat.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                      <div className="flex items-center justify-between mb-6">
                                          <div className="flex items-center gap-3">
                                              <div className="p-3 bg-yellow-500 rounded-2xl text-black shadow-sm"><Car className="w-6 h-6" /></div>
                                              <div><h3 className="font-black text-xl text-slate-900">{cat.name}</h3><p className="text-xs text-slate-500">Configurações para esta modalidade</p></div>
                                          </div>
                                          <Switch checked={cat.active} onCheckedChange={(val) => handleCategoryChange(cat.id, 'active', val)} />
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                          <div className="space-y-2">
                                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Embarque Fixo (R$)</Label>
                                              <Input type="number" step="0.01" value={cat.base_fare} onChange={e => handleCategoryChange(cat.id, 'base_fare', e.target.value)} className="h-12 font-black text-lg" />
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">KM Padrão (R$)</Label>
                                              <Input type="number" step="0.01" value={cat.cost_per_km} onChange={e => handleCategoryChange(cat.id, 'cost_per_km', e.target.value)} className="h-12 font-black text-lg" />
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Minuto (Tempo) (R$)</Label>
                                              <Input type="number" step="0.01" value={cat.cost_per_minute || 0} onChange={e => handleCategoryChange(cat.id, 'cost_per_minute', e.target.value)} className="h-12 font-black text-lg" />
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Corrida Mínima (R$)</Label>
                                              <Input type="number" step="0.01" value={cat.min_fare} onChange={e => handleCategoryChange(cat.id, 'min_fare', e.target.value)} className="h-12 font-black text-lg" />
                                          </div>
                                      </div>

                                      {/* TARIFA NOTURNA SECTION */}
                                      <div className="bg-slate-900 rounded-[24px] p-6 mb-8 text-white">
                                          <div className="flex items-center gap-2 mb-6"><Moon className="w-5 h-5 text-blue-400" /><h4 className="font-black uppercase text-xs tracking-widest">Tarifa Noturna Especial</h4></div>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                              <div className="space-y-2">
                                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KM Noturno (R$)</Label>
                                                  <Input type="number" step="0.01" value={categoryRules[cat.name]?.night_km || ''} onChange={e => handleRuleChange(cat.name, 'night_km', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-12 font-black" placeholder="Ex: 3.50" />
                                                  <p className="text-[9px] text-slate-500">Valor que substituirá o KM padrão no horário definido.</p>
                                              </div>
                                              <div className="space-y-2">
                                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início (Horário)</Label>
                                                  <Input type="time" value={categoryRules[cat.name]?.night_start || ''} onChange={e => handleRuleChange(cat.name, 'night_start', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-12" />
                                              </div>
                                              <div className="space-y-2">
                                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fim (Horário)</Label>
                                                  <Input type="time" value={categoryRules[cat.name]?.night_end || ''} onChange={e => handleRuleChange(cat.name, 'night_end', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-12" />
                                              </div>
                                          </div>
                                      </div>

                                      <Button onClick={() => handleSaveCategory(cat)} className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black text-lg rounded-2xl shadow-xl">SALVAR ALTERAÇÕES DE {cat.name.toUpperCase()}</Button>
                                  </div>
                              ))}
                          </CardContent>
                      </Card>
                  </div>
              )}
          </div>
      </main>
    </div>
  );
};

export default AdminDashboard;