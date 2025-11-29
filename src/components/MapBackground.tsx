import React from "react";

const MapBackground = () => {
  return (
    <div className="absolute inset-0 -z-10 bg-[#e5e7eb] overflow-hidden pointer-events-none opacity-60">
      {/* Padrão de grade para simular ruas */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `
            linear-gradient(#cbd5e1 2px, transparent 2px),
            linear-gradient(90deg, #cbd5e1 2px, transparent 2px)
          `,
          backgroundSize: '100px 100px',
          backgroundPosition: '-20px -20px'
        }}
      />
      
      {/* Ruas secundárias */}
      <div 
        className="absolute inset-0 opacity-40" 
        style={{
          backgroundImage: `
            linear-gradient(#e2e8f0 1px, transparent 1px),
            linear-gradient(90deg, #e2e8f0 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />

      {/* Simulação de um rio ou parque */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-100/30 transform skew-x-12" />
      <div className="absolute bottom-0 left-20 w-40 h-40 bg-green-100/40 rounded-full blur-3xl" />
    </div>
  );
};

export default MapBackground;