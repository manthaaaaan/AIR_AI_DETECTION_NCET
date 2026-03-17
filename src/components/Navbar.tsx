import { NavLink as RouterNavLink } from 'react-router-dom';
import { Activity, Brain, Flame, Heart, BarChart3, Bell } from 'lucide-react';
import { useAirQuality } from '@/context/AirQualityContext';

const navItems = [
  { to: '/', label: 'Live', icon: Activity },
  { to: '/predict', label: 'Predict', icon: Brain },
  { to: '/hotspots', label: 'Hotspots', icon: Flame },
  { to: '/advisory', label: 'Advisory', icon: Heart },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const Navbar = () => {
  const { alerts, cityName } = useAirQuality();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[900] glass-card border-b border-border h-16 flex items-center px-6">
      <div className="flex items-center gap-3 mr-10">
        <div className="w-4 h-4 rounded-full bg-primary animate-pulse-glow" />
        <span className="font-heading font-bold text-foreground text-lg">
          <span className="text-primary">Aero</span>Sense
        </span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 flex-1">
        {navItems.map(item => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-mono transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </RouterNavLink>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm font-mono text-muted-foreground hidden sm:inline">{cityName}</span>
        <div className="relative">
          <Bell size={18} className="text-muted-foreground" />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[9px] font-mono flex items-center justify-center text-destructive-foreground">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[850] glass-card border-t border-border flex justify-around py-3 px-2">
        {navItems.map(item => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[10px] font-mono transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </RouterNavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
