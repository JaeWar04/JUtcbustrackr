/**
 * Driver Dashboard
 * 
 * This dashboard is for drivers to:
 * - Start and end trips
 * - Send GPS updates automatically
 * - View their current route and stops
 * - See trip statistics
 * 
 * GPS updates are sent automatically every 5 seconds when a trip is active
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Bus, Navigation, Play, Square, Clock, MapPin } from 'lucide-react';

interface Bus {
  id: string;
  bus_number: string;
  license_plate: string;
}

interface Route {
  id: string;
  name: string;
  description: string;
}

interface ActiveTrip {
  id: string;
  bus_number: string;
  route_name: string;
  started_at: string;
}

const DriverDashboard = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedBus, setSelectedBus] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [gpsInterval, setGpsInterval] = useState<NodeJS.Timeout | null>(null);
  const [gpsUpdateCount, setGpsUpdateCount] = useState(0);

  /**
   * Fetch available buses and routes
   */
  useEffect(() => {
    const fetchData = async () => {
      // Fetch buses
      const { data: busData } = await supabase
        .from('buses')
        .select('id, bus_number, license_plate')
        .eq('is_active', true)
        .order('bus_number');

      if (busData) setBuses(busData);

      // Fetch routes
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (routeData) setRoutes(routeData);
    };

    fetchData();
  }, []);

  /**
   * Check for active trip on mount
   */
  useEffect(() => {
    const checkActiveTrip = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          started_at,
          buses (bus_number),
          routes (name)
        `)
        .eq('driver_id', user.id)
        .eq('status', 'active')
        .single();

      if (!error && data) {
        setActiveTrip({
          id: data.id,
          bus_number: data.buses?.bus_number || 'Unknown',
          route_name: data.routes?.name || 'Unknown',
          started_at: data.started_at,
        });
      }
    };

    checkActiveTrip();
  }, []);

  /**
   * Start GPS tracking when trip is active
   */
  useEffect(() => {
    if (!activeTrip) {
      // Stop GPS tracking if no active trip
      if (gpsInterval) {
        clearInterval(gpsInterval);
        setGpsInterval(null);
      }
      return;
    }

    // Start GPS tracking every 5 seconds
    console.log('📍 Starting GPS tracking...');
    const interval = setInterval(() => {
      sendGPSUpdate();
    }, 5000); // Send GPS update every 5 seconds

    setGpsInterval(interval);

    // Send first GPS update immediately
    sendGPSUpdate();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTrip]);

  /**
   * Send GPS update to the database
   * Uses browser's Geolocation API to get current position
   */
  const sendGPSUpdate = () => {
    if (!activeTrip) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, speed, heading, accuracy } = position.coords;

          console.log('📡 Sending GPS update:', { latitude, longitude });

          const { error } = await supabase
            .from('gps_updates')
            .insert({
              trip_id: activeTrip.id,
              latitude,
              longitude,
              speed: speed || 0,
              heading: heading || 0,
              accuracy: accuracy || 0,
            });

          if (error) {
            console.error('❌ Error sending GPS update:', error);
          } else {
            setGpsUpdateCount(prev => prev + 1);
            console.log('✅ GPS update sent successfully');
          }
        },
        (error) => {
          console.error('❌ Geolocation error:', error);
          toast({
            title: "Location Error",
            description: "Could not get your location. Please enable location services.",
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      toast({
        title: "Location Not Supported",
        description: "Your device doesn't support location tracking.",
        variant: "destructive",
      });
    }
  };

  /**
   * Start a new trip
   */
  const handleStartTrip = async () => {
    if (!selectedBus || !selectedRoute) {
      toast({
        title: "Missing Information",
        description: "Please select both a bus and a route.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('🚀 Starting new trip...');

    const { data, error } = await supabase
      .from('trips')
      .insert({
        bus_id: selectedBus,
        route_id: selectedRoute,
        driver_id: user.id,
        status: 'active',
      })
      .select(`
        id,
        started_at,
        buses (bus_number),
        routes (name)
      `)
      .single();

    if (error) {
      console.error('❌ Error starting trip:', error);
      toast({
        title: "Error",
        description: "Could not start trip. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setActiveTrip({
      id: data.id,
      bus_number: data.buses?.bus_number || 'Unknown',
      route_name: data.routes?.name || 'Unknown',
      started_at: data.started_at,
    });

    toast({
      title: "Trip Started!",
      description: "GPS tracking is now active.",
    });
  };

  /**
   * End the current trip
   */
  const handleEndTrip = async () => {
    if (!activeTrip) return;

    console.log('🛑 Ending trip...');

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', activeTrip.id);

    if (error) {
      console.error('❌ Error ending trip:', error);
      toast({
        title: "Error",
        description: "Could not end trip. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setActiveTrip(null);
    setGpsUpdateCount(0);
    
    toast({
      title: "Trip Completed!",
      description: "GPS tracking has been stopped.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-6 w-6 text-primary" />
            Driver Dashboard
          </CardTitle>
          <CardDescription>
            Start your trip and track your route in real-time
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Active Trip Display */}
      {activeTrip && (
        <Card className="border-success/50 bg-success/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-success animate-pulse" />
                  Trip Active
                </CardTitle>
                <CardDescription className="mt-2">
                  Bus {activeTrip.bus_number} • {activeTrip.route_name}
                </CardDescription>
              </div>
              <Button 
                onClick={handleEndTrip}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                End Trip
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="font-semibold">
                    {new Date(activeTrip.started_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">GPS Updates</p>
                  <p className="font-semibold">{gpsUpdateCount}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-background rounded-lg">
              <p className="text-sm text-muted-foreground">
                📡 Your location is being tracked every 5 seconds and shared with passengers.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Trip Form */}
      {!activeTrip && (
        <Card>
          <CardHeader>
            <CardTitle>Start a New Trip</CardTitle>
            <CardDescription>
              Select your bus and route to begin tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Bus</label>
              <Select value={selectedBus} onValueChange={setSelectedBus}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your bus" />
                </SelectTrigger>
                <SelectContent>
                  {buses.map((bus) => (
                    <SelectItem key={bus.id} value={bus.id}>
                      Bus {bus.bus_number} ({bus.license_plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Route</label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name} {route.description && `- ${route.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleStartTrip}
              className="w-full bg-gradient-primary"
              disabled={!selectedBus || !selectedRoute}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Trip
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-semibold">How GPS Tracking Works</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Location updates sent every 5 seconds</li>
                <li>• Passengers see your bus in real-time</li>
                <li>• Enable location services for accuracy</li>
                <li>• GPS works in the background</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-semibold">Available</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-primary">{buses.length}</p>
                  <p className="text-sm text-muted-foreground">Buses</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">{routes.length}</p>
                  <p className="text-sm text-muted-foreground">Routes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverDashboard;
