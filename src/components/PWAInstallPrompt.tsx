import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share, MoreVertical, PlusSquare, X, MoreHorizontal, Download, Smartphone } from "lucide-react";

interface PWAProps {
    openForce?: boolean;
    onCloseForce?: () => void;
}

const PWAInstallPrompt = ({ openForce, onCloseForce }: PWAProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Detecta iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // 2. Captura o evento de instalação (Android/Desktop)
    const handler = (e: any) => {
      e.preventDefault(); // Impede o mini-infobar padrão
      setDeferredPrompt(e); // Guarda o evento para usar no botão
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 3. Lógica de Abertura
    const hasDismissed = localStorage.getItem('pwa_install_dismissed_v2');
    
    if (openForce) {
        setIsOpen(true);
    } else if (!hasDismissed) {
        const timer = setTimeout(() => setIsOpen(true), 2000);
        return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [openForce]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Mostra o prompt nativo
    deferredPrompt.prompt();
    
    // Espera a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        setDeferredPrompt(null);
        handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed_v2', 'true');
    setIsOpen(false);
    if (onCloseForce) onCloseForce();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md bg-white rounded-[32px] border-0 p-0 overflow-hidden">
        
        {/* Header Visual */}
        <div className="bg-yellow-500 p-6 text-center relative">
            <button 
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-black/50 hover:text-black transition-colors z-10"
            >
                <X className="w-6 h-6" />
            </button>
            <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-lg shadow-black/10">
                <Download className="w-8 h-8 text-black" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900">Baixar App</DialogTitle>
            <DialogDescription className="text-slate-900/80 font-medium">
                Instale o Gold Mobile para uma experiência melhor.
            </DialogDescription>
        </div>
        
        <div className="p-6">
            {/* SE TIVER O PROMPT NATIVO (ANDROID), MOSTRA BOTÃO DIRETO */}
            {deferredPrompt ? (
                <div className="space-y-4 text-center animate-in zoom-in-95">
                    <p className="text-slate-600">Clique abaixo para instalar automaticamente:</p>
                    <Button 
                        onClick={handleInstallClick}
                        className="w-full h-16 rounded-2xl bg-slate-900 text-white hover:bg-zinc-800 font-black text-lg shadow-xl flex items-center justify-center gap-3 animate-pulse"
                    >
                        <Smartphone className="w-6 h-6" /> INSTALAR AGORA
                    </Button>
                    <p className="text-xs text-gray-400">Rápido, seguro e não ocupa memória.</p>
                </div>
            ) : (
                /* SE NÃO TIVER PROMPT (IOS OU JÁ INSTALADO), MOSTRA TUTORIAL */
                <Tabs defaultValue={isIOS ? "ios" : "android"} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 p-1 rounded-xl">
                    <TabsTrigger value="ios" className="rounded-lg font-bold">iPhone (iOS)</TabsTrigger>
                    <TabsTrigger value="android" className="rounded-lg font-bold">Android</TabsTrigger>
                  </TabsList>
                  
                  {/* ABA IOS */}
                  <TabsContent value="ios" className="space-y-4 animate-in slide-in-from-right-2">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tutorial de Instalação</p>
                          
                          <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                              <p className="text-sm text-slate-700">Clique no botão de <span className="font-bold">Compartilhar</span> <Share className="w-3 h-3 inline" />.</p>
                          </div>

                          <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                              <p className="text-sm text-slate-700">Role para cima no menu que abriu.</p>
                          </div>

                          <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                              <p className="text-sm text-slate-700">Toque em <span className="font-bold">Adicionar à Tela de Início</span> <PlusSquare className="w-3 h-3 inline" />.</p>
                          </div>

                          <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">4</div>
                              <p className="text-sm text-slate-700">Confirme clicando em <span className="font-bold">Adicionar</span>.</p>
                          </div>
                      </div>
                  </TabsContent>

                  {/* ABA ANDROID MANUAL (CASO O BOTÃO AUTOMÁTICO FALHE) */}
                  <TabsContent value="android" className="space-y-4 animate-in slide-in-from-right-2">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Instalação Manual</p>
                          
                          <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                              <p className="text-sm text-slate-700">Toque nos <span className="font-bold">3 pontinhos</span> <MoreVertical className="w-3 h-3 inline" /> no canto superior.</p>
                          </div>
                          
                          <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                              <p className="text-sm text-slate-700">Selecione <span className="font-bold">Instalar aplicativo</span> ou <span className="font-bold">Adicionar à tela inicial</span>.</p>
                          </div>
                      </div>
                  </TabsContent>
                </Tabs>
            )}
        </div>

        <div className="p-6 pt-0">
            <Button onClick={handleDismiss} variant={deferredPrompt ? "ghost" : "default"} className={`w-full h-14 rounded-2xl font-bold text-lg ${deferredPrompt ? 'text-gray-500' : 'bg-slate-900 text-white hover:bg-zinc-800'}`}>
                {deferredPrompt ? "Agora não" : "Entendi"}
            </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default PWAInstallPrompt;