import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';

const Login = () => {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap');
        .pred-bg {
          position: fixed; inset: 0; z-index: 0; overflow: hidden;
          background:
            radial-gradient(ellipse 80% 60% at 10% 10%, #0a2e22 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 90% 80%, #071428 0%, transparent 60%),
            #050810;
        }
        .pred-orb { position:absolute;border-radius:50%;filter:blur(60px);opacity:0.9;animation:pred-orb-drift linear infinite; }
        .pred-orb-1 { width:700px;height:700px;top:-200px;left:-150px;background:radial-gradient(circle,rgba(0,212,170,0.7) 0%,rgba(0,180,140,0.3) 40%,transparent 70%);animation-duration:18s; }
        .pred-orb-2 { width:600px;height:600px;bottom:-150px;right:-100px;background:radial-gradient(circle,rgba(0,100,220,0.6) 0%,rgba(0,60,180,0.2) 45%,transparent 70%);animation-duration:24s;animation-direction:reverse; }
        .pred-orb-3 { width:450px;height:450px;top:40%;left:55%;background:radial-gradient(circle,rgba(0,200,160,0.45) 0%,transparent 70%);animation-duration:28s;animation-delay:-8s; }
        @keyframes pred-orb-drift {
          0%   { transform:translate(0,0) scale(1); }
          25%  { transform:translate(50px,-40px) scale(1.08); }
          50%  { transform:translate(25px,55px) scale(0.93); }
          75%  { transform:translate(-40px,22px) scale(1.05); }
          100% { transform:translate(0,0) scale(1); }
        }
        .pred-grid {
          position:absolute;inset:0;
          background-image:linear-gradient(rgba(0,212,170,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,170,0.05) 1px,transparent 1px);
          background-size:48px 48px;
          mask-image:radial-gradient(ellipse at 50% 40%,black 20%,transparent 75%);
        }
        .pred-vignette { position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(5,8,16,0.65) 100%); }

        .login-wrapper {
          position: relative; z-index: 1;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Syne', sans-serif;
          padding: 24px 16px;
          box-sizing: border-box;
        }
        .login-card {
          background: rgba(8,14,24,0.75);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(0,212,170,0.25);
          border-radius: 24px;
          padding: 64px 56px;
          text-align: center;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 0 40px rgba(0,212,170,0.12), 0 0 80px rgba(0,212,170,0.06), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        @media (max-width: 767px) {
          .login-card {
            padding: 28px 20px;
            border-radius: 18px;
          }
        }
      `}</style>

      <div className="pred-bg">
        <div className="pred-orb pred-orb-1" />
        <div className="pred-orb pred-orb-2" />
        <div className="pred-orb pred-orb-3" />
        <div className="pred-grid" />
        <div className="pred-vignette" />
      </div>

      <div className="login-wrapper">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
        >
          {/* Logo */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 38, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.03em' }}>
              <span style={{ color: '#00d4aa' }}>Aero</span>Sense
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, letterSpacing: '0.15em', fontWeight: 500 }}>
              REAL-TIME AIR QUALITY MONITOR
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 24 }} />

          <p style={{ fontSize: 15, color: '#cbd5e1', marginBottom: 20, letterSpacing: '0.04em', fontWeight: 500 }}>
            Sign in to access your dashboard
          </p>

          {/* Google button */}
          <button
            onClick={signInWithGoogle}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 28px', background: '#fff', border: 'none',
              borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 600,
              color: '#1f2937', width: '100%', justifyContent: 'center',
              transition: 'opacity 0.2s', fontFamily: 'Syne, sans-serif',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <p style={{ fontSize: 12, color: '#64748b', marginTop: 16, lineHeight: 1.6, fontWeight: 400 }}>
            By signing in you agree to our terms of service and privacy policy.
          </p>

          {/* Team credit */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 12, color: '#334155', fontWeight: 500, letterSpacing: '0.06em', margin: 0 }}>
              Built with ♥ by <span style={{ color: '#00d4aa', fontWeight: 700 }}>Team GitHappens</span>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Login;