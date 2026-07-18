import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';

export default function RenewBadge({ renewDate, compact = false }) {
  if (!renewDate) return null;

  const days = differenceInDays(parseISO(renewDate), new Date());

  if (days < 0) {
    return compact ? (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 font-semibold" style={{ borderRadius: 2 }}>
        <AlertTriangle className="w-2.5 h-2.5" /> OVERDUE
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold" style={{ borderRadius: 2 }}>
        <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(days)} days
      </span>
    );
  }

  if (days <= 7) {
    return compact ? (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 font-semibold" style={{ borderRadius: 2 }}>
        <Clock className="w-2.5 h-2.5" /> {days}d
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold" style={{ borderRadius: 2 }}>
        <Clock className="w-3 h-3" /> Expires in {days} days
      </span>
    );
  }

  if (days <= 30) {
    return compact ? (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 font-semibold" style={{ borderRadius: 2 }}>
        <Clock className="w-2.5 h-2.5" /> {days}d
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold" style={{ borderRadius: 2 }}>
        <Clock className="w-3 h-3" /> Renew in {days} days
      </span>
    );
  }

  return null;
}