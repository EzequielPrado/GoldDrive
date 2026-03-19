"use client";

import React, { useEffect, useState } from 'react';
import { Map, useMap, useMapsLibrary, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Car } from 'lucide-react';

interface MapProps {
  className?: string;
  pickupLocation?: { lat: number; lon: number } | null;
  destinationLocation?: { lat: number; lon: number } | null;
  driverLocation?: { lat: number; lon: number } | null;
}

const Directions = ({ pickup, destination }: { pickup: any, destination: any }) => {
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
    directionsRenderer.setMap(map);
    directionsService.route({
      origin: pickup,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK' && result) {
        directionsRenderer.setDirections(result);
      }
    });
  }, [directionsService, directionsRenderer, pickup, destination, map]);

  return null;
};

const GoogleMapComponent = ({ 
    className = "h-full w-full", 
    pickupLocation, 
    destinationLocation,
    driverLocation
}: MapProps) => {
  const defaultCenter = { lat: -18.9469, lng: -46.9928 };

  return (
    <div className={`relative h-full w-full ${className}`}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={14}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        mapId="bf50a63493f06e40"
      >
        <Directions 
            pickup={pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lon } : null}
            destination={destinationLocation ? { lat: destinationLocation.lat, lng: destinationLocation.lon } : null}
        />

        {/* MARCADOR DO MOTORISTA EM TEMPO REAL */}
        {driverLocation && (
            <AdvancedMarker position={{ lat: driverLocation.lat, lng: driverLocation.lon }}>
                <div className="bg-black p-2 rounded-full border-2 border-yellow-500 shadow-xl animate-in zoom-in duration-300">
                    <Car className="w-6 h-6 text-yellow-500" />
                </div>
            </AdvancedMarker>
        )}
      </Map>
    </div>
  );
};

export default GoogleMapComponent;