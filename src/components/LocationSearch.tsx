"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationSearchProps {
  placeholder: string;
  icon?: React.ElementType;
  onSelect: (location: { lat: number; lon: number; display_name: string } | null) => void;
  initialValue?: string;
  className?: string;
  error?: boolean; 
  referenceLat?: number;
  referenceLon?: number;
}

const LocationSearch = ({ 
  placeholder, 
  icon: Icon = MapPin, 
  onSelect, 
  initialValue = "", 
  className = "",
  error = false,
  referenceLat,
  referenceLon
}: LocationSearchProps) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setQuery(initialValue || "");
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && isOpen) {
        setLoading(true);
        try {
          // Lógica para melhorar a busca com números:
          // Removemos vírgulas, pois a API Photon prefere espaços para separar o número da rua
          const cleanQuery = query.replace(/,/g, ' ').trim();
          
          let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=6&lang=pt`;
          
          if (referenceLat && referenceLon) {
              url += `&lat=${referenceLat}&lon=${referenceLon}`;
          }

          const response = await fetch(url);
          const data = await response.json();
          
          setResults(data.features || []);
        } catch (error) {
          console.error("Erro na busca:", error);
        } finally {
          setLoading(false);
        }
      } else if (query.length <= 2) {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, isOpen, referenceLat, referenceLon]);

  const formatPhotonAddress = (feature: any) => {
      const p = feature.properties;
      const parts = [];

      // Prioridade para o nome da rua e número
      const streetName = p.street || p.name;
      const houseNumber = p.housenumber;

      if (streetName && houseNumber) {
          parts.push(`${streetName}, ${houseNumber}`);
      } else if (streetName) {
          parts.push(streetName);
      } else if (p.name) {
          parts.push(p.name);
      }

      // Contexto geográfico (Bairro e Cidade)
      if (p.district) parts.push(p.district);
      if (p.city) parts.push(p.city);
      else if (p.town) parts.push(p.town);
      
      if (p.state) parts.push(p.state);

      return parts.join(', ');
  };

  const handleSelect = (feature: any) => {
    const fullAddress = formatPhotonAddress(feature);
    const [lon, lat] = feature.geometry.coordinates;

    setQuery(fullAddress);
    setIsOpen(false);
    
    onSelect({
      lat: lat,
      lon: lon,
      display_name: fullAddress
    });
  };

  const handleClear = () => {
      setQuery("");
      onSelect(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsOpen(true);
  };

  return (
    <div className={`relative group ${className}`} ref={containerRef}>
      <div className={`absolute left-4 top-4 z-10 transition-colors ${error ? "text-red-500" : "text-gray-400"}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <Input
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`pl-12 pr-10 h-14 bg-white text-slate-900 rounded-2xl transition-all shadow-sm font-medium placeholder:text-gray-400 relative z-20 focus:z-30 
            ${error ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : "border-gray-200"}`}
      />

      {query && (
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleClear}
            className="absolute right-2 top-2 z-30 hover:bg-transparent text-gray-400 hover:text-gray-600 h-10 w-10"
          >
              <X className="w-4 h-4" />
          </Button>
      )}

      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[9999] animate-in fade-in zoom-in-95 duration-200">
          {loading && (
            <div className="p-4 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}
          
          {!loading && results.map((item, index) => {
            const p = item.properties;
            const fullLabel = formatPhotonAddress(item);
            
            // Lógica de exibição: Título em destaque e endereço abaixo
            const mainTitle = p.street && p.housenumber ? `${p.street}, ${p.housenumber}` : (p.name || p.street || fullLabel.split(',')[0]);
            const subTitle = fullLabel.replace(mainTitle, '').replace(/^,\s*/, '').trim();

            return (
              <button
                key={index}
                onClick={() => handleSelect(item)}
                className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors flex items-start gap-3 cursor-pointer"
                type="button"
              >
                <div className="bg-slate-100 p-2 rounded-full shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">{mainTitle}</p>
                    {subTitle && <p className="text-xs text-gray-500 truncate">{subTitle}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;