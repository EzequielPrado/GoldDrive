import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, ShieldCheck, User, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-extrabold text-white tracking-tight">
            GoMove <span className="text-blue-500">Premium</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            A plataforma de mobilidade mais avançada do mercado. 
            Experimente todos os lados da operação agora mesmo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          
          {/* Card Cliente */}
          <Card className="bg-white/10 border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer group backdrop-blur-sm" onClick={() => navigate('/client')}>
            <CardHeader>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <User className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Passageiro</CardTitle>
              <CardDescription className="text-gray-400">
                Solicite corridas, veja o mapa interativo e escolha categorias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="text-blue-400 p-0 group-hover:text-blue-300">
                Acessar App <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card Motorista */}
          <Card className="bg-white/10 border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer group backdrop-blur-sm" onClick={() => navigate('/driver')}>
            <CardHeader>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Car className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Motorista</CardTitle>
              <CardDescription className="text-gray-400">
                Gerencie ganhos, fique online e aceite corridas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="text-green-400 p-0 group-hover:text-green-300">
                Acessar Painel <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card Admin */}
          <Card className="bg-white/10 border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer group backdrop-blur-sm" onClick={() => navigate('/admin')}>
            <CardHeader>
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Administrador</CardTitle>
              <CardDescription className="text-gray-400">
                Configure preços, gerencie frota e crie banners.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="text-purple-400 p-0 group-hover:text-purple-300">
                Acessar Dashboard <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
      
      <div className="fixed bottom-0 w-full">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;