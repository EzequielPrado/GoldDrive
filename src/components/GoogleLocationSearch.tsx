"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { showError } from "@/utils/toast";

interface LocationSearchProps {
  placeholder: string;
  icon?: React.ElementType;
  onSelect: (location: { lat: number; lon: number; display_name: string } | null) => void;
  initialValue?: string;
  className?: string;
  error?: boolean;
}

const GoogleLocationSearch = ({ 
  placeholder, 
  icon: Icon = MapPin, 
  onSelect, 
  initialValue = "", 
  className = "",
  error = false
}: LocationSearchProps) => {
  const [inputValue, setInputValue] = useState(initialValue || "");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const placesLibrary = useMapsLibrary("places");
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);

  // Coordenadas de Patrocínio - MG para priorizar buscas próximas
  const PATROCINIO_COORDS = { lat: -18.9469, lng: -46.9928 };

  useEffect(() => {
    if (!placesLibrary) return;
    setAutocompleteService(new placesLibrary.AutocompleteService());
    setSessionToken(new placesLibrary.AutocompleteSessionToken());
  }, [placesLibrary]);

  useEffect(() => {
    if (initialValue !== undefined) {
      setInputValue(initialValue);
    }
  }, [initialValue]);

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
    if (!autocompleteService || !sessionToken || inputValue.length < 3 || !isOpen) {
        if (inputValue.length < 3) setPredictions([]);
        return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      
      autocompleteService.getPlacePredictions({
        input: inputValue,
        sessionToken: sessionToken,
        componentRestrictions: { country: 'br' },
        locationBias: {
            radius: 50000, 
            center: PATROCINIO_COORDS
        }
      }, (results, status) => {
        setLoading(false);
        if (status === 'OK' && results) {
          setPredictions(results);
        } else {
          setPredictions([]);
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue, autocompleteService, sessionToken, isOpen]);

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesLibrary || !sessionToken) return;

    setLoading(true);
    setPredictions([]);
    setIsOpen(false);
    
    try {
        // Usando o PlacesService Legado para evitar erros de permissão da API "Nova"
        const dummyElement = document.createElement('div');
        const service = new google.maps.places.PlacesService(dummyElement);

        service.getDetails({
            placeId: prediction.place_id,
            fields: ['geometry', 'formatted_address'],
            sessionToken: sessionToken
        }, (place, status) => {
            setLoading(false);
            if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const address = place.formatted_address || prediction.description;

                setInputValue(address);
                onSelect({ lat, lon: lng, display_name: address });
                
                // Novo token para a próxima busca
                setSessionToken(new placesLibrary.AutocompleteSessionToken());
            } else {
                console.error("Erro ao detalhar local (Status):", status);
                showError("Erro ao obter detalhes deste local.");
            }
        });
    } catch (err) {
        setLoading(false);
        console.error("Erro fatal ao detalhar local:", err);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className={`absolute left-4 top-4 z-30 transition-colors pointer-events-none ${error ? "text-red-500" : "text-gray-400"}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <Input
        value={inputValue}
        onChange={(e) => { 
            setInputValue(e.target.value); 
            setIsOpen(true); 
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`pl-12 pr-10 h-14 bg-white text-slate-900 rounded-2xl transition-all shadow-sm font-medium placeholder:text-gray-400 border-gray-200 focus:border-black focus:ring-0 relative z-20
            ${error ? "border-red-500 ring-1 ring-red-500" : ""}`}
      />

      {inputValue && (
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => { setInputValue(""); onSelect(null); setPredictions([]); }} 
            className="absolute right-2 top-2 text-gray-400 hover:text-black h-10 w-10 z-30"
          >
              <X className="w-4 h-4" />
          </Button>
      )}

      {isOpen && (predictions.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[9999] animate-in fade-in zoom-in-95 duration-200">
          {loading && (
            <div className="p-4 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}
          
          {!loading && predictions.map((item, index) => (
            <button
              key={item.place_id || index}
              onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
              }}
              className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors cursor-pointer"
              type="button"
            >
                <div className="bg-slate-100 p-2 rounded-full shrink-0">
                    <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">
                        {item.structured_formatting?.main_text || item.description.split(',')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                        {item.structured_formatting?.secondary_text || item.description}
                    </p>
                </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoogleLocationSearch;