import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix para ícones do leaflet no vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: typeof icon === 'string' ? icon : (icon as any).src,
    shadowUrl: typeof iconShadow === 'string' ? iconShadow : (iconShadow as any).src,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Ícone Personalizado para Origem (Verde)
const PickupIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Ícone Personalizado para Destino (Vermelho)
const DestinationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Componente para controlar o mapa (Zoom e Pan)
const MapController = ({ 
    center, 
    pickup, 
    destination,
    routeCoords 
}: { 
    center: [number, number], 
    pickup?: [number, number] | null, 
    destination?: [number, number] | null,
    routeCoords?: [number, number][] 
}) => {
  const map = useMap();

  useEffect(() => {
    // 1. Prioridade: Se tiver uma rota desenhada, foca nela
    if (routeCoords && routeCoords.length > 0) {
        const bounds = L.latLngBounds(routeCoords);
        map.fitBounds(bounds, { padding: [50, 50] });
    } 
    // 2. Se tiver origem e destino, foca nos dois
    else if (pickup && destination) {
        const bounds = L.latLngBounds([pickup, destination]);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    // 3. Se tiver só um ponto (ex: origem selecionada), vai para ele
    else if (pickup) {
        map.flyTo(pickup, 16, { animate: true, duration: 1.5 });
    }
    // 4. Default
    else {
        map.flyTo(center, 13);
    }

    // Fix render
    setTimeout(() => map.invalidateSize(), 100);
  }, [center, pickup, destination, routeCoords, map]);

  return null;
};

interface MapProps {
  className?: string;
  pickupLocation?: { lat: number; lon: number } | null;
  destinationLocation?: { lat: number; lon: number } | null;
  routeCoordinates?: [number, number][]; // Array de lat/long para desenhar a linha
}

const MapComponent = ({ 
    className = "h-full w-full", 
    pickupLocation, 
    destinationLocation,
    routeCoordinates 
}: MapProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const defaultCenter: [number, number] = [-23.55052, -46.633309]; // SP Default

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
        <div className="h-full w-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="text-sm">Carregando mapa...</span>
        </div>
    );
  }

  // Prepara posições para o Leaflet
  const pickupPos: [number, number] | null = pickupLocation ? [pickupLocation.lat, pickupLocation.lon] : null;
  const destPos: [number, number] | null = destinationLocation ? [destinationLocation.lat, destinationLocation.lon] : null;
  const activeCenter = pickupPos || defaultCenter;

  return (
    <div className={`relative z-0 ${className} bg-gray-100`}>
      <MapContainer 
        center={activeCenter} 
        zoom={13} 
        scrollWheelZoom={false} 
        className="h-full w-full isolate"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {/* Marcador de Origem */}
        {pickupPos && (
            <Marker position={pickupPos} icon={PickupIcon}>
              <Popup>Local de Embarque</Popup>
            </Marker>
        )}

        {/* Marcador de Destino */}
        {destPos && (
             <Marker position={destPos} icon={DestinationIcon}>
              <Popup>Destino</Popup>
            </Marker>
        )}

        {/* Linha da Rota */}
        {routeCoordinates && routeCoordinates.length > 0 && (
            <Polyline 
                positions={routeCoordinates} 
                color="#000" // Cor da linha (preto estilo Uber)
                weight={4}
                opacity={0.7}
                dashArray="10, 10" // Linha tracejada se quiser, ou solida se remover isso
            />
        )}

        <MapController 
            center={defaultCenter} 
            pickup={pickupPos} 
            destination={destPos} 
            routeCoords={routeCoordinates}
        />
      </MapContainer>
      
      {/* Overlay gradiente */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/40 via-transparent to-white/60 z-[400]" />
    </div>
  );
};

export default MapComponent;