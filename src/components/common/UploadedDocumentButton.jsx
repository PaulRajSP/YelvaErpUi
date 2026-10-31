import { useState } from 'react';
import { FileText } from 'lucide-react';
import { API_BASE } from '../../services/apiClient';
import DocumentViewModal from './DocumentViewModal';

export default function UploadedDocumentButton({
    attachment,
    url,
    title,
    fileName,
    className = 'p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg'
}) {
    const [isOpen, setIsOpen] = useState(false);
    const document = attachment?.attachmentData || attachment || {};
    const resolvedFileName = fileName ||
        document.attachmentOriginalName ||
        document.documentOriginalName ||
        document.fileName ||
        document.name ||
        'Uploaded document';
    const attachmentId = document.attachmentEdid || document.documentEdid || document.edid || document.id;
    const documentUrl = url ||
        document.url ||
        document.previewUrl ||
        (attachmentId
            ? `${API_BASE}/common/attachment/${encodeURIComponent(attachmentId)}/${encodeURIComponent(resolvedFileName)}`
            : '');

    if (!documentUrl) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={className}
                title={`View ${resolvedFileName}`}
                aria-label={`View ${resolvedFileName}`}
            >
                <FileText size={15} />
            </button>
            <DocumentViewModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                url={documentUrl}
                title={title || resolvedFileName}
                fileName={resolvedFileName}
            />
        </>
    );
}
