import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

const API = '/api';

interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  displayName?: string;
  bio?: string;
  role: string;
  subscriptionTier?: string;
  isGuest?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  socket: Socket | null;
  isLoading: boolean;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  guestLogin: () => Promise<void>;
  logout: () => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('demiurge_token'),
  socket: null,
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка входа');
      }

      const data = await res.json();
      localStorage.setItem('demiurge_token', data.token);
      localStorage.setItem('demiurge_refresh', data.refreshToken);
      set({ user: data.user, token: data.token, isLoading: false });
      get().connectSocket();
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка регистрации');
      }

      const data = await res.json();
      localStorage.setItem('demiurge_token', data.token);
      localStorage.setItem('demiurge_refresh', data.refreshToken);
      set({ user: data.user, token: data.token, isLoading: false });
      get().connectSocket();
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  guestLogin: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API}/auth/guest`, { method: 'POST' });
      if (!res.ok) throw new Error('Ошибка гостевого входа');

      const data = await res.json();
      localStorage.setItem('demiurge_token', data.token);
      localStorage.setItem('demiurge_refresh', data.refreshToken);
      set({ user: data.user, token: data.token, isLoading: false });
      get().connectSocket();
    } catch (err: any) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    get().disconnectSocket();
    localStorage.removeItem('demiurge_token');
    localStorage.removeItem('demiurge_refresh');
    set({ user: null, token: null });
  },

  connectSocket: () => {
    const { token, socket } = get();
    if (socket?.connected) return;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    if (!token) return;

    const newSocket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('🔌 Socket подключён');
    });

    newSocket.on('connect_error', (err) => {
      console.warn('🔌 Socket error:', err.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket отключён:', reason);
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
