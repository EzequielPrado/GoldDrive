import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationSearchProps {
  placeholder: string;
  icon?: React.ElementType;
  onSelect: (location: { lat: number; lon: number; display_name: string }) => void;
  initialValue?: string;
  className?: string;
}

const LocationSearch = ({ placeholder, icon: Icon = MapPin, onSelect, initialValue = "", className = "" }: LocationSearchProps) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha a lista se clicar fora
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
    setQuery(initialValue);
  }, [initialValue]);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && isOpen) {
        setLoading(true);
        try {
          // Usa Nominatim (OpenStreetMap) para geocoding gratuito
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
    }, 500); // Aguarda 500ms após parar de digitar

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelect = (item: any) => {
    // Formata o endereço para ficar mais limpo
    const street = item.address.road || item.address.pedestrian || "";
    const number = item.address.house_number || "";
    const city = item.address.city || item.address.town || item.address.municipality || "";
    
    const formattedAddress = street ? `${street}${number ? `, ${number}` : ''} - ${city}` : item.display_name.split(',')[0];

    setQuery(formattedAddress);
    setIsOpen(false);
    onSelect({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: formattedAddress
    });
  };

  const handleClear = () => {
      setQuery("");
      onSelect({ lat: 0, lon: 0, display_name: "" });
  };

  return (
    <div className={`relative group ${className}`} ref={containerRef}>
      <div className="absolute left-4 top-4 z-10 text-gray-400">
        <Icon className="w-5 h-5" />
      </div>
      
      <Input
        value={query}
        onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="pl-12 pr-10 h-14 bg-white border-gray-200 text-slate-900 rounded-2xl transition-all shadow-sm font-medium placeholder:text-gray-400"
      />

      {query && (
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleClear}
            className="absolute right-2 top-2 hover:bg-transparent text-gray-400 hover:text-gray-600 h-10 w-10"
          >
              <X className="w-4 h-4" />
          </Button>
      )}

      {/* Lista de Resultados */}
      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
          {loading && (
            <div className="p-4 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}
          
          {!loading && results.map((item, index) => (
            <button
              key={index}
              onClick={() => handleSelect(item)}
              className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors flex items-start gap-3"
            >
              <div className="bg-gray-100 p-2 rounded-full shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                  <p className="font-bold text-sm text-slate-900 line-clamp-1">{item.address.road || item.display_name.split(',')[0]}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{item.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;