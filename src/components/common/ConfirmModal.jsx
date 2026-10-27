import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { Button } from '../ui/Button';

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger', // 'danger' | 'warning' | 'info' | 'success'
    isAlert = false,    // if true, shows only one button (replaces window.alert)
    isLoading = false
}) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-rose-100 text-rose-600',
            icon: AlertTriangle,
            confirmButton: 'bg-rose-600 hover:bg-rose-700 text-white'
        },
        warning: {
            iconBg: 'bg-amber-100 text-amber-600',
            icon: AlertTriangle,
            confirmButton: 'bg-amber-600 hover:bg-amber-700 text-white'
        },
        info: {
            iconBg: 'bg-blue-100 text-blue-600',
            icon: Info,
            confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white'
        },
        success: {
            iconBg: 'bg-emerald-100 text-emerald-600',
            icon: CheckCircle2,
            confirmButton: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }
    };

    const currentVariant = variantStyles[variant] || variantStyles.danger;
    const IconComponent = currentVariant.icon;

    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm();
        } else if (onClose) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl shrink-0 ${currentVariant.iconBg}`}>
                            <IconComponent size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">{message}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    {!isAlert && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={currentVariant.confirmButton}
                    >
                        {isLoading ? 'Processing...' : (isAlert ? (confirmText || 'OK') : confirmText)}
                    </Button>
                </div>
            </div>
        </div>
    );
}
