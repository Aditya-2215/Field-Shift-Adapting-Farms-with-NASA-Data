import React from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Sprout } from 'lucide-react';
import type { RiskLevel, SuitabilityClass } from '../../../shared/types/agri';

export function RiskIndicator({ level, score }: { level: RiskLevel; score?: number }) {
  const styles: Record<RiskLevel, { color: string; Icon: typeof CheckCircle2 }> = {
    Low: { color: 'text-[#16A34A]', Icon: CheckCircle2 },
    Moderate: { color: 'text-[#D97706]', Icon: Info },
    High: { color: 'text-[#EA580C]', Icon: AlertTriangle },
    Critical: { color: 'text-[#DC2626]', Icon: ShieldAlert }
  };
  const { color, Icon } = styles[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${color} whitespace-nowrap`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{level} Risk</span>
      {score !== undefined && <span className="font-mono-num">({score}/100)</span>}
    </span>
  );
}

export function SuitabilityIndicator({ classification }: { classification: SuitabilityClass }) {
  const color =
    classification === 'Highly Suitable'
      ? 'text-[#16A34A]'
      : classification === 'Moderately Suitable'
      ? 'text-[#1B4D3E]'
      : classification === 'Marginally Suitable'
      ? 'text-[#D97706]'
      : 'text-[#DC2626]';
  return <span className={`text-xs font-semibold ${color} whitespace-nowrap`}>{classification}</span>;
}

export function LoadingCardGrid({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading agricultural intelligence">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-[#DCE3DC] bg-white p-5 animate-pulse">
            <div className="h-3 w-24 bg-[#E6ECE6] rounded mb-3" />
            <div className="h-7 w-32 bg-[#E6ECE6] rounded mb-2" />
            <div className="h-3 w-40 bg-[#F0F4F0] rounded" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-xl border border-[#DCE3DC] bg-white p-5 animate-pulse" />
    </div>
  );
}

export function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#DCE3DC] bg-white p-8 text-center max-w-xl mx-auto">
      <div className="w-10 h-10 rounded-lg bg-[#1B4D3E]/10 text-[#1B4D3E] flex items-center justify-center mx-auto mb-3">
        <Sprout className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-semibold text-[#111C15] mb-1.5">{title}</h3>
      <p className="text-sm text-[#4A5D50] mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-sm font-medium hover:bg-[#143B2F] transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F6F8F5] p-6">
          <div className="max-w-md w-full rounded-xl border border-[#DCE3DC] bg-white p-6">
            <div className="flex items-center gap-2 text-[#DC2626] font-semibold mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Application Error</span>
            </div>
            <p className="text-sm text-[#4A5D50] mb-4">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-sm font-medium hover:bg-[#143B2F]"
            >
              Reload AgriShift AI
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
