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
}

const LocationSearch = ({ 
  placeholder, 
  icon: Icon = MapPin, 
  onSelect, 
  initialValue = "", 
  className = "",
  error = false 
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
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`
          );
          const data = await response.json();
          setResults(data);
        } catch (error) {
          console.error("Erro na busca:", error);
        } finally {
          setLoading(false);
        }
      } else if (query.length <= 2) {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Função auxiliar para formatar endereço limpo
  const formatAddress = (item: any) => {
      const addr = item.address;
      const road = addr.road || addr.pedestrian || addr.street || item.name || "";
      const number = addr.house_number || "";
      const suburb = addr.suburb || addr.neighbourhood || addr.district || "";
      const city = addr.city || addr.town || addr.municipality || "";
      const state = addr.state_code || addr.state || "";

      // Monta string: Rua X, 123 - Bairro
      let parts = [];
      if (road) parts.push(road);
      if (number) parts.push(number);
      
      let mainPart = parts.join(", ");
      
      // Adiciona bairro se existir
      if (suburb) mainPart += ` - ${suburb}`;
      // Adiciona cidade/UF se existir
      if (city) mainPart += ` - ${city}`;
      
      return mainPart || item.display_name;
  };

  const handleSelect = (item: any) => {
    const cleanAddress = formatAddress(item);

    setQuery(cleanAddress);
    setIsOpen(false);
    onSelect({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: cleanAddress // Agora passamos o endereço limpo para o sistema
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
            const cleanTitle = formatAddress(item);
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
                    <p className="font-bold text-sm text-slate-900 line-clamp-1">{cleanTitle.split('-')[0]}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">{cleanTitle}</p>
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