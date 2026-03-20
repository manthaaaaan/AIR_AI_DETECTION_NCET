import { NavLink as RouterNavLink } from 'react-router-dom';
import { Activity, Brain, Flame, Heart, BarChart3, LogOut, MapPin } from 'lucide-react';
import { useAirQuality } from '@/context/AirQualityContext';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/',          label: 'Live',      icon: Activity  },
  { to: '/predict',   label: 'Predict',   icon: Brain     },
  { to: '/hotspots',  label: 'Hotspots',  icon: Flame     },
  { to: '/advisory',  label: 'Advisory',  icon: Heart     },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const Navbar = () => {
  const { alerts, cityName } = useAirQuality();
  const { user, logout } = useAuth();

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-top { display: flex !important; }
          .nav-mobile-bottom { display: flex !important; }
        }
        @media (min-width: 768px) {
          .nav-desktop { display: flex !important; }
          .nav-mobile-top { display: none !important; }
          .nav-mobile-bottom { display: none !important; }
        }
        @keyframes nav-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* ── DESKTOP NAV ── */}
      <nav className="nav-desktop fixed top-0 left-0 right-0 z-[900] glass-card border-b border-border h-16 items-center px-6">
        <div className="flex items-center gap-3 mr-10">
          <div className="w-4 h-4 rounded-full bg-primary animate-pulse-glow" />
          <span style={{ fontFamily: 'Syne, sans-serif' }} className="font-bold text-foreground text-lg">
            <span className="text-primary">Aero</span>Sense
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-1">
          {navItems.map(item => (
            <RouterNavLink key={item.to} to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-white/60 hover:text-white hover:bg-muted/50'
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
          <span style={{ fontFamily: 'Syne, sans-serif' }} className="text-sm text-white/60">{cityName}</span>
          <MapPin size={16} style={{ color: '#00d4aa' }} />
          {user && (
            <div className="flex items-center gap-2 pl-4 border-l border-border">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ''} style={{ width:28, height:28, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(0,212,170,0.15)', border:'1px solid rgba(0,212,170,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#00d4aa', fontFamily:'Syne, sans-serif' }}>
                  {user.displayName?.[0] ?? user.email?.[0]?.toUpperCase()}
                </div>
              )}
              <span style={{ fontFamily:'Syne, sans-serif', fontWeight:500 }} className="text-sm text-white/80">
                {user.displayName ?? user.email}
              </span>
              <button onClick={logout} title="Sign out" className="text-white/40 hover:text-red-400 transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── MOBILE TOP BAR ── */}
      <div className="nav-mobile-top fixed top-0 left-0 right-0 z-[900]"
        style={{ background:'rgba(6,8,14,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)', alignItems:'center', justifyContent:'space-between', padding:'0 16px', height:52 }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#00d4aa', boxShadow:'0 0 8px #00d4aa', flexShrink:0 }} />
          <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:16, color:'#fff' }}>
            <span style={{ color:'#00d4aa' }}>Aero</span>Sense
          </span>
        </div>

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>

          {/* Live location pill */}
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:99, background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.2)' }}>
            <MapPin size={12} style={{ color:'#00d4aa', flexShrink:0 }} />
            <span style={{ fontFamily:'Syne, sans-serif', fontSize:11, color:'rgba(255,255,255,0.7)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {cityName}
            </span>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#00d4aa', boxShadow:'0 0 6px #00d4aa', flexShrink:0, animation:'nav-pulse 1.5s ease-in-out infinite' }} />
          </div>

          {/* Avatar + logout */}
          {user && (
            <div style={{ display:'flex', alignItems:'center', gap:8, paddingLeft:10, borderLeft:'1px solid rgba(255,255,255,0.08)' }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ''} style={{ width:26, height:26, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,212,170,0.15)', border:'1px solid rgba(0,212,170,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#00d4aa', fontFamily:'Syne, sans-serif', flexShrink:0 }}>
                  {user.displayName?.[0] ?? user.email?.[0]?.toUpperCase()}
                </div>
              )}
              <button onClick={logout} title="Sign out" style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', padding:0 }}>
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="nav-mobile-bottom fixed bottom-0 left-0 right-0 z-[900]"
        style={{ background:'rgba(6,8,14,0.97)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(255,255,255,0.07)', alignItems:'center', justifyContent:'space-around', paddingBottom:'env(safe-area-inset-bottom)', paddingTop:8, paddingLeft:4, paddingRight:4, gap:0 }}>
        {navItems.map(item => (
          <RouterNavLink key={item.to} to={item.to} style={{ textDecoration:'none', fontFamily:'Syne, sans-serif', flex:1 }}>
            {({ isActive }) => (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 6px 8px', borderRadius:10, background:isActive?'rgba(0,212,170,0.08)':'transparent', transition:'all 0.2s', position:'relative' }}>
                {isActive && (
                  <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:99, background:'#00d4aa', boxShadow:'0 0 8px #00d4aa' }} />
                )}
                <item.icon size={19} style={{ color:isActive?'#00d4aa':'rgba(255,255,255,0.38)', filter:isActive?'drop-shadow(0 0 5px #00d4aa80)':'none', transition:'all 0.2s', marginTop:4 }} />
                <span style={{ fontSize:10, fontWeight:isActive?700:400, color:isActive?'#00d4aa':'rgba(255,255,255,0.38)', letterSpacing:'0.03em', transition:'all 0.2s', lineHeight:1 }}>
                  {item.label}
                </span>
              </div>
            )}
          </RouterNavLink>
        ))}
      </nav>
    </>
  );
};

export default Navbar;