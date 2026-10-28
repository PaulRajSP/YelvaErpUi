import { useState } from 'react';
import { Paperclip, Eye } from 'lucide-react';
import DocumentViewModal from './DocumentViewModal';
import { API_BASE } from '../../services/apiClient';

export default function AttachmentsList({ attachments = [] }) {
    const [selectedDoc, setSelectedDoc] = useState(null);

    if (!attachments || attachments.length === 0) return null;

    const doc = selectedDoc?.attachmentData || selectedDoc;
    const docName = doc?.documentOriginalName || doc?.documentOrginalName || doc?.name || doc?.fileName || 'document';
    const docEdid = doc?.documentEdid || doc?.edid || doc?.docEdid || doc?.id;
    const docUrl = doc?.url || (docEdid ? `${API_BASE}/common/attachment/${docEdid}/${encodeURIComponent(docName)}` : '');

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <Paperclip size={16} className="text-slate-500" /> Attachments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {attachments.map((file, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => setSelectedDoc(file)}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl cursor-pointer transition-colors group"
                    >
                        <div className="flex items-center gap-2 overflow-hidden min-w-0">
                            <Paperclip size={14} className="text-slate-400 group-hover:text-indigo-600 shrink-0 transition-colors" />
                            <span className="text-xs font-medium text-slate-700 truncate">{file.name || file.documentOriginalName || file.attachmentData?.documentOriginalName || 'Attachment ' + (idx + 1)}</span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedDoc(file); }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
                            title="View Document"
                        >
                            <Eye size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {selectedDoc && (
                <DocumentViewModal
                    isOpen={Boolean(selectedDoc)}
                    onClose={() => setSelectedDoc(null)}
                    url={docUrl}
                    title={selectedDoc.name || 'Attachment Preview'}
                    fileName={selectedDoc.name || ''}
                />
            )}
        </div>
    );
}
