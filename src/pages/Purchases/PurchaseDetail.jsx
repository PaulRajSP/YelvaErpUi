import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Calendar, Building2, Package, CheckCircle, XCircle, Clock, Paperclip, ExternalLink, AlertTriangle, Loader2, CreditCard, AlertCircle, ChevronRight } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import PageHeader from '../../components/common/PageHeader';
import AttachmentsList from '../../components/common/AttachmentsList';
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "../../components/ui/Table";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { PAGE_SIZE, formatDate } from "../../common/utils";

import { purchaseApi } from "../../api/purchaseApi";

const STATUS_CONFIG = {
    PAID: { color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: CheckCircle, label: "Fully Paid" },
    UNPAID: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: XCircle, label: "Unpaid" },
    PARTIAL: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: Clock, label: "Partial Payment" },
};

export default function PurchaseDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { rawMaterials, loadRawMaterials } = useStore();

    const [purchase, setPurchase] = useState(null);
    const [loading, setLoading] = useState(true);

    const [showPayForm, setShowPayForm] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [isPaying, setIsPaying] = useState(false);

    const [itemsPage, setItemsPage] = useState(1);
    const [itemsTotalCount, setItemsTotalCount] = useState(0);

    const fetchPurchaseDetails = () => {
        setLoading(true);
        Promise.all([
            purchaseApi.getPurchaseById(id),
            purchaseApi.getPurchaseItems(id, 1)
        ]).then(([detailsRes, itemsRes]) => {
            if (detailsRes.data || detailsRes.edid) {
                const data = detailsRes.data || detailsRes;
                setPurchase({
                    ...data,
                    items: itemsRes.data?.items || itemsRes.items || []
                });
                setItemsTotalCount(itemsRes.data?.totalCount || itemsRes.totalCount || 0);
                setItemsPage(1);
            }
        }).catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    const fetchPurchaseItems = async (page) => {
        try {
            const itemsRes = await purchaseApi.getPurchaseItems(id, page);
            setPurchase(prev => ({
                ...prev,
                items: itemsRes.data?.items || itemsRes.items || []
            }));
            setItemsTotalCount(itemsRes.data?.totalCount || itemsRes.totalCount || 0);
            setItemsPage(page);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadRawMaterials();
        fetchPurchaseDetails();
    }, [id, loadRawMaterials]);

    const handlePayDue = async () => {
        const amount = parseFloat(payAmount);
        const maxDue = (purchase?.totalAmount || 0) - (purchase?.paidAmount || 0);
        if (!amount || amount <= 0 || amount > maxDue) {
            alert("Please enter a valid amount. Cannot exceed balance due.");
            return;
        }
        try {
            setIsPaying(true);
            const res = await purchaseApi.payPurchaseDue({ purchaseEdid: id, amount });
            if (res && res.success !== false) {
                setShowPayForm(false);
                setPayAmount("");
                fetchPurchaseDetails();
            } else {
                alert(res?.message || "Payment failed");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsPaying(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 size={40} className="animate-spin opacity-30" />
                <p className="text-sm font-medium">Loading details...</p>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                <Package size={40} className="opacity-30" />
                <p className="text-sm font-medium">Purchase not found.</p>
                <Button variant="secondary" onClick={() => navigate("/purchases")}>Back to Purchases</Button>
            </div>
        );
    }

    const statusCfg = STATUS_CONFIG[purchase.status] || STATUS_CONFIG.UNPAID;
    const StatusIcon = statusCfg.icon;

    const formattedDate = formatDate(purchase.date);

    const total = purchase.totalAmount || 0;
    const amountPaid = purchase.paidAmount || 0;
    const amountDue = total - amountPaid;

    return (
        <div className="space-y-5 flex flex-col h-[calc(100vh-6rem)] overflow-y-auto pb-10">
            <PageHeader
                title={"Purchase #" + (purchase.publicId)}
                subtitle={formattedDate}
                rightContent={
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => navigate("/purchases")} icon={ArrowLeft}>Back</Button>
                        <Button onClick={() => navigate("/purchases/" + id + "/edit")} icon={Edit2}>Edit Purchase</Button>
                    </div>
                }
            />

            <div className="space-y-6">

                {/* Due Alert for PARTIAL / UNPAID */}
                {(purchase.status === "PARTIAL" || purchase.status === "UNPAID") && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-800">
                                {purchase.status === "UNPAID" ? "Payment Pending" : "Partial Payment — Balance Due"}
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                {purchase.status === "UNPAID"
                                    ? `Full amount of ₹${total.toLocaleString()} is outstanding.`
                                    : `₹${amountPaid.toLocaleString()} paid · ₹${amountDue.toLocaleString()} still due.`
                                }
                            </p>
                        </div>
                        <div className="flex flex-col items-end w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
                            <Button
                                variant="danger"
                                className="px-5 py-2.5 font-bold text-sm shadow-sm transition-colors rounded-xl"
                                onClick={() => setShowPayForm(true)}
                            >
                                Pay Due ₹{amountDue.toLocaleString()}
                            </Button>

                            <Modal isOpen={showPayForm} onClose={() => { setShowPayForm(false); setPayAmount(""); }} title="Make Payment" className="max-w-md">
                                <div className="flex flex-col gap-6">
                                    {/* Header Section */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                                            <CreditCard size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">Pay Due</h3>
                                            <p className="text-sm text-slate-500 font-medium">Complete the pending amount</p>
                                        </div>
                                    </div>

                                    {/* Amount Banner */}
                                    <div className="bg-red-50/70 rounded-2xl p-5 relative overflow-hidden border border-red-100">
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <span className="text-slate-800 font-bold text-sm">Due Amount</span>
                                            <span className="bg-red-100/80 text-red-600 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
                                                <AlertCircle size={12} strokeWidth={3} /> Pending Payment
                                            </span>
                                        </div>
                                        <div className="text-3xl font-black text-red-600 relative z-10 tracking-tight mt-1">
                                            <span className="text-2xl text-red-500 mr-1">₹</span>{amountDue.toLocaleString()}
                                        </div>
                                        {/* Decorative circle */}
                                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-red-100/50 rounded-full blur-xl"></div>
                                    </div>

                                    {/* Input Section */}
                                    <div>
                                        <label className="block text-slate-700 font-bold text-sm mb-2 ml-1">Payment Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₹</span>
                                            <Input
                                                type="number" min="0" max={amountDue} step="0.01"
                                                value={payAmount}
                                                onChange={e => {
                                                    let val = e.target.value;
                                                    if (val === '') {
                                                        setPayAmount('');
                                                        return;
                                                    }
                                                    const num = parseFloat(val);
                                                    if (num < 0) {
                                                        setPayAmount("0");
                                                    } else if (num > amountDue) {
                                                        setPayAmount(amountDue.toString());
                                                    } else {
                                                        setPayAmount(val);
                                                    }
                                                }}
                                                className="w-full pl-8 h-11 text-base font-bold text-slate-900 rounded-xl"
                                                placeholder="0.00"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {/* Status Info Box */}
                                    {parseFloat(payAmount) === amountDue && amountDue > 0 ? (
                                        <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-emerald-100/50">
                                            <div className="bg-emerald-500 text-white rounded-full p-1 shrink-0">
                                                <CheckCircle size={14} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-emerald-800 text-sm">You are paying the full due amount</p>
                                            </div>
                                        </div>
                                    ) : parseFloat(payAmount) > 0 ? (
                                        <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-100/50">
                                            <div className="bg-amber-500 text-white rounded-full p-1 shrink-0">
                                                <AlertTriangle size={14} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-amber-800 text-sm">Partial Payment</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100/50">
                                            <div className="bg-slate-300 text-white rounded-full p-1 shrink-0">
                                                <CreditCard size={14} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-500 text-sm">Enter payment amount</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex flex-col gap-3 pt-2">
                                        <Button
                                            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                                            onClick={handlePayDue}
                                            disabled={isPaying || !parseFloat(payAmount) || parseFloat(payAmount) <= 0 || parseFloat(payAmount) > amountDue}
                                        >
                                            <CreditCard size={18} />
                                            Pay Now ₹{parseFloat(payAmount) ? parseFloat(payAmount).toLocaleString() : '0'}
                                            <ChevronRight size={18} />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="w-full h-11 rounded-xl font-bold text-sm text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
                                            onClick={() => { setShowPayForm(false); setPayAmount(""); }}
                                            disabled={isPaying}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </Modal>
                        </div>
                    </div>
                )}

                {/* Top info cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <Card className="p-5 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Building2 size={12} /> Supplier</p>
                        <p className="text-base font-bold text-slate-900">{purchase.supplierName || "Unknown Supplier"}</p>
                    </Card>
                    <Card className="p-5 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={12} /> Purchase Date</p>
                        <p className="text-base font-bold text-slate-900">{formattedDate}</p>
                    </Card>
                    <Card className={"p-5 space-y-1.5 " + statusCfg.bg + " " + statusCfg.border + " border"}>
                        <p className={"text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 " + statusCfg.color}>
                            <StatusIcon size={12} /> {statusCfg.label}
                        </p>
                        <p className={"text-2xl font-black " + statusCfg.color}>₹{total.toLocaleString()}</p>
                        {purchase.status === "PARTIAL" && (
                            <div className="space-y-1 pt-1 border-t border-amber-200 mt-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-green-700 font-bold">Paid</span>
                                    <span className="font-black text-green-700">₹{amountPaid.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-red-600 font-bold">Due</span>
                                    <span className="font-black text-red-600">₹{amountDue.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                        {purchase.status === "UNPAID" && (
                            <div className="flex justify-between text-xs pt-1 border-t border-red-200 mt-1">
                                <span className="text-red-600 font-bold">Due</span>
                                <span className="font-black text-red-600">₹{total.toLocaleString()}</span>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Items table */}
                <Card className="overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Package size={14} className="text-slate-500" /> Items Purchased
                        </h3>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-left">Material</TableHead>
                                <TableHead className="text-left">Category</TableHead>
                                <TableHead className="text-left">Batch</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Rate / Unit</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody padRows={false}>
                            {purchase.items?.map((item, idx) => {
                                // Fallback to rawMaterials context if backend fields are not yet available in some legacy paths
                                const material = rawMaterials.find(rm => (rm.edid || rm.id) === (item.materialEdid || item.materialId));
                                return (
                                    <TableRow key={idx}>
                                        <TableCell>{item.materialName || material?.name || "Unknown"}</TableCell>
                                        <TableCell>{item.categoryName || material?.category || "-"}</TableCell>
                                        <TableCell>{item.batchNumber || "-"}</TableCell>
                                        <TableCell className="text-right">{item.qty} {item.unitSymbol || material?.unit || ''}</TableCell>
                                        <TableCell className="text-right">₹{item.rate.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-bold">₹{(item.total || (item.qty * item.rate)).toLocaleString()}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {itemsTotalCount > PAGE_SIZE && (
                        <div className="px-5 py-3 border-t border-slate-200 bg-white">
                            <Pagination
                                currentPage={itemsPage}
                                totalPages={Math.ceil(itemsTotalCount / PAGE_SIZE)}
                                onPageChange={(page) => fetchPurchaseItems(page)}
                                totalItems={itemsTotalCount}
                                itemsPerPage={PAGE_SIZE}
                            />
                        </div>
                    )}
                    <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/50 space-y-1.5">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Amount</span>
                            <span className="text-2xl font-black text-slate-900">₹{total.toLocaleString()}</span>
                        </div>
                        {purchase.status === "PARTIAL" && (
                            <>
                                <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-200">
                                    <span className="font-bold text-green-700">Amount Paid</span>
                                    <span className="font-black text-green-700">₹{amountPaid.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-red-600">Balance Due</span>
                                    <span className="font-black text-red-600">₹{amountDue.toLocaleString()}</span>
                                </div>
                            </>
                        )}
                        {purchase.status === "UNPAID" && (
                            <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-200">
                                <span className="font-bold text-red-600">Balance Due</span>
                                <span className="font-black text-red-600">₹{total.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Attachments */}
                <AttachmentsList attachments={purchase.attachments} />
            </div>
        </div>
    );
}
