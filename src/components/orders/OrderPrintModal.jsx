import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { documentApi } from '../../api/documentApi';
import {
    Printer, RefreshCw,
    AlertCircle, Loader2
} from 'lucide-react';

const normalizeDocType = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'delivery' || t === 'deliveryslip' || t === 'packingslip') return 'DeliverySlip';
    if (t === 'summary' || t === 'receipt' || t === 'orderreceipt') return 'OrderReceipt';
    return 'Invoice';
};

export default function OrderPrintModal({
    isOpen,
    onClose,
    order,
    initialType = 'invoice',
    docType: explicitDocType
}) {
    const defaultType = normalizeDocType(explicitDocType || initialType);
    const [selectedType, setSelectedType] = useState(defaultType);
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const iframeRef = useRef(null);
    const identifier = order?.orderNumber || order?.edid || order?.id;

    // Reset selected type when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedType(normalizeDocType(explicitDocType || initialType));
            setError(null);
        }
    }, [isOpen, initialType, explicitDocType]);

    // Fetch rendered HTML from backend template engine
    const loadDocument = useCallback(async (type) => {
        if (!identifier) {
            setError('Missing order identifier');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const url = documentApi.getDocumentHtmlUrl(type, identifier);
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
            }
            const content = await res.text();
            if (content) {
                setHtmlContent(content);
            } else {
                setError('Failed to render document');
            }
        } catch (err) {
            setError(err?.message || 'Error communicating with document engine');
        } finally {
            setLoading(false);
        }
    }, [identifier]);

    useEffect(() => {
        if (isOpen && identifier) {
            loadDocument(selectedType);
        }
    }, [isOpen, selectedType, identifier, loadDocument]);

    if (!isOpen || !order) return null;

    // Direct clean print from isolated iframe
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
            title={`Document Viewer - ${identifier || ''}`}
            className="max-w-5xl h-[90vh] w-full flex flex-col"
            bodyClassName="p-0 flex flex-col flex-1 overflow-hidden"
        >
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
                {/* Actions Toolbar */}
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => loadDocument(selectedType)}
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
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs"
                        title="Print clean document or Save as PDF"
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
                        <Loader2 size={32} className="animate-spin text-amber-500" />
                        <span className="text-xs font-semibold">Generating {selectedType} from template...</span>
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-white rounded-xl border border-red-200 shadow-xs">
                        <AlertCircle size={36} className="text-red-500 mb-3" />
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Failed to Load Document</h4>
                        <p className="text-xs text-slate-500 mb-4">{error}</p>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => loadDocument(selectedType)}
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
                            title={`${selectedType} Preview`}
                            className="w-full h-full min-h-[500px] border-0 bg-white flex-1"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
}
