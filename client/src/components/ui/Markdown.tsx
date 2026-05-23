import { Fragment } from 'react';

export function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const parts: { type: string; content: string }[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|__[^_]+__|_[^_]+_)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: text.slice(lastIdx, match.index) });
    }
    const m = match[0];

    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push({ type: 'bold', content: m.slice(2, -2) });
    } else if (m.startsWith('__') && m.endsWith('__')) {
      parts.push({ type: 'bold', content: m.slice(2, -2) });
    } else if (m.startsWith('*') && m.endsWith('*')) {
      parts.push({ type: 'italic', content: m.slice(1, -1) });
    } else if (m.startsWith('_') && m.endsWith('_')) {
      parts.push({ type: 'italic', content: m.slice(1, -1) });
    } else if (m.startsWith('`') && m.endsWith('`')) {
      parts.push({ type: 'code', content: m.slice(1, -1) });
    }

    lastIdx = match.index + m.length;
    if (parts.length > 50) break;
  }

  if (lastIdx < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIdx) });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) => {
        switch (p.type) {
          case 'bold': return <strong key={i} className="font-bold text-zinc-200">{p.content}</strong>;
          case 'italic': return <em key={i} className="italic text-zinc-300">{p.content}</em>;
          case 'code': return <code key={i} className="bg-[#1a1a2e] border border-[#252540] rounded px-1 py-0.5 text-[11px] font-mono text-amber-400">{p.content}</code>;
          default: return <Fragment key={i}>{p.content}</Fragment>;
        }
      })}
    </>
  );
}
