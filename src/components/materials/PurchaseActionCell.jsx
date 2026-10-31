import React from 'react';
import { FileText, Eye } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { API_BASE } from '../../services/apiClient';

export default function PurchaseActionCell({ purchase, setViewDoc, navigate }) {
    const hasAttachments = purchase.attachmentData?.length > 0;

    return (
        <div className="flex justify-center gap-1">
            {hasAttachments ? (
                purchase.attachmentData.map((attachment, attachmentIndex) => {
                    const fileName = attachment.attachmentOriginalName || `Purchase_Invoice_${purchase.invoiceNumber || 'doc'}_${attachmentIndex + 1}`;
                    return (
                        <Tooltip key={attachment.attachmentEdid} content={fileName}>
                            <Button
                                variant="ghost"
                                size="icon"
                                icon={FileText}
                                onClick={() => setViewDoc({
                                    url: `${API_BASE}/common/attachment/${attachment.attachmentEdid}/${encodeURIComponent(fileName)}`,
                                    title: `Purchase Document · Invoice #${purchase.invoiceNumber || ''}`,
                                    fileName
                                })}
                            />
                        </Tooltip>
                    );
                })
            ) : (
                <Tooltip content="View Purchase Details">
                    <Button
                        variant="ghost"
                        size="icon"
                        icon={Eye}
                        onClick={() => navigate(`/purchases/${purchase.purchaseEdid || purchase.invoiceNumber}`)}
                    />
                </Tooltip>
            )}
        </div>
    );
}