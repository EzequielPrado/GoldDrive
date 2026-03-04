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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Dados Principais
  const [stats, setStats] = useState({ revenue: 0, adminRevenue: 0, driverEarnings: 0, ridesToday: 0, ridesWeek: 0, ridesMonth: 0, activeRides: 0, driversOnline: 0 });
  const [rides, setRides] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]); 
  const [transactions, setTransactions] = useState<any[]>([]);

  // Estados de Gerenciamento Detalhado
  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailUserHistory, setDetailUserHistory] = useState<any[]>([]);
  const [detailUserStats, setDetailUserStats] = useState({ totalSpent: 0, totalRides: 0, avgRating: 5.0 });
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isEditingInDetail, setIsEditingInDetail] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [reviewDriver, setReviewDriver] = useState<any>(null);
  const [justApproved, setJustApproved] = useState(false);
  
  const [showNightSaveAlert, setShowNightSaveAlert] = useState(false);
  const [showTableSaveAlert, setShowTableSaveAlert] = useState(false);
  const [isSavingGold, setIsSavingGold] = useState(false);
  
  const [editFormData, setEditFormData] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [config, setConfig] = useState({ platformFee: "10", enableCash: true, enableWallet: true, isSubscriptionMode: false, enableCancellationFee: true });
  const [pricingTiers, setPricingTiers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [adminConfigs, setAdminConfigs] = useState({
      night_active: "true", night_start: "21:00", night_end: "00:00", night_increase: "3", midnight_min_price: "25",
      platform_fee: "10", pricing_strategy: "FIXED", cancellation_fee_type: "FIXED", cancellation_fee_value: "5.00", gps_popup_enabled: "false"
  });

  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("DEFAULT");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, [activeTab, filterStatus]);

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) setAdminProfile(profile);

        let ridesQuery = supabase.from('rides').select(`*, driver:profiles!public_rides_driver_id_fkey(*), customer:profiles!public_rides_customer_id_fkey(*)`).order('created_at', { ascending: false });
        if (filterStatus === 'DEFAULT') ridesQuery = ridesQuery.not('status', 'eq', 'SEARCHING');
        else if (filterStatus !== 'ALL') ridesQuery = ridesQuery.eq('status', filterStatus);

        const [ridesRes, profilesRes, settingsRes, pricingRes, catRes, adminConfigRes] = await Promise.all([
            ridesQuery, supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('app_settings').select('*'), supabase.from('pricing_tiers').select('*').order('max_distance', { ascending: true }),
            supabase.from('car_categories').select('*').order('base_fare', { ascending: true }), supabase.from('admin_config').select('*')
        ]);

        if (ridesRes.data) setRides(ridesRes.data);
        if (profilesRes.data) {
            setPassengers(profilesRes.data.filter((p: any) => p.role === 'client'));
            const allDrivers = profilesRes.data.filter((p: any) => p.role === 'driver');
            setDrivers(allDrivers);
            setPendingDrivers(allDrivers.filter((p: any) => p.driver_status === 'PENDING'));
        }
        if (settingsRes.data) {
            const getVal = (k: string) => settingsRes.data.find(s => s.key === k)?.value;
            setConfig({ platformFee: config.platformFee, enableCash: getVal('enable_cash')??true, enableWallet: getVal('enable_wallet')??true, isSubscriptionMode: getVal('is_subscription_mode')??false, enableCancellationFee: getVal('enable_cancellation_fee')??true });
        }
        if (pricingRes.data) setPricingTiers(pricingRes.data);
        if (catRes.data) setCategories(catRes.data);
        if (adminConfigRes.data) {
            const newConf: any = {};
            adminConfigRes.data.forEach((item: any) => newConf[item.key] = item.value);
            setAdminConfigs(prev => ({ ...prev, ...newConf }));
        }

        const comp = (ridesRes.data || []).filter((r: any) => r.status === 'COMPLETED');
        setStats({
            revenue: comp.reduce((a, r) => a + Number(r.price), 0),
            adminRevenue: comp.reduce((a, r) => a + Number(r.platform_fee), 0),
            driverEarnings: comp.reduce((a, r) => a + Number(r.driver_earnings), 0),
            ridesToday: (ridesRes.data || []).filter((r: any) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
            ridesWeek: (ridesRes.data || []).length,
            ridesMonth: (ridesRes.data || []).length,
            activeRides: (ridesRes.data || []).filter((r: any) => ['IN_PROGRESS', 'ARRIVED', 'ACCEPTED'].includes(r.status)).length,
            driversOnline: profilesRes.data?.filter((p: any) => p.role === 'driver' && p.is_online).length || 0
        });
    } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const handleSaveConfig = async () => {
      setLoading(true); setShowNightSaveAlert(false); setShowTableSaveAlert(false);
      try { 
          await supabase.from('app_settings').upsert([ 
              { key: 'enable_cash', value: config.enableCash }, { key: 'enable_wallet', value: config.enableWallet }, 
              { key: 'is_subscription_mode', value: config.isSubscriptionMode }, { key: 'enable_cancellation_fee', value: config.enableCancellationFee }
          ]);
          const updates = Object.entries(adminConfigs).map(([key, value]) => ({ key, value }));
          await supabase.from('admin_config').upsert(updates);
          
          for (const tier of pricingTiers) { 
              if (tier.id.startsWith('new-')) {
                  await supabase.from('pricing_tiers').insert({ label: tier.label, price: Number(tier.price), max_distance: Number(tier.max_distance) });
              } else {
                  await supabase.from('pricing_tiers').update({ label: tier.label, price: Number(tier.price), max_distance: Number(tier.max_distance) }).eq('id', tier.id);
              }
          }
          showSuccess("Salvo com sucesso!"); fetchData();
      } catch (e: any) { showError(e.message); } finally { setLoading(false); }
  };

  const handleAddPriceTier = () => {
      setPricingTiers(prev => [...prev, { id: `new-${Date.now()}`, label: "Nova Faixa", price: "15", max_distance: "5" }]);
  };

  const updatePriceTier = (id: string, field: string, value: any) => { setPricingTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t)); };
  const updateCategory = (id: string, field: string, value: any) => { setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c)); };

  const goldDriverCategory = categories.find(c => c.name === 'Gold Driver');
  const dynamicCategories = categories.filter(c => c.name !== 'Gold Driver');

  const StatCard = ({ title, value, icon: Icon, colorClass, subtext, description }: any) => (
      <Card className="border-0 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] overflow-hidden relative group">
          <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 ${colorClass}`}><Icon className="w-24 h-24" /></div>
          <CardContent className="p-6 relative z-10"><div className="flex justify-between items-start mb-4"><div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 text-white`}><Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} /></div></div><p className="text-sm font-medium text-muted-foreground uppercase">{title}</p><h3 className="text-3xl font-black mt-1">{value}</h3></CardContent>
      </Card>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-foreground overflow-hidden">
      <aside className={`hidden lg:flex flex-col z-20 border-r bg-white/80 dark:bg-slate-900/80 backdrop-blur-md ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
         <div className="p-6 flex items-center justify-between font-black text-2xl"><span>Gold<span className="text-yellow-500">Admin</span></span></div>
         <nav className="flex-1 px-4 space-y-2 mt-4">
             {[{ id: 'overview', label: 'Painel Geral', icon: LayoutDashboard }, { id: 'requests', label: 'Solicitações', icon: FileText, badge: pendingDrivers.length }, { id: 'rides', label: 'Corridas', icon: MapIcon }, { id: 'config', label: 'Configurações', icon: Settings }].map(item => (
                 <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold ${activeTab === item.id ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-slate-100'}`}>
                     <item.icon className="w-5 h-5" />{!sidebarCollapsed && <span>{item.label}</span>}{item.badge ? <Badge className="ml-auto bg-red-500">{item.badge}</Badge> : null}
                 </button>))}
         </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
              <h1 className="text-4xl font-black capitalize">{activeTab}</h1>
              
              {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><StatCard title="Valor Total" value={`R$ ${stats.revenue.toFixed(2)}`} icon={DollarSign} colorClass="bg-green-500" /><StatCard title="Lucro Plataforma" value={`R$ ${stats.adminRevenue.toFixed(2)}`} icon={Wallet} colorClass="bg-blue-500" /><StatCard title="Pendentes" value={pendingDrivers.length} icon={FileText} colorClass="bg-yellow-500" /></div>
              )}

              {activeTab === 'config' && (
                  <Tabs defaultValue="values" className="w-full">
                      <TabsList className="mb-6"><TabsTrigger value="general">Geral</TabsTrigger><TabsTrigger value="values">Valores Gold Driver</TabsTrigger></TabsList>
                      <TabsContent value="general" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="rounded-[32px] p-6 shadow-xl">
                              <CardHeader><CardTitle>Regras do App</CardTitle></CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="flex items-center justify-between"><Label>Modo Mensalidade (Zero Taxas)</Label><Switch checked={config.isSubscriptionMode} onCheckedChange={(v) => setConfig({...config, isSubscriptionMode: v})} /></div>
                                  <div className="flex items-center justify-between"><Label>Ativar Multa Cancelamento</Label><Switch checked={config.enableCancellationFee} onCheckedChange={(v) => setConfig({...config, enableCancellationFee: v})} /></div>
                              </CardContent>
                              <CardFooter><Button onClick={handleSaveConfig} className="w-full bg-black text-white">Salvar Geral</Button></CardFooter>
                          </Card>
                      </TabsContent>
                      <TabsContent value="values">
                          <Card className="rounded-[32px] overflow-hidden shadow-2xl">
                              <CardHeader className="bg-yellow-500 p-8"><CardTitle className="text-3xl font-black">Preços por Distância</CardTitle><CardDescription className="text-black/80">Configure os valores exatos para a categoria Gold Driver.</CardDescription></CardHeader>
                              <CardContent className="p-0">
                                  <Table>
                                      <TableHeader><TableRow><TableHead className="pl-8">Descrição da Faixa</TableHead><TableHead>KM Máximo</TableHead><TableHead>Preço (R$)</TableHead><TableHead className="text-right pr-8">Ação</TableHead></TableRow></TableHeader>
                                      <TableBody>{pricingTiers.map(t => (
                                          <TableRow key={t.id}><TableCell className="pl-8"><Input value={t.label} onChange={e => updatePriceTier(t.id, 'label', e.target.value)} className="border-0 bg-transparent font-bold" /></TableCell>
                                          <TableCell><Input type="number" value={t.max_distance} onChange={e => updatePriceTier(t.id, 'max_distance', e.target.value)} className="w-24 rounded-xl" /></TableCell>
                                          <TableCell><div className="flex items-center gap-1"><span>R$</span><Input type="number" value={t.price} onChange={e => updatePriceTier(t.id, 'price', e.target.value)} className="w-24 rounded-xl font-black" /></div></TableCell>
                                          <TableCell className="text-right pr-8"><Button variant="ghost" size="icon" className="text-red-500" onClick={async () => { await supabase.from('pricing_tiers').delete().eq('id', t.id); fetchData(); }}><Trash2 className="w-4 h-4" /></Button></TableCell></TableRow>
                                      ))}</TableBody>
                                  </Table>
                                  <div className="p-6 flex gap-4"><Button onClick={handleAddPriceTier} variant="outline" className="rounded-xl h-12"><Plus className="mr-2 w-4 h-4" /> Nova Faixa</Button><Button onClick={handleSaveConfig} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold h-12">SALVAR TABELA DE PREÇOS</Button></div>
                              </CardContent>
                          </Card>
                      </TabsContent>
                  </Tabs>
              )}
          </div>
      </main>
    </div>
  );
};

export default AdminDashboard;