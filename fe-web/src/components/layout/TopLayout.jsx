import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import {
    Bell,
    CheckCircle,
    Info,
    AlertTriangle,
    Menu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { UserMenu } from './UserMenu';
import { notificationsApi } from '../../api/notifications';

const MotionButton = motion.button;
const MotionSpan = motion.span;
const MotionDiv = motion.div;

function formatNotificationDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function TopLayout({ onMenuClick }) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    const loadNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        setLoadingNotifications(true);
        try {
            const data = await notificationsApi.list(0, 5);
            setNotifications(data.items || []);
            setUnreadCount(data.unread_count || 0);
        } catch (err) {
            console.error('Failed to load notifications', err);
        } finally {
            setLoadingNotifications(false);
        }
    }, [user]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleNotificationClick = async (notification) => {
        setSelectedNotification(notification);
        setShowNotifications(false);

        if (!notification.is_read) {
            try {
                await notificationsApi.markRead(notification.id);
                setNotifications((items) =>
                    items.map((n) => n.id === notification.id ? { ...n, is_read: true } : n)
                );
                setUnreadCount((count) => Math.max(0, count - 1));
            } catch (err) {
                console.error('Failed to mark notification as read', err);
            }
        }
    };

    const handleNotificationAction = (notification) => {
        if (!notification?.action_url) return;
        setSelectedNotification(null);
        navigate(notification.action_url);
    };

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle size={16} className="text-green-500" />;
            case 'warning': return <AlertTriangle size={16} className="text-yellow-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    return (
        <>
            <div className="h-16 bg-surface border-b border-surface-border flex items-center justify-between lg:justify-end px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shadow-sm">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-text-muted hover:text-text hover:bg-surface-muted rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>

                <div className="flex items-center gap-4 sm:gap-6">
                    <div className="relative">
                        <MotionButton
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="text-text-muted hover:text-text transition-colors relative p-1.5 rounded-lg hover:bg-surface-muted"
                            onClick={() => {
                                const nextOpen = !showNotifications;
                                setShowNotifications(nextOpen);
                                if (nextOpen) loadNotifications();
                            }}
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <MotionSpan
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white"
                                >
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </MotionSpan>
                            )}
                        </MotionButton>

                        <AnimatePresence>
                            {showNotifications && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowNotifications(false)}
                                    />
                                    <MotionDiv
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#E6ECF5] py-2 z-50 overflow-hidden origin-top-right"
                                    >
                                        <div className="px-4 py-2 border-b border-[#E6ECF5] flex justify-between items-center">
                                            <h3 className="font-semibold text-primary text-sm">{t('nav_notifications')}</h3>
                                            <Link to="/notifications" className="text-xs text-accent hover:underline">
                                                {t('nav_see_all')}
                                            </Link>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {notifications.length > 0 ? (
                                                notifications.map(notification => (
                                                    <div
                                                        key={notification.id}
                                                        onClick={() => handleNotificationClick(notification)}
                                                        className={`px-4 py-3 hover:bg-[#E6ECF5] cursor-pointer border-b border-[#E6ECF5] last:border-0 ${!notification.is_read ? 'bg-[#E6ECF5]/30' : ''}`}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="mt-1 flex-shrink-0">
                                                                {getIcon(notification.type)}
                                                            </div>
                                                            <div>
                                                                <h4 className={`text-sm ${!notification.is_read ? 'font-semibold text-primary' : 'font-medium text-[#0A1D3D]/80'}`}>
                                                                    {notification.title}
                                                                </h4>
                                                                <p className="text-xs text-secondary mt-1 line-clamp-2">
                                                                    {notification.message}
                                                                </p>
                                                                <p className="text-[10px] text-[#0A1D3D]/40 mt-2">
                                                                    {formatNotificationDate(notification.created_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-8 text-center text-sm text-text-muted">
                                                    {loadingNotifications ? 'Loading...' : t('no_notifications')}
                                                </div>
                                            )}
                                        </div>
                                    </MotionDiv>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <UserMenu />
                </div>
            </div>

            <Modal
                isOpen={!!selectedNotification}
                onClose={() => setSelectedNotification(null)}
                title={selectedNotification?.title || 'Notification'}
                size="sm"
            >
                {selectedNotification && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 p-2 bg-[#E6ECF5] rounded-lg">
                                {getIcon(selectedNotification.type)}
                            </div>
                            <div>
                                <p className="text-sm text-[#0A1D3D]/80 leading-relaxed">
                                    {selectedNotification.message}
                                </p>
                                <p className="text-xs text-secondary mt-3 font-medium">
                                    Received {formatNotificationDate(selectedNotification.created_at)}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            {selectedNotification.action_url && (
                                <Button
                                    size="sm"
                                    onClick={() => handleNotificationAction(selectedNotification)}
                                >
                                    {selectedNotification.action_label || 'Open'}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedNotification(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
