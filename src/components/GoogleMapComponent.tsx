"use client";

import React, { useEffect, useState } from 'react';
import { Map, useMap, useMapsLibrary, Marker } from '@vis.gl/react-google-maps';

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
      >
        <Directions 
            pickup={pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lon } : null}
            destination={destinationLocation ? { lat: destinationLocation.lat, lng: destinationLocation.lon } : null}
        />

        {/* MARCADOR DO MOTORISTA EM TEMPO REAL (CARRINHO) */}
        {driverLocation && (
            <Marker 
                position={{ lat: driverLocation.lat, lng: driverLocation.lon }}
                icon={{
                    url: "https://cdn-icons-png.flaticon.com/512/3082/3082349.png", // Ícone de carro de cima
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 20)
                }}
            />
        )}
      </Map>
    </div>
  );
};

export default GoogleMapComponent;