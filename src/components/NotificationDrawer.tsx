import React, { useState } from 'react';
import { NotificationItem, Member } from '../types';
import { X, Bell, CheckCheck, AlertTriangle, Receipt, Megaphone, ShieldAlert } from 'lucide-react';
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
        'You will now receive instant push alerts for dues reminders, kingdom investment updates, and church announcements.'
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
        return <Receipt className="w-5 h-5 text-emerald-700" />;
      case 'dues_reminder':
        return <AlertTriangle className="w-5 h-5 text-amber-700" />;
      case 'status_alert':
        return <ShieldAlert className="w-5 h-5 text-rose-700" />;
      default:
        return <Megaphone className="w-5 h-5 text-slate-700" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border-l border-slate-200 shadow-2xl h-full flex flex-col text-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-amber-400 border border-slate-700">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Church Alerts</h3>
              <p className="text-xs text-slate-300">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Push Notification opt-in banner if not enabled */}
        {!hasPermission && (
          <div className="m-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="text-xs text-slate-700">
              <span className="font-bold block text-slate-900">Push Notifications</span>
              Get real-time alerts when dues status or church reminders are issued.
            </div>
            <button
              onClick={handleEnablePush}
              disabled={requesting}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
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
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No alerts in your inbox.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl transition space-y-1.5 ${
                  !item.is_read ? 'bg-amber-50/50 border border-amber-200/60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getNotificationIcon(item.type)}
                    <span className="font-bold text-xs text-slate-900">{item.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.created_at ? item.created_at.split('T')[0] : 'Today'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-7">
                  {item.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
