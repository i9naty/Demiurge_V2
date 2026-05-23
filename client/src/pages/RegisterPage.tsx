import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { Sparkles, UserPlus } from 'lucide-react';

export function RegisterPage() {
  const { register, isLoading } = useStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Пароль должен быть минимум 8 символов');
      return;
    }
    try {
      await register(username, email, password);
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
          Создание аккаунта
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-demiurge-muted mb-1.5">Имя пользователя</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="input-field"
              placeholder="master_dungeon"
              minLength={3}
              maxLength={32}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-demiurge-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
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
              placeholder="Минимум 8 символов"
              minLength={8}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            <UserPlus size={16} />
            {isLoading ? 'Создание...' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs font-mono text-#a855f7 hover:underline">
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
