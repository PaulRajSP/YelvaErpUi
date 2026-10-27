import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { documentApi } from '../../api/documentApi';
import { Printer, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

export default function ConfirmedSlipsModal({ isOpen, onClose }) {
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const iframeRef = useRef(null);

    const loadDocument = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const content = await documentApi.getConfirmedHtml(Date.now());
            if (content) {
                setHtmlContent(content);
            } else {
                setError('Failed to generate confirmed delivery slips');
            }
        } catch (err) {
            console.error('Failed to load confirmed delivery slips:', err);
            setError(err?.message || 'Error communicating with document engine');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadDocument();
        } else {
            setHtmlContent('');
            setError(null);
        }
    }, [isOpen, loadDocument]);

    if (!isOpen) return null;

    const handlePrint = () => {
        if (!htmlContent) return;

        if (iframeRef.current && iframeRef.current.contentWindow) {
            try {
                iframeRef.current.contentWindow.focus();
                iframeRef.current.contentWindow.print();
                return;
            } catch (err) {
                console.error('Print failed via iframe:', err);
            }
        }

        // Clean fallback without printing parent app window
        try {
            const printFrame = document.createElement('iframe');
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);
            printFrame.contentDocument.write(htmlContent);
            printFrame.contentDocument.close();
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            setTimeout(() => {
                try {
                    document.body.removeChild(printFrame);
                } catch {
                    // Ignore cleanup error
                }
            }, 1000);
        } catch (fallbackErr) {
            console.error('Fallback print failed:', fallbackErr);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirmed Orders - Delivery Slips"
            className="max-w-5xl h-[92vh] w-full flex flex-col"
            bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
        >
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
                <span className="text-xs font-semibold text-slate-500">
                    Delivery slips for all orders in <strong>Confirmed</strong> status
                </span>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={loadDocument}
                        disabled={loading}
                        className="text-xs flex items-center gap-1.5"
                        title="Reload template"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </Button>

                    <Button
                        type="button"
                        onClick={handlePrint}
                        disabled={loading || !htmlContent}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Print clean documents or Save as PDF"
                    >
                        <Printer size={14} />
                        Print / Save PDF
                    </Button>
                </div>
            </div>

            {/* Document Body Area */}
            <div className="flex-1 w-full bg-slate-100/70 p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-slate-600">
                        <Loader2 size={32} className="animate-spin text-indigo-600" />
                        <span className="text-xs font-semibold">Generating delivery slips for confirmed orders...</span>
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-white rounded-xl border border-red-200 shadow-xs">
                        <AlertCircle size={36} className="text-red-500 mb-3" />
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Failed to Load Delivery Slips</h4>
                        <p className="text-xs text-slate-500 mb-4">{error}</p>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={loadDocument}
                            className="text-xs"
                        >
                            Try Again
                        </Button>
                    </div>
                ) : (
                    <div className="w-full h-full min-h-[500px] bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
                        <iframe
                            ref={iframeRef}
                            srcDoc={htmlContent}
                            title="Confirmed Orders Delivery Slips Preview"
                            className="w-full h-full min-h-[500px] border-0 bg-white flex-1"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
}
