import React, { useState } from 'react';
import { NotificationItem, Member } from '../types';
import { X, Bell, CheckCheck, AlertTriangle, Receipt, Megaphone, ShieldAlert, Check } from 'lucide-react';
import { requestNotificationPermission, showPushNotification } from '../utils/notifications';
import { markNotificationsAsRead } from '../services/api';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  member?: Member | null;
  onRefresh: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  member,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const [hasPermission, setHasPermission] = useState<boolean>(
    'Notification' in window && Notification.permission === 'granted'
  );
  const [requesting, setRequesting] = useState<boolean>(false);

  const handleEnablePush = async () => {
    setRequesting(true);
    const perm = await requestNotificationPermission();
    setRequesting(false);
    if (perm === 'granted') {
      setHasPermission(true);
      showPushNotification(
        'Push Notifications Active',
        'You will now receive instant push alerts for tithes, dues reminders, and church announcements.'
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!member) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    await markNotificationsAsRead(member.id, unreadIds);
    onRefresh();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_receipt':
        return <Receipt className="w-5 h-5 text-emerald-400" />;
      case 'dues_reminder':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'status_alert':
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      default:
        return <Megaphone className="w-5 h-5 text-sky-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Account Alerts</h3>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Push Notification opt-in banner if not enabled */}
        {!hasPermission && (
          <div className="m-4 p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              <span className="font-bold block text-slate-200">Push Notifications</span>
              Get real-time alerts when tithe receipts or dues reminders are issued.
            </div>
            <button
              onClick={handleEnablePush}
              disabled={requesting}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              {requesting ? 'Enabling...' : 'Enable'}
            </button>
          </div>
        )}

        {/* Mark all as read action */}
        {unreadCount > 0 && (
          <div className="px-5 py-2 flex justify-end">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          </div>
        )}

        {/* List of notifications */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              No notifications at this time.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border transition ${
                  n.is_read
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-100 shadow-md ring-1 ring-amber-500/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-xs text-slate-200 truncate">{n.title}</h4>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 mt-2 block font-mono">
                      {n.created_at}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-center text-xs text-slate-500">
          GracePoint Church • Real-time Member Notification System
        </div>
      </div>
    </div>
  );
};
