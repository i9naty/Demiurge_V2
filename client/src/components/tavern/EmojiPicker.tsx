import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJI_CATEGORIES: Record<string, { icon: string; emojis: string[] }> = {
  smileys: { icon: '😀', emojis: ['😀','😂','🤣','😍','😎','🤩','😡','😭','🥺','😴','🤔','😅','🥳','😇','🤗','😤'] },
  gestures: { icon: '👍', emojis: ['👍','👎','👏','🙌','🤝','💪','✌️','🤞','👆','👇','👈','👉','🖕','🤙','🙏','💅'] },
  gaming: { icon: '🎮', emojis: ['🎮','🎲','🎯','🎪','🎭','🎨','⚔️','🛡️','🗡️','🏹','💣','🔥','💀','👑','🏆','🎁'] },
  fantasy: { icon: '🐉', emojis: ['🐉','🧙','🧝','🧌','🐺','🦅','🐍','🦉','🌲','🏰','🗡️','🔮','⚡','✨','🌟','💎'] },
  objects: { icon: '📦', emojis: ['📦','💰','🔑','🗝️','📜','🕯️','🍺','🍞','💊','🧪','⚗️','🪓','⛏️','🔨','🧲','📯'] },
  hearts: { icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💖','💘','💝','💗','💓','♥️'] },
  flags: { icon: '🚩', emojis: ['🚩','🏁','🎌','🏴','🏳️','⚠️','✅','❌','❓','💯','🔞','♻️','➕','➖','➗','🟢'] },
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flatMap(c => c.emojis);

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [category, setCategory] = useState('smileys');
  const [search, setSearch] = useState('');

  const filteredEmojis = search
    ? ALL_EMOJIS.filter(e => e.includes(search))
    : EMOJI_CATEGORIES[category]?.emojis || [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="absolute bottom-full mb-2 left-0 bg-[#0f0f16] border border-[#1a1a2e] rounded-2xl shadow-2xl p-3 w-[320px] z-50"
      onClick={e => e.stopPropagation()}
    >
      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск эмодзи..."
        className="w-full bg-[#1a1a2e] border border-[#252540] rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none mb-2 focus:border-purple-500/50"
        autoFocus
      />

      {/* Categories */}
      {!search && (
        <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
          {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-2 py-1 rounded-lg text-sm transition-colors ${
                category === key ? 'bg-purple-600/20 border border-purple-500/30' : 'hover:bg-white/5'
              }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto">
        {filteredEmojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Recent */}
      <div className="mt-2 pt-2 border-t border-[#1a1a2e]">
        <p className="text-[9px] font-mono text-zinc-600 mb-1">Быстрые</p>
        <div className="flex gap-1 flex-wrap">
          {['👍','❤️','😂','😮','😢','🔥','🎲','⚔️','✨','💀','🎯','👑'].map(emoji => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); onClose(); }}
              className="w-7 h-7 flex items-center justify-center text-base hover:bg-white/10 rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
