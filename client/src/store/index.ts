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

async function apiPost(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const msg = json.error?.message || 'Ошибка запроса';
    throw new Error(msg);
  }
  return json.data;
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
      const data = await apiPost('/auth/login', { username, password });
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
      const data = await apiPost('/auth/register', { username, email, password });
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
      const data = await apiPost('/auth/guest');
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
