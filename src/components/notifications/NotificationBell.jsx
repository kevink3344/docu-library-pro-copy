import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { db } from '@/api/db';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const notifs = await db.Notification.filter({ user_id: user.id, is_read: false }, '-created_date', 20);
    setNotifications(notifs);
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const markRead = async (id) => {
    await db.Notification.update(id, { is_read: true });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    await Promise.all(notifications.map(n => db.Notification.update(n.id, { is_read: true })));
    setNotifications([]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
        style={{ borderRadius: 2 }}
      >
        <Bell className="w-4 h-4" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center" style={{ borderRadius: 2 }}>
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border z-50 shadow-sm" style={{ borderRadius: 2 }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">No new notifications</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="px-3 py-2.5 border-b border-border last:border-0 hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium leading-tight">{n.document_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono-data">
                          {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}