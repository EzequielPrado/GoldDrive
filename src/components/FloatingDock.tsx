import React from "react";
import { Home, Clock, User } from "lucide-react";

interface FloatingDockProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  role: 'client' | 'driver';
}

const FloatingDock = ({ activeTab, onTabChange, role }: FloatingDockProps) => {
  const items = [
    { id: 'home', icon: Home, label: 'Início' },
    { id: 'history', icon: Clock, label: 'Viagens' },
    { id: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[90%]">
      {/* Liquid Glass Container */}
      <div className="flex items-center gap-1 p-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl shadow-black/50">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
                isActive 
                  ? "bg-white/20 text-yellow-400 translate-y-[-8px] shadow-lg shadow-yellow-500/20" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
              
              {/* Dot indicator */}
              {isActive && (
                <span className="absolute -bottom-2 w-1 h-1 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingDock;