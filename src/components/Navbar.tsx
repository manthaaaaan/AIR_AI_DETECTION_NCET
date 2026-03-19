import { NavLink as RouterNavLink } from 'react-router-dom';
import { Activity, Brain, Flame, Heart, BarChart3, Bell, LogOut } from 'lucide-react';
import { useAirQuality } from '@/context/AirQualityContext';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', label: 'Live', icon: Activity },
  { to: '/predict', label: 'Predict', icon: Brain },
  { to: '/hotspots', label: 'Hotspots', icon: Flame },
  { to: '/advisory', label: 'Advisory', icon: Heart },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const Navbar = () => {
  const { alerts, cityName } = useAirQuality();
  const { user, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[900] glass-card border-b border-border h-16 flex items-center px-6">
      <div className="flex items-center gap-3 mr-10">
        <div className="w-4 h-4 rounded-full bg-primary animate-pulse-glow" />
        <span style={{ fontFamily: 'Syne, sans-serif' }} className="font-bold text-foreground text-lg">
          <span className="text-primary">Aero</span>Sense
        </span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 flex-1">
        {navItems.map(item => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-white/60 hover:text-white hover:bg-muted/50'
              }`
            }
            style={{ fontFamily: 'Syne, sans-serif', fontWeight: 500 }}
          >
            <item.icon size={16} />
            {item.label}
          </RouterNavLink>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <span
          style={{ fontFamily: 'Syne, sans-serif' }}
          className="text-sm text-white/60 hidden sm:inline"
        >
          {cityName}
        </span>

        {/* Bell */}
        <div className="relative">
          <Bell size={18} className="text-white/50" />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[9px] font-mono flex items-center justify-center text-destructive-foreground">
              {alerts.length}
            </span>
          )}
        </div>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2 pl-4 border-l border-border">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#00d4aa',
                fontFamily: 'Syne, sans-serif',
              }}>
                {user.displayName?.[0] ?? user.email?.[0]?.toUpperCase()}
              </div>
            )}
            <span
              style={{ fontFamily: 'Syne, sans-serif', fontWeight: 500 }}
              className="text-sm text-white/80 hidden lg:inline"
            >
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={logout}
              title="Sign out"
              className="text-white/40 hover:text-red-400 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[850] glass-card border-t border-border flex justify-around py-3 px-2">
        {navItems.map(item => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
                isActive ? 'text-primary' : 'text-white/50'
              }`
            }
            style={{ fontFamily: 'Syne, sans-serif' }}
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