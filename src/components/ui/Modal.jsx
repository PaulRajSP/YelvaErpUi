import { forwardRef, useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = forwardRef(({ isOpen, onClose, title, children, className = '', bodyClassName = '', ...props }, ref) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const hasMaxWidth = /\bmax-w-/.test(className);
    const defaultMaxWidth = hasMaxWidth ? '' : 'max-w-xl';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div
                ref={ref}
                className={`relative w-full ${defaultMaxWidth} bg-white rounded-2xl flex flex-col max-h-[90vh] shadow-2xl border border-slate-100 overflow-hidden z-10 ${className}`}
                {...props}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <h2 className="text-lg font-black text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <div className={`p-6 flex-1 ${bodyClassName || 'overflow-y-auto'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
});
Modal.displayName = 'Modal';
