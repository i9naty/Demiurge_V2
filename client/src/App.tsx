import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, Component, ReactNode, useState, useRef } from 'react';
import { useStore } from './store';
import { Navbar } from './components/layout/Navbar';
import { ParticleBackground } from './components/ui/ParticleBackground';
import { DMPanel } from './components/social/DMPanel';
import { ToastContainer } from './components/ui/Toast';
import { CommandPalette, useCommandPalette } from './components/ui/CommandPalette';
import { CreateModal } from './components/ui/CreateModal';

const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const RoomPage = lazy(() => import('./pages/RoomPage').then(m => ({ default: m.RoomPage })));
const WorldPage = lazy(() => import('./pages/WorldPage').then(m => ({ default: m.WorldPage })));
const SocialPage = lazy(() => import('./pages/SocialPage').then(m => ({ default: m.SocialPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const SessionsPage = lazy(() => import('./pages/SessionsPage').then(m => ({ default: m.SessionsPage })));
const TavernPage = lazy(() => import('./pages/TavernPage').then(m => ({ default: m.TavernPage })));
const StoryCreatePage = lazy(() => import('./pages/StoryCreatePage').then(m => ({ default: m.StoryCreatePage })));
const StoryGamePage = lazy(() => import('./pages/StoryGamePage').then(m => ({ default: m.StoryGamePage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: number }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; resetKey: number }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <div className="text-4xl mb-4">💥</div>
            <h2 className="text-lg font-mono text-red-400 mb-2">Ошибка</h2>
            <p className="text-xs font-mono text-zinc-400 mb-4 max-w-md">
              {this.state.error?.message?.slice(0, 200) || 'Неизвестная ошибка'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 rounded-xl font-mono text-xs bg-white/[0.04] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.06] transition-all">
                Закрыть
              </button>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl font-mono text-xs bg-purple-600 text-white hover:bg-purple-500 transition-all">
                Перезагрузить
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

let errorKeyCounter = 0;

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);
  const connectSocket = useStore((s) => s.connectSocket);

  useEffect(() => {
    if (token && !user) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.success && data.data?.id) { useStore.setState({ user: data.data }); connectSocket(); }
          else if (data?.id) { useStore.setState({ user: data }); connectSocket(); }
        })
        .catch(() => {});
    }
  }, [token, user, connectSocket]);

  useEffect(() => {
    (window as any).__demiurge_username = user?.username;
  }, [user?.username]);

  const isAuth = !!(token && user);
  const prevAuth = useRef(isAuth);

  useEffect(() => {
    const wasAuth = prevAuth.current;
    prevAuth.current = isAuth;

    if (!wasAuth && isAuth) {
      if (location.pathname === '/login' || location.pathname === '/register') {
        navigate('/', { replace: true });
      }
    }
    if (wasAuth && !isAuth) {
      if (location.pathname !== '/login' && location.pathname !== '/register') {
        navigate('/login', { replace: true });
      }
    }
  }, [isAuth, location.pathname, navigate]);

  const resetKey = useRef(0);
  if (location.key !== undefined) {
    resetKey.current = ++errorKeyCounter;
  }

  const publicPath = location.pathname;
  const isProtectedRoute = ['/room', '/world', '/payments', '/story'].some(p => publicPath.startsWith(p));

  if (isProtectedRoute && !isAuth) {
    return (
      <ErrorBoundary resetKey={0}>
        <Suspense fallback={<PageLoader />}>
          <LoginPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary resetKey={resetKey.current}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/world/:roomId" element={<WorldPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/discord" element={<TavernPage />} />
          <Route path="/story" element={<StoryCreatePage />} />
          <Route path="/story/:sessionId" element={<StoryGamePage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const isAuth = !!(useStore((s) => s.token) && useStore((s) => s.user));
  const socket = useStore((s) => s.socket);
  const { open, setOpen } = useCommandPalette();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener('open:create_modal', handler);
    return () => window.removeEventListener('open:create_modal', handler);
  }, []);

  useEffect(() => {
    const base = 'Demiurge';
    if (!socket) { document.title = base; return; }
    let count = 0;
    const inc = () => { count++; document.title = `(${count}) ${base}`; };
    const reset = () => { count = 0; document.title = base; };
    document.addEventListener('focus', reset);
    socket.on('dm:message', inc);
    return () => {
      socket.off('dm:message', inc);
      document.removeEventListener('focus', reset);
      document.title = base;
    };
  }, [socket]);

  return (
    <div className="h-screen w-screen flex flex-col">
      <ParticleBackground />
      <Navbar />
      <main className="flex-1 overflow-hidden relative z-10">
        <AppRoutes />
      </main>
      {isAuth && <DMPanel />}
      <ToastContainer />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
