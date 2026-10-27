import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Upload, AlertCircle, Zap, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

function playSuccessBeep() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 tone
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
    } catch {
        // Ignore audio errors
    }
}

export function QrCameraScannerModal({ isOpen, onClose, onScan, title = 'Scan Order QR Code' }) {
    const scannerId = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`).current;
    const scannerRef = useRef(null);
    const fileInputRef = useRef(null);

    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [torchOn, setTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [scannedResult, setScannedResult] = useState(null);

    // Stop active scanner safely
    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (err) {
                console.warn('Error stopping scanner:', err);
            } finally {
                setIsScanning(false);
                setTorchOn(false);
            }
        }
    };

    // Start scanner with specific camera or default environment facing
    const startScanner = async (cameraIdToUse = null) => {
        setErrorMsg(null);
        setScannedResult(null);

        // Ensure element exists in DOM
        const targetElement = document.getElementById(scannerId);
        if (!targetElement) return;

        try {
            await stopScanner();

            const html5QrCode = new Html5Qrcode(scannerId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13
                ],
                verbose: false
            });
            scannerRef.current = html5QrCode;

            // Enumerate cameras if not done yet
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                setCameras(devices);
            }

            const cameraConfig = cameraIdToUse || (devices && devices.length > 0
                ? devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'))?.id || devices[0].id
                : { facingMode: 'environment' });

            if (typeof cameraConfig === 'string') {
                setSelectedCameraId(cameraConfig);
            }

            await html5QrCode.start(
                cameraConfig,
                {
                    fps: 15,
                    qrbox: (viewfinderWidth, viewfinderHeight) => {
                        const edge = Math.min(viewfinderWidth, viewfinderHeight) * 0.72;
                        return { width: Math.floor(edge), height: Math.floor(edge) };
                    },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    handleSuccessfulScan(decodedText);
                },
                () => {
                    // Ignore per-frame decode errors
                }
            );

            setIsScanning(true);

            // Check if device supports torch
            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities();
                if (capabilities && capabilities.torch) {
                    setHasTorch(true);
                }
            } catch {
                setHasTorch(false);
            }

        } catch (err) {
            console.error('Failed to start camera QR scanner:', err);
            setIsScanning(false);
            if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
                setErrorMsg('Camera permission was denied. Please allow camera access in your browser or select an image file below.');
            } else if (err?.name === 'NotFoundError' || String(err).includes('device not found')) {
                setErrorMsg('No camera device found on this system. You can upload a QR image below.');
            } else {
                setErrorMsg(err?.message || 'Unable to access camera. Please check camera permissions.');
            }
        }
    };

    const handleSuccessfulScan = (rawText) => {
        if (!rawText) return;
        const cleanText = rawText.trim();
        playSuccessBeep();
        if (navigator.vibrate) {
            navigator.vibrate([80, 40, 80]);
        }

        setScannedResult(cleanText);
        stopScanner();

        // Brief delay for visual confirmation before dismissing
        setTimeout(() => {
            onScan(cleanText);
            onClose();
        }, 350);
    };

    // Toggle Torch / Flashlight
    const handleToggleTorch = async () => {
        if (!scannerRef.current || !hasTorch) return;
        try {
            const nextState = !torchOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
        } catch (err) {
            console.warn('Torch toggle failed:', err);
        }
    };

    // Scan from image file upload fallback
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setErrorMsg(null);
        try {
            const tempScanner = scannerRef.current || new Html5Qrcode(scannerId, { verbose: false });
            const decodedText = await tempScanner.scanFile(file, true);
            handleSuccessfulScan(decodedText);
        } catch (err) {
            console.error('File scan error:', err);
            setErrorMsg('Could not find a valid QR code in the uploaded image. Please try another photo.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Lifecycle
    useEffect(() => {
        if (isOpen) {
            // Small timeout to allow DOM element to render
            const timer = setTimeout(() => {
                startScanner();
            }, 100);
            return () => {
                clearTimeout(timer);
                stopScanner();
            };
        } else {
            stopScanner();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            className="max-w-md w-full overflow-hidden shadow-2xl"
            bodyClassName="p-0 flex flex-col"
        >
            <div className="p-4 bg-slate-900 text-white relative flex flex-col items-center">
                {/* Scanner Target Container */}
                <div className="relative w-full aspect-square max-w-[320px] bg-black rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner">
                    <div id={scannerId} className="w-full h-full" />

                    {/* Scanning Laser and Reticle Overlay */}
                    {isScanning && !scannedResult && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-[72%] h-[72%] border-2 border-indigo-400/80 rounded-xl relative shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                {/* Corners */}
                                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-indigo-400 rounded-tl-sm" />
                                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-indigo-400 rounded-tr-sm" />
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-indigo-400 rounded-bl-sm" />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-indigo-400 rounded-br-sm" />

                                {/* Moving Laser Line */}
                                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_8px_#f43f5e] animate-pulse"
                                     style={{
                                         top: '50%',
                                         animation: 'scannerLaser 2s ease-in-out infinite alternate'
                                     }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Success Overlay */}
                    {scannedResult && (
                        <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95">
                            <CheckCircle2 size={48} className="text-emerald-400 mb-2 animate-bounce" />
                            <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold">QR Detected</div>
                            <div className="text-base font-black text-white mt-1 font-mono bg-emerald-900/80 px-3 py-1 rounded-lg border border-emerald-500/50">
                                {scannedResult}
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="mt-3 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-start gap-2 w-full max-w-[320px]">
                        <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                        <div>{errorMsg}</div>
                    </div>
                )}

                {/* Controls Bar */}
                <div className="mt-3 flex items-center justify-between gap-2 w-full max-w-[320px]">
                    {/* Camera Selector (if multiple) */}
                    {cameras.length > 1 && (
                        <select
                            value={selectedCameraId}
                            onChange={(e) => startScanner(e.target.value)}
                            className="bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 max-w-[150px] truncate"
                        >
                            {cameras.map((c, i) => (
                                <option key={c.id} value={c.id}>
                                    {c.label || `Camera ${i + 1}`}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto">
                        {/* Torch Button */}
                        {hasTorch && (
                            <button
                                type="button"
                                onClick={handleToggleTorch}
                                className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                                title="Toggle Flashlight"
                            >
                                <Zap size={15} />
                            </button>
                        )}

                        {/* Restart / Refresh */}
                        <button
                            type="button"
                            onClick={() => startScanner(selectedCameraId)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Restart Camera"
                        >
                            <RefreshCw size={15} />
                        </button>

                        {/* Upload Image Fallback */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                            <Upload size={14} />
                            <span>Photo</span>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 text-center">
                    Point camera at the shipping label or invoice QR code to load the order automatically.
                </p>
            </div>
        </Modal>
    );
}
