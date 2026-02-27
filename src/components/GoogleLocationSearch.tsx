"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

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
  const [inputValue, setInputValue] = useState(initialValue);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const placesLibrary = useMapsLibrary("places");
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!placesLibrary) return;
    setAutocompleteService(new placesLibrary.AutocompleteService());
    // O PlacesService precisa de um elemento HTML fantasma
    setPlacesService(new placesLibrary.PlacesService(document.createElement('div')));
  }, [placesLibrary]);

  useEffect(() => {
    setInputValue(initialValue || "");
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
    if (!autocompleteService || inputValue.length < 3 || !isOpen) {
        setPredictions([]);
        return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      autocompleteService.getPlacePredictions({
        input: inputValue,
        componentRestrictions: { country: 'br' },
        types: ['address', 'establishment']
      }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
        }
        setLoading(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, autocompleteService, isOpen]);

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService) return;

    setLoading(true);
    placesService.getDetails({
      placeId: prediction.place_id,
      fields: ['geometry', 'formatted_address']
    }, (place, status) => {
      setLoading(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || prediction.description;

        setInputValue(address);
        setIsOpen(false);
        onSelect({ lat, lon: lng, display_name: address });
      }
    });
  };

  return (
    <div className={`relative group ${className}`} ref={containerRef}>
      <div className={`absolute left-4 top-4 z-10 transition-colors ${error ? "text-red-500" : "text-gray-400"}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <Input
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`pl-12 pr-10 h-14 bg-white text-slate-900 rounded-2xl transition-all shadow-sm font-medium placeholder:text-gray-400 
            ${error ? "border-red-500 ring-1 ring-red-500" : "border-gray-200"}`}
      />

      {inputValue && (
          <Button size="icon" variant="ghost" onClick={() => { setInputValue(""); onSelect(null); }} className="absolute right-2 top-2 text-gray-400 h-10 w-10">
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
              key={index}
              onClick={() => handleSelect(item)}
              className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3"
              type="button"
            >
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">{item.structured_formatting.main_text}</p>
                    <p className="text-xs text-gray-500 truncate">{item.structured_formatting.secondary_text}</p>
                </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoogleLocationSearch;