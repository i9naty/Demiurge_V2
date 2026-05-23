import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, Component, ReactNode, useState, useRef } from 'react';
import { useStore } from './store';
import { Navbar } from './components/layout/Navbar';
import { ParticleBackground } from './components/ui/ParticleBackground';
import { DMPanel } from './components/social/DMPanel';
import { ToastContainer } from './components/ui/Toast';
import { CommandPalette, useCommandPalette } from './components/ui/CommandPalette';
import { CreateModal } from './components/ui/CreateModal';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RoomPage } from './pages/RoomPage';
import { WorldPage } from './pages/WorldPage';
import { SocialPage } from './pages/SocialPage';
import { ProfilePage } from './pages/ProfilePage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SessionsPage } from './pages/SessionsPage';
import { TavernPage } from './pages/TavernPage';
import { StoryCreatePage } from './pages/StoryCreatePage';
import { StoryGamePage } from './pages/StoryGamePage';

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: number }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; resetKey: number }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error.message, info?.componentStack?.slice(0, 300));
  }
  componentDidUpdate(prevProps: { resetKey: number }) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-[#06060c]" role="alert">
          <div className="text-center max-w-md px-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-lg">⚠</span>
            </div>
            <p className="font-mono text-red-400 mb-2 text-sm">Ошибка на странице</p>
            <p className="font-mono text-[10px] text-zinc-500 mb-5 break-all bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 max-h-16 overflow-auto">
              {this.state.error?.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => this.setState({ hasError: false, error: null })}
                className="px-5 py-2.5 rounded-xl font-mono text-xs border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.1] transition-all">
                Попробовать снова
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

  // Auth check on token change
  useEffect(() => {
    if (token && !user) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.id) { useStore.setState({ user: data }); connectSocket(); }
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
        <LoginPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary resetKey={resetKey.current}>
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

  // DM notification badge in title
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
