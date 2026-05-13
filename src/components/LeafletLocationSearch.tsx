"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showError } from "@/utils/toast";

interface LocationSearchProps {
  placeholder: string;
  icon?: React.ElementType;
  onSelect: (location: { lat: number; lon: number; display_name: string } | null) => void;
  initialValue?: string;
  className?: string;
  error?: boolean;
}

const LeafletLocationSearch = ({ 
  placeholder, 
  icon: Icon = MapPin, 
  onSelect, 
  initialValue = "", 
  className = "",
  error = false
}: LocationSearchProps) => {
  const [inputValue, setInputValue] = useState(initialValue || "");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (inputValue.length < 3 || !isOpen) {
        if (inputValue.length < 3) setPredictions([]);
        return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
          // Using Nominatim (OpenStreetMap) Geocoding API
          // Added viewbox to prioritize results near Patrocínio - MG
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&countrycodes=br&limit=5&viewbox=-47.2,-19.1,-46.8,-18.8&bounded=0`);
          const data = await response.json();
          setPredictions(data);
      } catch (err) {
          console.error("Geocoding error:", err);
      } finally {
          setLoading(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [inputValue, isOpen]);

  const handleSelect = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const address = item.display_name;

    setInputValue(address);
    onSelect({ lat, lon, display_name: address });
    setPredictions([]);
    setIsOpen(false);
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
              key={index}
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
                        {item.display_name.split(',')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                        {item.display_name}
                    </p>
                </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeafletLocationSearch;
