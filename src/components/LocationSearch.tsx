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
          // Usando Photon API em vez de Nominatim para melhor Fuzzy Search (espaços, erros)
          let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
          
          // Se tivermos a localização do usuário, priorizamos resultados próximos
          if (referenceLat && referenceLon) {
              url += `&lat=${referenceLat}&lon=${referenceLon}`;
          }

          const response = await fetch(url);
          const data = await response.json();
          
          // Photon retorna GeoJSON
          setResults(data.features || []);
        } catch (error) {
          console.error("Erro na busca:", error);
        } finally {
          setLoading(false);
        }
      } else if (query.length <= 2) {
        setResults([]);
      }
    }, 400); // Debounce um pouco menor para parecer mais rápido

    return () => clearTimeout(timer);
  }, [query, isOpen, referenceLat, referenceLon]);

  // Formatador inteligente para o Photon
  const formatPhotonAddress = (feature: any) => {
      const p = feature.properties;
      const parts = [];

      // Nome do lugar ou rua principal
      if (p.name) parts.push(p.name);
      else if (p.street) parts.push(p.street);
      
      // Se tiver nome E rua, adiciona a rua como contexto
      if (p.name && p.street) parts.push(p.street);

      if (p.housenumber) parts.push(p.housenumber);
      
      // Bairro ou Cidade
      if (p.district) parts.push(p.district);
      else if (p.city) parts.push(p.city);
      else if (p.town) parts.push(p.town);
      
      // Estado (opcional para ficar curto)
      // if (p.state) parts.push(p.state);

      return parts.join(', ');
  };

  const handleSelect = (feature: any) => {
    const cleanAddress = formatPhotonAddress(feature);
    const [lon, lat] = feature.geometry.coordinates; // GeoJSON é Lon, Lat

    setQuery(cleanAddress);
    setIsOpen(false);
    
    onSelect({
      lat: lat,
      lon: lon,
      display_name: cleanAddress
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
        <div className="absolute top-12 left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[9999] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          {loading && (
            <div className="p-4 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}
          
          {!loading && results.map((item, index) => {
            const cleanTitle = formatPhotonAddress(item);
            const mainName = item.properties.name || item.properties.street || cleanTitle.split(',')[0];
            const secondaryInfo = cleanTitle.replace(mainName, '').replace(/^,\s*/, '') || item.properties.city || item.properties.state;

            return (
              <button
                key={index}
                onClick={() => handleSelect(item)}
                className="w-full text-left p-4 hover:bg-gray-100 border-b border-gray-50 last:border-0 transition-colors flex items-start gap-3 cursor-pointer relative z-[10000]"
                type="button"
              >
                <div className="bg-gray-100 p-2 rounded-full shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                    <p className="font-bold text-sm text-slate-900 line-clamp-1">{mainName}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{secondaryInfo}</p>
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