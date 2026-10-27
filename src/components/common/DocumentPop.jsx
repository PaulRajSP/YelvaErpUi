import { useRef, useEffect } from 'react';
import { Printer, X, Loader2 } from 'lucide-react';

export default function DocumentPop({
    isOpen,
    onClose,
    title = 'Document Preview',
    htmlContent = '',
    isLandscape = false,
    loading = false
}) {
    const iframeRef = useRef(null);

    // Disable body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Triggers the browser's native Print / "Save as PDF" dialog
    const handleNativePrintOrSave = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            try {
                iframeRef.current.contentWindow.focus();
                iframeRef.current.contentWindow.print();
            } catch (err) {
                console.error('Print failed:', err);
                window.print();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-x-hidden overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Popup Container */}
            <div className="relative bg-[#323639] rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] overflow-hidden flex flex-col transition-all transform duration-300 scale-100 z-10 border border-[#1e2022]">
                {/* Header Toolbar with Native Dialog Triggers */}
                <div className="flex items-center justify-between px-6 py-3 bg-[#2a2e31] border-b border-[#1e2022] shadow-sm shrink-0">
                    <span className="text-sm font-medium text-gray-200 truncate max-w-md">
                        {title}
                    </span>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleNativePrintOrSave}
                            disabled={loading || !htmlContent}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="w-4 h-4 text-white" /> Print / Save
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Document Canvas Container */}
                <div className="flex-1 p-6 overflow-y-auto flex justify-center items-start bg-[#525659] relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-200">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                            <span className="text-xs font-medium">Generating document...</span>
                        </div>
                    ) : (
                        <div className={`${isLandscape ? 'w-[297mm] min-h-[210mm]' : 'w-[210mm] min-h-[297mm]'} bg-white shadow-2xl rounded-sm flex flex-col border border-gray-300`}>
                            <iframe
                                ref={iframeRef}
                                srcDoc={htmlContent}
                                title={title}
                                className={`w-full flex-1 ${isLandscape ? 'min-h-[210mm]' : 'min-h-[297mm]'} border-none`}
                                style={{ backgroundColor: 'white' }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
