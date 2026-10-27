import { CheckCircle } from 'lucide-react';

export default function SuccessModal({ isOpen, title, message, onPrimary, primaryText, onSecondary, secondaryText, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-10 rounded-2xl text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 shadow-inner border border-green-100">
                    <CheckCircle size={40} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">{title}</h2>
                <p className="text-slate-500 mb-6 font-medium text-sm">{message}</p>

                {children && (
                    <div className="mb-8">
                        {children}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={onPrimary}
                        className="bg-[#ffc107] text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-[#e0a800] transition-colors w-full cursor-pointer"
                    >
                        {primaryText}
                    </button>
                    {onSecondary && secondaryText && (
                        <button
                            onClick={onSecondary}
                            className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors w-full cursor-pointer"
                        >
                            {secondaryText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
