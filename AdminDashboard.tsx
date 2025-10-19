import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Bus, MapPin, Route } from 'lucide-react';

const AdminDashboard = () => {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [newBus, setNewBus] = useState({ bus_number: '', license_plate: '' });
  const [newRoute, setNewRoute] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: busData } = await supabase.from('buses').select('*').order('bus_number');
    const { data: routeData } = await supabase.from('routes').select('*').order('name');
    if (busData) setBuses(busData);
    if (routeData) setRoutes(routeData);
  };

  const handleAddBus = async () => {
    if (!newBus.bus_number || !newBus.license_plate) {
      toast({ title: "Missing Info", description: "Fill all fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from('buses').insert(newBus);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success!", description: "Bus added" });
      setNewBus({ bus_number: '', license_plate: '' });
      fetchData();
    }
  };

  const handleAddRoute = async () => {
    if (!newRoute.name) {
      toast({ title: "Missing Info", description: "Enter route name", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from('routes').insert(newRoute);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success!", description: "Route added" });
      setNewRoute({ name: '', description: '' });
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-6 w-6 text-primary" />
            Admin Dashboard
          </CardTitle>
          <CardDescription>Manage buses, routes, and system settings</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Bus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Bus Number" value={newBus.bus_number} onChange={(e) => setNewBus({ ...newBus, bus_number: e.target.value })} />
            <Input placeholder="License Plate" value={newBus.license_plate} onChange={(e) => setNewBus({ ...newBus, license_plate: e.target.value })} />
            <Button onClick={handleAddBus} className="w-full">Add Bus</Button>
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-sm">Buses ({buses.length})</h4>
              {buses.map((bus: any) => (
                <div key={bus.id} className="p-2 bg-secondary rounded text-sm">
                  Bus {bus.bus_number} - {bus.license_plate}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Route Name" value={newRoute.name} onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })} />
            <Input placeholder="Description" value={newRoute.description} onChange={(e) => setNewRoute({ ...newRoute, description: e.target.value })} />
            <Button onClick={handleAddRoute} className="w-full">Add Route</Button>
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-sm">Routes ({routes.length})</h4>
              {routes.map((route: any) => (
                <div key={route.id} className="p-2 bg-secondary rounded text-sm">
                  {route.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
