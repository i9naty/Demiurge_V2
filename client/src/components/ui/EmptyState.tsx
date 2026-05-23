import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-zinc-600">{icon}</div>}
      <p className="text-xs font-mono text-zinc-500">{message}</p>
    </div>
  );
}
