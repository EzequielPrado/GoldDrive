import React, { useState } from "react";
import { 
  BarChart, Activity, Users, DollarSign, Settings, 
  Car, Image as ImageIcon, Save 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { showSuccess } from "@/utils/toast";

const AdminDashboard = () => {
  const [basePrice, setBasePrice] = useState("5.00");
  const [kmPrice, setKmPrice] = useState("2.50");
  const [minPrice, setMinPrice] = useState("8.00");

  const handleSaveSettings = () => {
    showSuccess("Configurações globais atualizadas com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Painel Administrativo</h1>
            <p className="text-gray-500">Gerencie sua frota, receitas e configurações do app.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <Activity className="w-4 h-4" /> Sistema Online
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 45.231,89</div>
              <p className="text-xs text-muted-foreground">+20.1% em relação ao mês passado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Corridas Ativas</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+573</div>
              <p className="text-xs text-muted-foreground">+201 na última hora</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Motoristas Online</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,350</div>
              <p className="text-xs text-muted-foreground">85% da frota ativa</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="settings">Configurações de Preço</TabsTrigger>
            <TabsTrigger value="categories">Categorias de Carros</TabsTrigger>
            <TabsTrigger value="marketing">Banners & Marketing</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Precificação Dinâmica</CardTitle>
                <CardDescription>
                  Configure os valores base para o cálculo das corridas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Preço Base (Bandeirada)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                      <Input 
                        value={basePrice} 
                        onChange={(e) => setBasePrice(e.target.value)} 
                        className="pl-9" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Custo por Km</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                      <Input 
                        value={kmPrice} 
                        onChange={(e) => setKmPrice(e.target.value)} 
                        className="pl-9" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Mínimo da Corrida</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                      <Input 
                        value={minPrice} 
                        onChange={(e) => setMinPrice(e.target.value)} 
                        className="pl-9" 
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <Switch id="surge-pricing" />
                  <Label htmlFor="surge-pricing">Ativar Tarifa Dinâmica (Alta Demanda)</Label>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSaveSettings}>
                    <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Categorias de Veículos</CardTitle>
                <CardDescription>Gerencie os tipos de serviços disponíveis.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Econômico (Hatch)', 'Confort (Sedan)', 'Black (Luxo)', 'Entrega (Moto)'].map((cat, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Car className="w-5 h-5 text-gray-600" />
                        </div>
                        <span className="font-medium">{cat}</span>
                      </div>
                      <Switch defaultChecked={true} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
           <TabsContent value="marketing">
            <Card>
              <CardHeader>
                <CardTitle>Banners Promocionais</CardTitle>
                <CardDescription>O que os clientes veem na tela inicial.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition cursor-pointer">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <span className="mt-2 block text-sm font-semibold text-gray-900">
                      Adicionar novo banner
                    </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;