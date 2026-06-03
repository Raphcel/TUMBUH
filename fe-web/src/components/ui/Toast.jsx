import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
};

const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-[#E6ECF5] border-blue-200',
};

export function Toast({ id, type = 'info', title, message, onClose, duration = 5000 }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`flex items-start gap-4 p-4 rounded-xl border shadow-lg backdrop-blur-sm relative overflow-hidden min-w-[300px] max-w-sm ${bgColors[type] || bgColors.info} bg-white/90`}
        >
            <div className="flex-shrink-0 mt-0.5">{icons[type] || icons.info}</div>
            <div className="flex-1 pr-6">
                {title && <h4 className="text-sm font-bold text-[#0A1D3D] mb-1">{title}</h4>}
                <p className="text-sm text-[#0A1D3D]/60 leading-relaxed">{message}</p>
            </div>
            <button
                onClick={() => onClose(id)}
                className="absolute top-2 right-2 p-1 rounded-full text-[#0A1D3D]/40 hover:text-[#0A1D3D]/60 hover:bg-black/5 transition-colors absolute"
            >
                <X size={14} />
            </button>

            {/* Progress bar could go here */}
            <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-1 ${type === 'success' ? 'bg-green-500' :
                        type === 'error' ? 'bg-red-500' :
                            type === 'warning' ? 'bg-yellow-500' :
                                'bg-[#E6ECF5]0'
                    } opacity-30`}
            />
        </motion.div>
    );
}

export function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <Toast {...toast} onClose={removeToast} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}
