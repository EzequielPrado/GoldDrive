import React, { Component, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, XCircle, Terminal } from 'lucide-react';

// 1. Ouvinte Global para erros de Script e Promessas (Não-React)
export const GlobalListeners = () => {
  useEffect(() => {
    // Captura erros de execução JS e recursos não carregados
    const handleError = (event: ErrorEvent) => {
      console.error("System Error Detected:", event.error);
      toast.error("Erro Interno do Sistema", {
        description: event.message || "Ocorreu uma falha inesperada no processamento.",
        duration: 8000,
        icon: <Terminal className="h-5 w-5 text-red-600" />,
        action: {
            label: "Detalhes (Console)",
            onClick: () => console.log(event)
        }
      });
    };

    // Captura erros de Promises (Supabase, APIs, Async functions)
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Process Error:", event.reason);
      const msg = event.reason?.message || event.reason || "Falha no processamento assíncrono.";
      
      // Filtra erros comuns de cancelamento que não precisam de alerta
      if (typeof msg === 'string' && (msg.includes('cancelled') || msg.includes('Aborted'))) return;

      toast.error("Falha de Processamento", {
        description: typeof msg === 'string' ? msg.substring(0, 100) : "Erro de conexão ou dados.",
        duration: 5000,
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
};

// 2. Error Boundary para erros de Renderização (React Components)
interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Render Error:", error, errorInfo);
    toast.error("Erro Visual Crítico", {
        description: "Um componente falhou ao renderizar. Tente recarregar.",
        duration: 10000,
        icon: <XCircle className="h-5 w-5 text-red-600" />
    });
  }

  render() {
    if (this.state.hasError) {
       return (
         <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-6 text-center font-sans">
            <div className="w-24 h-24 bg-red-100 rounded-[32px] flex items-center justify-center mb-6 shadow-xl shadow-red-100">
                <XCircle className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Ops! Algo quebrou.</h1>
            <p className="text-gray-500 mb-6 max-w-md">
                O sistema encontrou um erro crítico e não conseguiu exibir esta tela.
            </p>
            <div className="bg-white border border-gray-200 p-4 rounded-xl mb-8 max-w-md text-left w-full overflow-hidden">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Detalhe técnico:</p>
                <code className="text-xs text-red-500 font-mono block break-words">
                    {this.state.error?.message || "Erro desconhecido"}
                </code>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="bg-black text-white px-8 py-4 rounded-2xl font-bold hover:bg-zinc-800 shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
                Recarregar Aplicação
            </button>
         </div>
       );
    }
    return this.props.children;
  }
}