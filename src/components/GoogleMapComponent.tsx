"use client";

import React, { useEffect, useState } from 'react';
import { Map, useMap, useMapsLibrary, Marker } from '@vis.gl/react-google-maps';

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

const Directions = ({ pickup, destination, stops }: { pickup: any, destination: any, stops?: any[] | null }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    const ds = new routesLibrary.DirectionsService();
    const dr = new routesLibrary.DirectionsRenderer({ 
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#000000', strokeWeight: 5, strokeOpacity: 0.8 }
    });
    setDirectionsService(ds);
    setDirectionsRenderer(dr);
    return () => dr.setMap(null);
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;
    if (!pickup || !destination) {
        directionsRenderer.setMap(null);
        return;
    }
    
    const waypoints = stops ? stops.map(stop => ({
        location: { lat: stop.lat, lng: stop.lon },
        stopover: true
    })) : [];

    directionsRenderer.setMap(map);
    directionsService.route({
      origin: pickup,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    }, (result, status) => {
      if (status === 'OK' && result) {
        directionsRenderer.setDirections(result);
      }
    });
  }, [directionsService, directionsRenderer, pickup, destination, stops, map]);

  return null;
};

const GoogleMapComponent = ({ 
    className = "h-full w-full", 
    pickupLocation, 
    destinationLocation,
    driverLocation,
    activeDrivers,
    stops,
    onMapClick,
    interactive = false
}: MapProps) => {
  const defaultCenter = { lat: -18.9469, lng: -46.9928 };

  const handleMapClick = (e: any) => {
    if (onMapClick && e.detail.latLng) {
        onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
    }
  };

  return (
    <div className={`relative h-full w-full ${className}`}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={14}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        onClick={handleMapClick}
        clickableIcons={false}
      >
        <Directions 
            pickup={pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lon } : null}
            destination={destinationLocation ? { lat: destinationLocation.lat, lng: destinationLocation.lon } : null}
            stops={stops}
        />

        {/* Marcador de Origem (Somente se não estiver em rota) */}
        {pickupLocation && !destinationLocation && (
             <Marker 
                position={{ lat: pickupLocation.lat, lng: pickupLocation.lon }}
                icon={{
                    url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
                    scaledSize: new google.maps.Size(25, 41)
                }}
             />
        )}

        {/* Marcador de Destino */}
        {destinationLocation && (
             <Marker 
                position={{ lat: destinationLocation.lat, lng: destinationLocation.lon }}
                icon={{
                    url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
                    scaledSize: new google.maps.Size(25, 41)
                }}
             />
        )}

        {/* MARCADOR DO MOTORISTA EM TEMPO REAL (CARRINHO) */}
        {driverLocation && (
            <Marker 
                position={{ lat: driverLocation.lat, lng: driverLocation.lon }}
                icon={{
                    url: "https://cdn-icons-png.flaticon.com/512/3082/3082349.png", 
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 20)
                }}
            />
        )}

        {/* MARCADORES DE MOTORISTAS DISPONÍVEIS (CARRINHOS NO MAPA) */}
        {activeDrivers && !driverLocation && activeDrivers.map(driver => (
            <Marker 
                key={driver.id}
                position={{ lat: driver.lat, lng: driver.lon }}
                icon={{
                    url: "https://cdn-icons-png.flaticon.com/512/3082/3082349.png", 
                    scaledSize: new google.maps.Size(35, 35),
                    anchor: new google.maps.Point(17.5, 17.5)
                }}
            />
        ))}
      </Map>
    </div>
  );
};

export default GoogleMapComponent;