/**
 * Passenger Dashboard
 * 
 * This dashboard is for passengers to:
 * - View all active buses on a live map
 * - Search for routes
 * - See estimated arrival times (ETAs)
 * - Track specific buses
 * 
 * All bus locations update in real-time via Supabase subscriptions
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import BusMap from '@/components/Map/BusMap';
import { Bus, Clock, MapPin, Navigation } from 'lucide-react';

interface Route {
  id: string;
  name: string;
  description: string;
}

interface ActiveBus {
  bus_number: string;
  route_name: string;
  trip_id: string;
}

const PassengerDashboard = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [activeBuses, setActiveBuses] = useState<ActiveBus[]>([]);

  /**
   * Fetch all available routes
   */
  useEffect(() => {
    const fetchRoutes = async () => {
      console.log('📋 Fetching routes...');
      const { data, error } = await supabase
        .from('routes')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ Error fetching routes:', error);
        return;
      }

      console.log(`✅ Loaded ${data?.length || 0} routes`);
      setRoutes(data || []);
    };

    fetchRoutes();
  }, []);

  /**
   * Fetch active buses for the selected route
   */
  useEffect(() => {
    if (!selectedRoute) {
      setActiveBuses([]);
      return;
    }

    const fetchActiveBuses = async () => {
      console.log('🚌 Fetching active buses for route:', selectedRoute);
      
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          bus_id,
          buses (bus_number),
          routes (name)
        `)
        .eq('route_id', selectedRoute)
        .eq('status', 'active');

      if (error) {
        console.error('❌ Error fetching active buses:', error);
        return;
      }

      const buses = data?.map(trip => ({
        bus_number: trip.buses?.bus_number || 'Unknown',
        route_name: trip.routes?.name || 'Unknown Route',
        trip_id: trip.id,
      })) || [];

      console.log(`✅ Found ${buses.length} active buses`);
      setActiveBuses(buses);
    };

    fetchActiveBuses();

    // Subscribe to trip changes for this route
    const channel = supabase
      .channel(`route-trips-${selectedRoute}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: `route_id=eq.${selectedRoute}`,
        },
        () => {
          console.log('🔄 Trip update detected, refreshing...');
          fetchActiveBuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoute]);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-6 w-6 text-primary" />
            Track Your Bus
          </CardTitle>
          <CardDescription>
            View real-time bus locations and get estimated arrival times
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Route Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select a Route</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRoute} onValueChange={setSelectedRoute}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a route to track" />
            </SelectTrigger>
            <SelectContent>
              {routes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.name} {route.description && `- ${route.description}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Active Buses List */}
          {selectedRoute && activeBuses.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Active Buses ({activeBuses.length})
              </h4>
              <div className="grid gap-2">
                {activeBuses.map((bus) => (
                  <div
                    key={bus.trip_id}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Bus className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold">Bus {bus.bus_number}</p>
                        <p className="text-sm text-muted-foreground">{bus.route_name}</p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-success">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedRoute && activeBuses.length === 0 && (
            <div className="mt-4 text-center text-muted-foreground text-sm">
              No active buses on this route right now
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            Live Bus Tracking Map
          </CardTitle>
          <CardDescription>
            See all buses in real-time. Blue markers are buses, orange markers are stops.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] w-full">
            <BusMap />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-full">
                <Bus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeBuses.length}</p>
                <p className="text-sm text-muted-foreground">Active Buses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-accent/10 p-3 rounded-full">
                <MapPin className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{routes.length}</p>
                <p className="text-sm text-muted-foreground">Routes Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-success/10 p-3 rounded-full">
                <Clock className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">Live</p>
                <p className="text-sm text-muted-foreground">Real-Time Updates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PassengerDashboard;
