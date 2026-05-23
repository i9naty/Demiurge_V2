import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, ChevronUp, ChevronDown, Settings } from 'lucide-react';

interface VoicePeer {
  userId: string;
  username: string;
  isSpeaking: boolean;
}

interface Props {
  channelName: string;
  participants: VoicePeer[];
  myUserId: string;
  isMuted: boolean;
  isDeafened: boolean;
  volume: number;
  pushToTalk: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onVolumeChange: (v: number) => void;
  onTogglePTT: () => void;
  onLeave: () => void;
}

export function VoicePanel({
  channelName, participants, myUserId,
  isMuted, isDeafened, volume, pushToTalk,
  onToggleMute, onToggleDeafen, onVolumeChange, onTogglePTT, onLeave,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-[#0f0f16] border border-[#1a1a2e] rounded-2xl shadow-2xl p-3 min-w-[320px] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-zinc-300 font-bold truncate max-w-[120px]">
              {channelName}
            </span>
            <span className="font-mono text-[10px] text-zinc-600">
              {participants.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1 rounded-md transition-colors ${showSettings ? 'bg-white/10 text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-400"
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
            <button
              onClick={onLeave}
              className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <PhoneOff size={13} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onToggleMute}
            className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] flex items-center justify-center gap-1.5 transition-all ${
              isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#1a1a2e] text-zinc-400 border border-transparent hover:bg-white/5'
            }`}
          >
            {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
            {isMuted ? 'Muted' : pushToTalk ? 'PTT' : 'Mic'}
          </button>
          <button
            onClick={onTogglePTT}
            className={`py-1.5 px-2 rounded-lg font-mono text-[9px] transition-all ${
              pushToTalk ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[#1a1a2e] text-zinc-600 border border-transparent hover:bg-white/5'
            }`}
            title="Push-to-Talk (удерживай Ctrl)"
          >
            PTT
          </button>
          <button
            onClick={onToggleDeafen}
            className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] flex items-center justify-center gap-1.5 transition-all ${
              isDeafened ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#1a1a2e] text-zinc-400 border border-transparent hover:bg-white/5'
            }`}
          >
            {isDeafened ? <VolumeX size={12} /> : <Volume2 size={12} />}
            {isDeafened ? 'Глухо' : 'Слышу'}
          </button>
        </div>

        {/* Volume slider */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="flex items-center gap-2 px-1">
                <Volume2 size={11} className="text-zinc-600" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(volume * 100)}
                  onChange={e => onVolumeChange(parseInt(e.target.value) / 100)}
                  className="flex-1 accent-purple-500 h-1"
                />
                <span className="font-mono text-[9px] text-zinc-500 w-7 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Participants list */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-[#1a1a2e] pt-2 space-y-1 max-h-[180px] overflow-y-auto">
                {participants.map(p => (
                  <div key={p.userId} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-white/[0.03]">
                    <div className={`relative w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                      p.isSpeaking
                        ? 'border-emerald-500 bg-emerald-500/20'
                        : 'border-transparent bg-purple-600/20'
                    }`}>
                      <span className="font-mono text-[9px] text-zinc-300">
                        {p.username?.slice(0, 2).toUpperCase()}
                      </span>
                      {p.isSpeaking && (
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] text-zinc-300 truncate">
                        {p.username}
                        {p.userId === myUserId ? ' (Вы)' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {p.isSpeaking ? (
                        <Mic size={10} className="text-emerald-400" />
                      ) : (
                        <MicOff size={10} className="text-zinc-700" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
