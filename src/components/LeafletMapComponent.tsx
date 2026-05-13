"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapProps {
  className?: string;
  pickupLocation?: { lat: number; lon: number } | null;
  destinationLocation?: { lat: number; lon: number } | null;
  driverLocation?: { lat: number; lon: number } | null;
  activeDrivers?: { id: string; lat: number; lon: number }[] | null;
  stops?: { lat: number; lon: number }[] | null;
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

// Custom hook to handle map clicks and view updates
const MapController = ({ 
    pickup, 
    destination, 
    stops, 
    onMapClick, 
    interactive 
}: { 
    pickup: any, 
    destination: any, 
    stops?: any[] | null, 
    onMapClick?: any,
    interactive?: boolean
}) => {
  const map = useMap();

  useEffect(() => {
    if (pickup && destination) {
        const bounds = L.latLngBounds([
            [pickup.lat, pickup.lon],
            [destination.lat, destination.lon]
        ]);
        if (stops) {
            stops.forEach(stop => bounds.extend([stop.lat, stop.lon]));
        }
        map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
        map.setView([pickup.lat, pickup.lon], 15);
    }
  }, [pickup, destination, stops, map]);

  useEffect(() => {
    if (!interactive) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
        if (onMapClick) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    };

    map.on('click', handleClick);
    return () => {
        map.off('click', handleClick);
    };
  }, [map, interactive, onMapClick]);

  return null;
};

// Component to handle routing (using OSRM - Open Source Routing Machine)
const RoutingLayer = ({ pickup, destination, stops }: { pickup: any, destination: any, stops?: any[] | null }) => {
    const [route, setRoute] = useState<[number, number][]>([]);

    useEffect(() => {
        if (!pickup || !destination) {
            setRoute([]);
            return;
        }

        const fetchRoute = async () => {
            try {
                let coords = `${pickup.lon},${pickup.lat}`;
                if (stops) {
                    stops.forEach(stop => {
                        coords += `;${stop.lon},${stop.lat}`;
                    });
                }
                coords += `;${destination.lon},${destination.lat}`;

                const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
                const data = await response.json();

                if (data.code === 'Ok' && data.routes.length > 0) {
                    const polyline = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
                    setRoute(polyline);
                }
            } catch (error) {
                console.error("Error fetching route from OSRM:", error);
            }
        };

        fetchRoute();
    }, [pickup, destination, stops]);

    if (route.length === 0) return null;

    return <Polyline positions={route} color="#000000" weight={5} opacity={0.7} />;
};

const LeafletMapComponent = ({ 
    className = "h-full w-full", 
    pickupLocation, 
    destinationLocation,
    driverLocation,
    activeDrivers,
    stops,
    onMapClick,
    interactive = false
}: MapProps) => {
  const defaultCenter: [number, number] = [-18.9469, -46.9928]; // Patrocínio - MG

  const pickupIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const destinationIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const stopIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const carIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3082/3082349.png",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const activeCarIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3082/3082349.png",
    iconSize: [35, 35],
    iconAnchor: [17.5, 17.5],
  });

  return (
    <div className={`relative h-full w-full ${className} z-0`}>
      <MapContainer 
        center={defaultCenter} 
        zoom={14} 
        scrollWheelZoom={true} 
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController 
            pickup={pickupLocation} 
            destination={destinationLocation} 
            stops={stops} 
            onMapClick={onMapClick} 
            interactive={interactive}
        />

        <RoutingLayer 
            pickup={pickupLocation} 
            destination={destinationLocation} 
            stops={stops} 
        />

        {pickupLocation && (
            <Marker position={[pickupLocation.lat, pickupLocation.lon]} icon={pickupIcon} />
        )}

        {destinationLocation && (
            <Marker position={[destinationLocation.lat, destinationLocation.lon]} icon={destinationIcon} />
        )}

        {stops && stops.map((stop, idx) => (
            <Marker key={idx} position={[stop.lat, stop.lon]} icon={stopIcon} />
        ))}

        {driverLocation && (
            <Marker position={[driverLocation.lat, driverLocation.lon]} icon={carIcon} />
        )}

        {activeDrivers && !driverLocation && activeDrivers.map(driver => (
            <Marker 
                key={driver.id}
                position={[driver.lat, driver.lon]} 
                icon={activeCarIcon} 
            />
        ))}
      </MapContainer>
    </div>
  );
};

export default LeafletMapComponent;
