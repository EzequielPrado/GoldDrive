"use client";

import React, { useEffect, useState } from 'react';
import { Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

interface MapProps {
  className?: string;
  pickupLocation?: { lat: number; lon: number } | null;
  destinationLocation?: { lat: number; lon: number } | null;
  routeCoordinates?: [number, number][]; 
}

const Directions = ({ pickup, destination }: { pickup: any, destination: any }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ 
        map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#000000',
            strokeWeight: 5,
            strokeOpacity: 0.8
        }
    }));
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !pickup || !destination) {
        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
        return;
    }

    directionsService.route({
      origin: pickup,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK' && result) {
        directionsRenderer.setDirections(result);
      }
    });
  }, [directionsService, directionsRenderer, pickup, destination]);

  return null;
};

const GoogleMapComponent = ({ 
    className = "h-full w-full", 
    pickupLocation, 
    destinationLocation 
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
      </Map>
    </div>
  );
};

export default GoogleMapComponent;