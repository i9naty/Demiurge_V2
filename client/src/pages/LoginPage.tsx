import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { Sparkles, LogIn } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-full flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-panel p-8"
      >
        <div className="flex items-center gap-2 justify-center mb-8">
          <Sparkles size={20} className="text-#a855f7" />
          <h1 className="font-mono font-bold text-xl text-#a855f7">DEMIURGE</h1>
        </div>

        <h2 className="text-center font-mono text-sm text-demiurge-muted mb-6">
          Вход в систему
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-demiurge-muted mb-1.5">Имя или Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="master@dungeon.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-demiurge-muted mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            <LogIn size={16} />
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/register" className="text-xs font-mono text-#a855f7 hover:underline">
            Нет аккаунта? Зарегистрироваться
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
