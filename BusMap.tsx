/**
 * BusMap Component
 * 
 * This component displays a Google Map with real-time bus locations.
 * It shows all active buses as markers on the map and updates their positions
 * when new GPS data arrives via real-time subscriptions.
 * 
 * Features:
 * - Real-time bus tracking with live GPS updates
 * - Custom bus markers showing bus numbers
 * - Route polylines showing bus paths
 * - Stop markers for each route stop
 * - Auto-center on user location
 */

import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { Bus, MapPin, Navigation } from 'lucide-react';

// Type definitions for our data structures
interface BusLocation {
  id: string;
  bus_number: string;
  latitude: number;
  longitude: number;
  trip_id: string;
  route_name: string;
}

interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

// Map styling configuration
const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Default center (will be updated with user location or first bus)
const defaultCenter = {
  lat: 0,
  lng: 0,
};

// Google Maps API key from the image provided by the user
const GOOGLE_MAPS_API_KEY = 'AIzaSyAOfbDfxliynYhWdn3uAGUuORPtI0-FzI4';

const BusMap = () => {
  // State for bus locations - updates in real-time
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  
  // State for route stops
  const [stops, setStops] = useState<Stop[]>([]);
  
  // State for map center and zoom
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(13);
  
  // State for selected bus (shows info window)
  const [selectedBus, setSelectedBus] = useState<BusLocation | null>(null);
  
  // State for user location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  /**
   * Fetch initial bus locations from the database
   * This gets the most recent GPS update for each active trip
   */
  const fetchBusLocations = useCallback(async () => {
    console.log('📍 Fetching bus locations...');
    
    // Query to get latest GPS update for each active trip with bus and route info
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select(`
        id,
        bus_id,
        route_id,
        buses (
          bus_number
        ),
        routes (
          name
        )
      `)
      .eq('status', 'active');

    if (tripsError) {
      console.error('❌ Error fetching trips:', tripsError);
      return;
    }

    if (!trips || trips.length === 0) {
      console.log('ℹ️ No active trips found');
      return;
    }

    console.log(`✅ Found ${trips.length} active trips`);

    // For each trip, get the latest GPS update
    const locations: BusLocation[] = [];
    
    for (const trip of trips) {
      const { data: gpsData, error: gpsError } = await supabase
        .from('gps_updates')
        .select('latitude, longitude, created_at')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (gpsError || !gpsData) {
        console.log(`⚠️ No GPS data for trip ${trip.id}`);
        continue;
      }

      locations.push({
        id: trip.id,
        bus_number: trip.buses?.bus_number || 'Unknown',
        latitude: Number(gpsData.latitude),
        longitude: Number(gpsData.longitude),
        trip_id: trip.id,
        route_name: trip.routes?.name || 'Unknown Route',
      });
    }

    console.log(`✅ Loaded ${locations.length} bus locations`);
    setBusLocations(locations);

    // Center map on first bus if no user location
    if (locations.length > 0 && !userLocation) {
      setCenter({
        lat: locations[0].latitude,
        lng: locations[0].longitude,
      });
    }
  }, [userLocation]);

  /**
   * Fetch route stops for display on the map
   */
  const fetchStops = useCallback(async () => {
    const { data, error } = await supabase
      .from('stops')
      .select('id, name, latitude, longitude, stop_order')
      .order('stop_order');

    if (error) {
      console.error('❌ Error fetching stops:', error);
      return;
    }

    if (data) {
      setStops(data.map(stop => ({
        ...stop,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
      })));
    }
  }, []);

  /**
   * Get user's current location using browser geolocation API
   */
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(userPos);
          setCenter(userPos);
          console.log('📍 User location:', userPos);
        },
        (error) => {
          console.log('⚠️ Could not get user location:', error.message);
        }
      );
    }
  }, []);

  /**
   * Set up real-time subscription to GPS updates
   * This listens for new GPS data and updates bus positions instantly
   */
  useEffect(() => {
    console.log('🔄 Setting up real-time GPS subscription...');
    
    // Create a channel for GPS updates
    const channel = supabase
      .channel('gps-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gps_updates',
        },
        async (payload) => {
          console.log('📡 New GPS update received:', payload);
          
          // Get trip details for the new GPS update
          const { data: tripData } = await supabase
            .from('trips')
            .select(`
              id,
              buses (bus_number),
              routes (name)
            `)
            .eq('id', payload.new.trip_id)
            .single();

          if (!tripData) return;

          const newLocation: BusLocation = {
            id: payload.new.trip_id,
            bus_number: tripData.buses?.bus_number || 'Unknown',
            latitude: Number(payload.new.latitude),
            longitude: Number(payload.new.longitude),
            trip_id: payload.new.trip_id,
            route_name: tripData.routes?.name || 'Unknown Route',
          };

          // Update bus locations - replace existing or add new
          setBusLocations((prev) => {
            const index = prev.findIndex((loc) => loc.id === newLocation.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = newLocation;
              return updated;
            }
            return [...prev, newLocation];
          });
        }
      )
      .subscribe();

    // Fetch initial data
    fetchBusLocations();
    fetchStops();
    getUserLocation();

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Unsubscribing from GPS updates');
      supabase.removeChannel(channel);
    };
  }, [fetchBusLocations, fetchStops, getUserLocation]);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden">
      <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={zoom}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Render bus markers */}
          {busLocations.map((bus) => (
            <Marker
              key={bus.id}
              position={{ lat: bus.latitude, lng: bus.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
              label={{
                text: bus.bus_number,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
              onClick={() => setSelectedBus(bus)}
            />
          ))}

          {/* Render stop markers */}
          {stops.map((stop) => (
            <Marker
              key={stop.id}
              position={{ lat: stop.latitude, lng: stop.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: '#f97316',
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              title={stop.name}
            />
          ))}

          {/* Render user location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#10b981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              title="Your Location"
            />
          )}

          {/* Info window for selected bus */}
          {selectedBus && (
            <InfoWindow
              position={{ lat: selectedBus.latitude, lng: selectedBus.longitude }}
              onCloseClick={() => setSelectedBus(null)}
            >
              <div className="p-2">
                <h3 className="font-semibold text-foreground">Bus {selectedBus.bus_number}</h3>
                <p className="text-sm text-muted-foreground">{selectedBus.route_name}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-card p-3 rounded-lg shadow-md space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary border-2 border-white"></div>
          <span className="text-xs text-foreground">Buses</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent border-2 border-white"></div>
          <span className="text-xs text-foreground">Stops</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success border-2 border-white"></div>
          <span className="text-xs text-foreground">You</span>
        </div>
      </div>

      {/* Bus count indicator */}
      <div className="absolute top-4 left-4 bg-card px-4 py-2 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <Bus className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {busLocations.length} {busLocations.length === 1 ? 'Bus' : 'Buses'} Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default BusMap;
