import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Bell, CheckCircle, Info, AlertTriangle, Check } from 'lucide-react';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

export function Notifications() {
    const { user } = useAuth();
    const { lang } = useTranslation();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(Boolean(user));
    const copy = lang === 'id'
        ? {
            title: 'Notifikasi',
            subtitle: 'Tetap update dengan aktivitas terbaru Anda.',
            markAll: 'Tandai semua dibaca',
            empty: 'Belum ada notifikasi.',
          }
        : {
            title: 'Notifications',
            subtitle: 'Stay up to date with your latest activity.',
            markAll: 'Mark all as read',
            empty: 'No notifications yet.',
          };

    useEffect(() => {
        if (!user) {
            return;
        }
        notificationsApi
            .list()
            .then((data) => {
                setNotifications(data.items || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user]);

    const handleMarkAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('Failed to mark all read', err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await notificationsApi.markRead(id);
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            ));
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const openNotificationAction = async (notification) => {
        if (!notification.action_url) return;
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }
        navigate(notification.action_url);
    };

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle size={20} className="text-green-500" />;
            case 'warning': return <AlertTriangle size={20} className="text-yellow-500" />;
            default: return <Info size={20} className="text-blue-500" />;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 min-h-screen pb-20">
            <div className="flex justify-between items-center border-b border-[#E6ECF5] pb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-primary tracking-tight flex items-center gap-2">
                        <Bell className="text-accent fill-current" size={24} /> {copy.title}
                    </h1>
                    <p className="text-secondary mt-1">
                        {copy.subtitle}
                    </p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-2"
                    >
                        <Check size={16} /> {copy.markAll}
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {notifications.length > 0 ? (
                    notifications.map((notification) => (
                        <Card
                            key={notification.id}
                            className={`border-l-4 transition-all hover:shadow-sm cursor-pointer ${!notification.is_read ? 'border-l-accent bg-white' : 'border-l-[#E6ECF5] bg-[#E6ECF5]/50'
                                }`}
                            onClick={() => !notification.is_read && markAsRead(notification.id)}
                        >
                            <CardBody className="p-4 flex gap-4">
                                <div className="mt-1 flex-shrink-0">
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start gap-4">
                                        <h3 className={`font-semibold ${!notification.is_read ? 'text-primary' : 'text-[#0A1D3D]/60'}`}>
                                            {notification.title}
                                        </h3>
                                        <span className="text-xs text-secondary whitespace-nowrap">
                                            {new Date(notification.created_at).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-secondary mt-1">
                                        {notification.message}
                                    </p>
                                    {notification.action_url && (
                                        <div className="mt-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openNotificationAction(notification);
                                                }}
                                            >
                                                {notification.action_label || 'Open'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {!notification.is_read && (
                                    <div className="flex items-center">
                                        <span className="w-2 h-2 rounded-full bg-accent"></span>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-12 bg-[#E6ECF5] rounded-xl border border-dashed border-[#E6ECF5]">
                        <Bell size={32} className="mx-auto text-[#0A1D3D]/30 mb-3" />
                        <p className="text-secondary">{copy.empty}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
