import { useState, useEffect } from 'react';
import {
    X, ExternalLink, Download, ZoomIn, ZoomOut,
    RotateCw, Maximize2, FileText, Image as ImageIcon,
    Loader2, AlertCircle, Paperclip
} from 'lucide-react';
import { Button } from '../ui/Button';
import { API_BASE } from '../../services/apiClient';
import { formatCurrency, formatDate } from '../../common/utils';

export default function ExpenseReceiptModal({
    isOpen,
    onClose,
    expense
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [blobUrl, setBlobUrl] = useState(null);
    const [fileType, setFileType] = useState('unknown'); // 'pdf' | 'image' | 'other'
    const [resolvedFileName, setResolvedFileName] = useState('');
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const docEdid = expense?.docEdid;
    const docUrl = docEdid ? `${API_BASE}/common/attachment/${encodeURIComponent(docEdid)}` : '';
    const fallbackFileName = expense?.docFileName || `Receipt-${expense?.expenseNumber || 'file'}`;

    useEffect(() => {
        if (!isOpen || !docUrl) {
            setLoading(false);
            setBlobUrl(null);
            setFileType('unknown');
            return;
        }

        let isMounted = true;
        let createdUrl = null;

        setLoading(true);
        setError(false);
        setZoom(1);
        setRotation(0);
        setResolvedFileName(expense?.docFileName || '');

        (async () => {
            try {
                const res = await fetch(docUrl);
                if (!res.ok) {
                    throw new Error(`Failed to fetch attachment (${res.status})`);
                }

                // Extract filename from Content-Disposition if present
                const disposition = res.headers.get('content-disposition');
                let serverFileName = '';
                if (disposition) {
                    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
                    if (utf8Match && utf8Match[1]) {
                        try {
                            serverFileName = decodeURIComponent(utf8Match[1]);
                        } catch {
                            serverFileName = utf8Match[1];
                        }
                    } else {
                        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
                        if (match && match[1]) {
                            serverFileName = match[1].replace(/['"]/g, '').trim();
                        }
                    }
                }

                const contentType = (res.headers.get('content-type') || '').toLowerCase();
                const rawBlob = await res.blob();
                if (!isMounted) return;

                // Determine file type
                let detected = 'unknown';
                let finalMime = rawBlob.type || contentType;
                const nameToCheck = (serverFileName || expense?.docFileName || '').toLowerCase();

                if (contentType.includes('application/pdf') || /\.pdf$/i.test(nameToCheck)) {
                    detected = 'pdf';
                    finalMime = 'application/pdf';
                } else if (
                    contentType.startsWith('image/') ||
                    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(nameToCheck)
                ) {
                    detected = 'image';
                } else {
                    // Sniff magic bytes if ambiguous
                    try {
                        const slice = rawBlob.slice(0, 8);
                        const buf = await slice.arrayBuffer();
                        const bytes = new Uint8Array(buf);
                        // %PDF = 0x25, 0x50, 0x44, 0x46
                        if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                            detected = 'pdf';
                            finalMime = 'application/pdf';
                        } else if (
                            (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) || // JPEG
                            (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) || // PNG
                            (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) || // GIF
                            (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) // WEBP / RIFF
                        ) {
                            detected = 'image';
                        }
                    } catch (e) {
                        console.warn('Could not inspect magic bytes:', e);
                    }
                }

                // If still not definitively identified, default to PDF for receipt docs unless image format was detected
                if (detected === 'unknown') {
                    if (contentType.includes('image')) {
                        detected = 'image';
                    } else {
                        detected = 'pdf';
                        finalMime = 'application/pdf';
                    }
                }

                const preparedBlob = finalMime && finalMime !== rawBlob.type
                    ? new Blob([rawBlob], { type: finalMime })
                    : rawBlob;

                createdUrl = URL.createObjectURL(preparedBlob);
                setBlobUrl(createdUrl);
                setFileType(detected);

                let finalFileName = serverFileName || expense?.docFileName;
                if (!finalFileName) {
                    finalFileName = `Receipt-${expense?.expenseNumber || 'file'}${detected === 'pdf' ? '.pdf' : ''}`;
                }
                setResolvedFileName(finalFileName);
                setLoading(false);
            } catch (err) {
                console.error('Failed to preview expense receipt:', err);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        })();

        return () => {
            isMounted = false;
            if (createdUrl) {
                URL.revokeObjectURL(createdUrl);
            }
        };
    }, [isOpen, docUrl, expense?.docFileName, expense?.expenseNumber]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !expense) return null;

    const displayFileName = resolvedFileName || fallbackFileName;
    const isImage = fileType === 'image';
    const isPdf = fileType === 'pdf';

    // Download handler
    const handleDownload = () => {
        if (!blobUrl && !docUrl) return;
        const targetUrl = blobUrl || docUrl;
        const a = document.createElement('a');
        a.href = targetUrl;
        a.download = displayFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            isPdf
                                ? 'bg-rose-50 border-rose-100 text-rose-600'
                                : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                        }`}>
                            {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-base truncate">
                                    Expense Bill Receipt
                                </h3>
                                {isPdf && (
                                    <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                        PDF
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono truncate">
                                {expense.expenseNumber || 'EXP-RECORD'}
                                {displayFileName && ` • ${displayFileName}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {docUrl && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                                    title="Download Bill"
                                >
                                    <Download size={13} className="text-slate-500" />
                                    <span className="hidden sm:inline">Download</span>
                                </button>

                                <a
                                    href={blobUrl || docUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                                    title="Open in new window"
                                >
                                    <ExternalLink size={13} className="text-slate-500" />
                                    <span className="hidden sm:inline">New Tab</span>
                                </a>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Expense Details Summary Strip */}
                <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Title</span>
                        <span className="font-semibold text-slate-900 truncate block mt-0.5">{expense.title || '-'}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Category</span>
                        <span className="font-semibold text-slate-700 truncate block mt-0.5">{expense.category || '-'}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Amount</span>
                        <span className="font-bold text-slate-900 text-sm block mt-0.5">{formatCurrency(expense.amount)}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Date & Status</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-slate-600">{formatDate(expense.expenseDate)}</span>
                            <span className={`font-bold uppercase text-[11px] ${
                                expense.status?.toLowerCase() === 'paid'
                                    ? 'text-emerald-600'
                                    : expense.status?.toLowerCase() === 'pending'
                                        ? 'text-amber-600'
                                        : 'text-rose-600'
                            }`}>
                                {expense.status || 'PENDING'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Preview Controls Bar */}
                {docUrl && !error && !loading && (
                    <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-slate-100 text-xs shrink-0">
                        <span className="text-slate-500 font-mono text-[11px] truncate max-w-[320px]">
                            {displayFileName}
                        </span>

                        {isImage && (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={14} />
                                </button>
                                <span className="text-[11px] font-mono font-bold text-slate-700 px-1.5 select-none">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title="Rotate 90°"
                                >
                                    <RotateCw size={14} />
                                </button>
                                {(zoom !== 1 || rotation !== 0) && (
                                    <button
                                        type="button"
                                        onClick={() => { setZoom(1); setRotation(0); }}
                                        className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                        title="Reset View"
                                    >
                                        <Maximize2 size={13} />
                                    </button>
                                )}
                            </div>
                        )}

                        {isPdf && (
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                    Interactive PDF Viewer
                                </span>
                                <a
                                    href={blobUrl || docUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                    <ExternalLink size={12} /> Open Fullscreen
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* Body / Document View Area */}
                <div className="relative flex-1 min-h-[380px] max-h-[65vh] bg-slate-100/70 p-4 flex items-center justify-center overflow-auto">
                    {!docUrl ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-sm mx-auto">
                            <Paperclip size={36} className="text-slate-300 mb-2 stroke-1" />
                            <h4 className="font-bold text-slate-800 text-sm mb-1">No Receipt Attached</h4>
                            <p className="text-xs text-slate-400">
                                No bill receipt or attachment was uploaded for this expense record.
                            </p>
                        </div>
                    ) : (
                        <>
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/80 z-10 backdrop-blur-xs">
                                    <Loader2 size={28} className="animate-spin text-indigo-600" />
                                    <p className="text-xs font-medium text-slate-500">Loading bill receipt…</p>
                                </div>
                            )}

                            {error ? (
                                <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-sm mx-auto">
                                    <AlertCircle size={36} className="text-rose-500 mb-2 stroke-1" />
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Preview Unavailable</h4>
                                    <p className="text-xs text-slate-500 mb-4">
                                        This document could not be previewed directly. You can open it in a new browser tab or download it.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={docUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
                                        >
                                            <ExternalLink size={13} /> Open in New Tab
                                        </a>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleDownload}
                                            icon={Download}
                                        >
                                            Download
                                        </Button>
                                    </div>
                                </div>
                            ) : isPdf ? (
                                <div className="w-full h-full min-h-[460px] flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                                    <object
                                        data={`${blobUrl || docUrl}#toolbar=1&navpanes=0`}
                                        type="application/pdf"
                                        className="w-full h-[60vh] rounded-xl"
                                    >
                                        <iframe
                                            src={`${blobUrl || docUrl}#toolbar=1&navpanes=0`}
                                            title={expense.title || 'Bill Receipt'}
                                            className="w-full h-[60vh] border-0"
                                        >
                                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                                <p className="text-xs text-slate-600 mb-3">
                                                    Your browser does not support inline PDF viewing.
                                                </p>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={handleDownload}
                                                    icon={Download}
                                                >
                                                    Download Receipt PDF
                                                </Button>
                                            </div>
                                        </iframe>
                                    </object>
                                </div>
                            ) : isImage ? (
                                <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                                    <img
                                        src={blobUrl || docUrl}
                                        alt={expense.title || 'Bill Receipt'}
                                        onLoad={() => setLoading(false)}
                                        onError={() => { setLoading(false); setError(true); }}
                                        style={{
                                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                            transformOrigin: 'center center',
                                            transition: 'transform 0.15s ease-out'
                                        }}
                                        className="max-h-[60vh] max-w-full object-contain mx-auto rounded-lg shadow-sm border border-slate-200/60 bg-white"
                                    />
                                </div>
                            ) : (
                                <iframe
                                    src={blobUrl || docUrl}
                                    title={expense.title || 'Bill Receipt'}
                                    onLoad={() => setLoading(false)}
                                    onError={() => { setLoading(false); setError(true); }}
                                    className="w-full h-[60vh] rounded-xl border border-slate-200 bg-white shadow-xs"
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-white shrink-0">
                    <p className="text-[11px] text-slate-400 font-medium">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Esc</kbd> or click outside to close
                    </p>
                    <div className="flex items-center gap-2">
                        {docUrl && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleDownload}
                                icon={Download}
                            >
                                Download Bill
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
