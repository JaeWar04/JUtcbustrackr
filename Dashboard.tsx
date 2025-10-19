/**
 * Dashboard Page
 * 
 * This is the main dashboard that routes users to the appropriate view
 * based on their role:
 * - Passengers see the passenger dashboard (track buses, get ETAs)
 * - Drivers see the driver dashboard (manage trips, send GPS updates)
 * - Admins see the admin panel (manage buses, routes, stops)
 * 
 * Features:
 * - Role-based routing
 * - Authentication check
 * - Logout functionality
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, LogOut } from 'lucide-react';
import PassengerDashboard from '@/components/Dashboard/PassengerDashboard';
import DriverDashboard from '@/components/Dashboard/DriverDashboard';
import AdminDashboard from '@/components/Dashboard/AdminDashboard';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  /**
   * Check authentication and fetch user profile
   */
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔐 Checking authentication...');
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('❌ No session found, redirecting to auth...');
        navigate('/auth');
        return;
      }

      console.log('✅ Session found for user:', session.user.email);
      setUserEmail(session.user.email || null);

      // Fetch user profile to get role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('❌ Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Could not load your profile. Please try again.",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ User role:', profile.role);
      setUserRole(profile.role);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    console.log('👋 Logging out...');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ Logout error:', error);
      toast({
        title: "Error",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate('/auth');
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with logout button */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">BusTrackr+</h1>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Render appropriate dashboard based on user role */}
      <main className="container mx-auto px-4 py-6">
        {userRole === 'passenger' && <PassengerDashboard />}
        {userRole === 'driver' && <DriverDashboard />}
        {userRole === 'admin' && <AdminDashboard />}
        
        {!userRole && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Unable to determine user role</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
