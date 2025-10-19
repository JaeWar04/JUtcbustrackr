import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bus, MapPin, Navigation, Users } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-primary p-6 rounded-full shadow-glow">
              <Bus className="h-16 w-16 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            BusTrackr+
          </h1>
          <p className="text-xl text-muted-foreground">
            Never miss your bus again. Track buses in real-time, get accurate ETAs, and plan your journey smarter.
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button onClick={() => navigate('/auth')} className="bg-gradient-primary hover:opacity-90 px-8 py-6 text-lg">
              Get Started
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
          <div className="bg-card p-6 rounded-lg shadow-md text-center">
            <Navigation className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Real-Time Tracking</h3>
            <p className="text-sm text-muted-foreground">See bus locations update live on the map</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-md text-center">
            <MapPin className="h-12 w-12 text-accent mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Accurate ETAs</h3>
            <p className="text-sm text-muted-foreground">Know exactly when your bus will arrive</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-md text-center">
            <Users className="h-12 w-12 text-success mx-auto mb-4" />
            <h3 className="font-semibold mb-2">For Everyone</h3>
            <p className="text-sm text-muted-foreground">Passengers, drivers, and admins all in one</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
