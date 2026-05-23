import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-0 border-b border-white/[0.05]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative px-4 py-2.5 text-xs font-mono transition-colors duration-200 ${
            active === tab.id ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          {tab.label}
          {active === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
              transition={{ duration: 0.2 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
