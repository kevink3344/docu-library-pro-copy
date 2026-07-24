import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '@/lib/OrgContext';
import { useAuth } from '@/lib/AuthContext';
import { getActiveMessages, getDismissedMessageIds, dismissMessage } from '@/api/system-messages';
import { getGuestDismissed, addGuestDismissal } from '@/utils/guest-message-dismissal';

export default function SystemMessageBanner() {
  const { currentOrg } = useOrg();
  const { user, isAuthenticated } = useAuth();

  const [messages, setMessages] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch active messages and dismissed IDs
  useEffect(() => {
    if (!currentOrg) {
      setMessages([]);
      setDismissedIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [activeMessages, serverDismissed] = await Promise.all([
          getActiveMessages(currentOrg.id),
          isAuthenticated
            ? getDismissedMessageIds(currentOrg.id).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (cancelled) return;

        // Merge server dismissals (auth) + localStorage dismissals (guest)
        const dismissed = new Set(serverDismissed || []);
        if (!isAuthenticated) {
          const guestDismissed = getGuestDismissed(currentOrg.id);
          guestDismissed.forEach(id => dismissed.add(id));
        }

        setMessages(activeMessages || []);
        setDismissedIds(dismissed);
      } catch {
        // Silently fail — banner is non-critical UI
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [currentOrg, isAuthenticated]);

  // Handle dismiss
  const handleDismiss = useCallback(async (messageId) => {
    // Optimistic update
    setDismissedIds(prev => new Set([...prev, messageId]));

    try {
      if (isAuthenticated) {
        await dismissMessage(messageId);
      } else if (currentOrg) {
        addGuestDismissal(currentOrg.id, messageId);
      }
    } catch {
      // Rollback on failure (re-add to visible set via refetch—for simplicity, just re-add)
      setDismissedIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [isAuthenticated, currentOrg]);

  // Compute visible messages
  const visibleMessages = messages.filter(m => !dismissedIds.has(m.id));

  if (loading || !currentOrg || visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {visibleMessages.map(message => (
        <div
          key={message.id}
          className="px-4 py-2.5 text-sm border-b border-border/50"
          style={{ backgroundColor: message.pastel_color }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-3">
              {message.title && (
                <span className="font-semibold text-foreground block sm:inline sm:whitespace-nowrap">
                  {message.title}
                </span>
              )}
              <span className="text-foreground/90 block sm:inline">
                {message.text}
              </span>
            </div>
            {message.is_dismissable ? (
              <button
                onClick={() => handleDismiss(message.id)}
                className="shrink-0 text-foreground/60 hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
                aria-label="Dismiss message"
              >
                ✕
              </button>
            ) : (
              <span className="shrink-0 text-foreground/40 text-xs pt-0.5" title="Persistent message">
                📌
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}