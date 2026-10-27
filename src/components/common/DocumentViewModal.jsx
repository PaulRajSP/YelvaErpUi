import { useState, useEffect } from 'react';
import {
    X, ExternalLink, Download, FileText, Image as ImageIcon, Loader2, AlertCircle,
    ZoomIn, ZoomOut, RotateCw, Maximize2
} from 'lucide-react';
import { Button } from '../ui/Button';

export default function DocumentViewModal({
    isOpen,
    onClose,
    url,
    title = 'Document Preview',
    fileName = ''
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [blobUrl, setBlobUrl] = useState(null);
    const [fileType, setFileType] = useState('unknown'); // 'pdf' | 'image' | 'other'
    const [resolvedFileName, setResolvedFileName] = useState('');
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        if (!isOpen || !url) {
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
        setResolvedFileName(fileName || '');

        (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`Failed to load document (${res.status})`);
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

                let detected = 'unknown';
                let finalMime = rawBlob.type || contentType;
                const nameToCheck = (serverFileName || fileName || url || '').toLowerCase().split('?')[0];

                if (contentType.includes('application/pdf') || /\.pdf$/i.test(nameToCheck)) {
                    detected = 'pdf';
                    finalMime = 'application/pdf';
                } else if (
                    contentType.startsWith('image/') ||
                    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(nameToCheck)
                ) {
                    detected = 'image';
                } else {
                    // Sniff magic bytes
                    try {
                        const slice = rawBlob.slice(0, 8);
                        const buf = await slice.arrayBuffer();
                        const bytes = new Uint8Array(buf);
                        // %PDF = 0x25, 0x50, 0x44, 0x46
                        if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                            detected = 'pdf';
                            finalMime = 'application/pdf';
                        } else if (
                            (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) ||
                            (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) ||
                            (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) ||
                            (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)
                        ) {
                            detected = 'image';
                        }
                    } catch (e) {
                        console.warn('Could not inspect magic bytes:', e);
                    }
                }

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

                const finalName = serverFileName || fileName || (detected === 'pdf' ? 'document.pdf' : 'attachment');
                setResolvedFileName(finalName);
                setLoading(false);
            } catch (err) {
                console.error('Failed to preview document:', err);
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
    }, [isOpen, url, fileName]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !url) return null;

    const displayFileName = resolvedFileName || fileName;
    const isImage = fileType === 'image';
    const isPdf = fileType === 'pdf';

    const handleDownload = () => {
        if (!blobUrl && !url) return;
        const target = blobUrl || url;
        const a = document.createElement('a');
        a.href = target;
        a.download = displayFileName || 'download';
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
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                            isPdf
                                ? 'bg-rose-50 border-rose-100 text-rose-600'
                                : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                        }`}>
                            {isPdf ? <FileText size={16} /> : <ImageIcon size={16} />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-sm truncate">
                                    {title}
                                </h3>
                                {isPdf && (
                                    <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                        PDF
                                    </span>
                                )}
                            </div>
                            {displayFileName && (
                                <p className="text-[11px] text-slate-400 font-mono truncate max-w-[320px]">
                                    {displayFileName}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isImage && !error && !loading && (
                            <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 mr-1">
                                <button
                                    type="button"
                                    onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={14} />
                                </button>
                                <span className="text-[10px] font-mono font-bold text-slate-600 px-1.5 select-none">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                    title="Rotate 90°"
                                >
                                    <RotateCw size={14} />
                                </button>
                                {(zoom !== 1 || rotation !== 0) && (
                                    <button
                                        type="button"
                                        onClick={() => { setZoom(1); setRotation(0); }}
                                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                        title="Reset"
                                    >
                                        <Maximize2 size={13} />
                                    </button>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                            title="Download document"
                        >
                            <Download size={13} className="text-slate-500" />
                            <span className="hidden sm:inline">Download</span>
                        </button>

                        <a
                            href={blobUrl || url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                            title="Open in new window"
                        >
                            <ExternalLink size={13} className="text-slate-500" />
                            <span className="hidden sm:inline">New Tab</span>
                        </a>

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

                {/* Body / Document View Area */}
                <div className="relative flex-1 min-h-[360px] max-h-[75vh] bg-slate-100/60 p-4 flex items-center justify-center overflow-auto">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/80 z-10 backdrop-blur-xs">
                            <Loader2 size={28} className="animate-spin text-indigo-600" />
                            <p className="text-xs font-medium text-slate-500">Loading document preview…</p>
                        </div>
                    )}

                    {error ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-sm mx-auto">
                            <AlertCircle size={36} className="text-rose-500 mb-2 stroke-1" />
                            <h4 className="font-bold text-slate-800 text-sm mb-1">Preview Unavailable</h4>
                            <p className="text-xs text-slate-500 mb-4">
                                This document could not be previewed directly in the modal. You can open it in a new browser tab or download it.
                            </p>
                            <div className="flex items-center gap-2">
                                <a
                                    href={url}
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
                                data={`${blobUrl || url}#toolbar=1&navpanes=0`}
                                type="application/pdf"
                                className="w-full h-[70vh] rounded-xl"
                            >
                                <iframe
                                    src={`${blobUrl || url}#toolbar=1&navpanes=0`}
                                    title={title}
                                    className="w-full h-[70vh] border-0"
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
                                            Download Document
                                        </Button>
                                    </div>
                                </iframe>
                            </object>
                        </div>
                    ) : isImage ? (
                        <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                            <img
                                src={blobUrl || url}
                                alt={title}
                                onLoad={() => setLoading(false)}
                                onError={() => { setLoading(false); setError(true); }}
                                style={{
                                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                    transformOrigin: 'center center',
                                    transition: 'transform 0.15s ease-out'
                                }}
                                className="max-h-[70vh] max-w-full object-contain mx-auto rounded-lg shadow-sm border border-slate-200/60 bg-white"
                            />
                        </div>
                    ) : (
                        <iframe
                            src={blobUrl || url}
                            title={title}
                            onLoad={() => setLoading(false)}
                            onError={() => { setLoading(false); setError(true); }}
                            className="w-full h-[72vh] rounded-xl border border-slate-200 bg-white shadow-xs"
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white shrink-0">
                    <p className="text-[11px] text-slate-400 font-medium">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Esc</kbd> or click outside to close
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDownload}
                            icon={Download}
                        >
                            Download
                        </Button>
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
