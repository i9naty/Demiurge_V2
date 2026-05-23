import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Dices, Minus } from 'lucide-react';
import { DiceRoller } from './DiceRoller';

function renderMsg(t: string): React.ReactNode {
  const p: React.ReactNode[] = []; let r = t; let k = 0;
  while (r.length) {
    let m: RegExpMatchArray|null;
    if ((m = r.match(/^\*\*(.+?)\*\*/))) { p.push(<strong key={k++}>{m[1]}</strong>); r = r.slice(m[0].length); }
    else if ((m = r.match(/^\*(.+?)\*/))) { p.push(<em key={k++}>{m[1]}</em>); r = r.slice(m[0].length); }
    else if ((m = r.match(/^`(.+?)`/))) { p.push(<code key={k++} className="bg-white/[0.06] px-0.5 rounded text-amber-400 text-[10px]">{m[1]}</code>); r = r.slice(m[0].length); }
    else { p.push(r[0]); r = r.slice(1); }
  }
  return <>{p}</>;
}

interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  type: string;
  createdAt: string;
}

interface Props {
  messages: Message[];
  onSend: (content: string) => void;
  currentUserId: string;
}

export function ChatPanel({ messages, onSend, currentUserId }: Props) {
  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  if (collapsed) {
    return (
      <div className="w-10 bg-[#111118] border-l border-[#1a1a2e] flex flex-col items-center pt-2 shrink-0">
        <button onClick={() => setCollapsed(false)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors" title="Чат">
          <Dices size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-[#111118] border-l border-[#1a1a2e] flex flex-col shrink-0">
      <div className="h-9 border-b border-[#1a1a2e] flex items-center px-3 justify-between">
        <span className="font-mono text-[11px] text-zinc-400">Чат</span>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
          <Minus size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {messages.length === 0 && (
          <p className="text-[10px] text-zinc-600 font-mono text-center mt-4">Нет сообщений</p>
        )}
        {messages.map((msg) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`text-[11px] leading-relaxed ${msg.type === 'system' ? 'text-zinc-600 italic text-center' : ''}`}>
            {msg.type !== 'system' && (
              <span className={`font-mono font-semibold mr-1 ${msg.userId === currentUserId ? 'text-violet-400' : 'text-amber-400'}`}>
                {msg.username}:
              </span>
            )}
            <span className={`font-mono ${msg.type === 'roll' ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}`}>
              {msg.type === 'system' ? msg.content : renderMsg(msg.content)}
            </span>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {showDiceRoller && <DiceRoller onRoll={onSend} onClose={() => setShowDiceRoller(false)} />}
      </AnimatePresence>

      <div className="p-2 border-t border-[#1a1a2e] flex items-center gap-1.5">
        <button
          onClick={() => setShowDiceRoller(true)}
          className="p-1.5 rounded-md transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
          title="Бросок кубиков"
        >
          <Dices size={15} />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="/roll d20+5 — бросок дайса"
          className="flex-1 bg-transparent border-none outline-none text-[12px] font-mono text-zinc-300 placeholder:text-zinc-600"
        />
        {/* Quick roll chips */}
        <div className="flex items-center gap-0.5 mr-1">
          {['d20', 'd12', 'd8', 'd6', 'd4'].map(d => (
            <button key={d} onClick={() => { setInput(`/roll 1${d}`); }}
              className="text-[8px] font-mono text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 px-1 py-0.5 rounded transition-colors">{d}</button>
          ))}
        </div>
        <button onClick={send} disabled={!input.trim()} className="p-1.5 rounded-md text-violet-400 hover:bg-purple-600/10 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
