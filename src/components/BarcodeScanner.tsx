import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, X, Check, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { Product } from '../types';
import { useAppContext } from '../context';
import * as api from '../api';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => { success: boolean; productName?: string; error?: string };
    products: Product[];
}

interface ScannedHistoryItem {
    id: string;
    code: string;
    productName: string;
    success: boolean;
    timestamp: Date;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, products }) => {
    const { user } = useAppContext();
    const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isScannerActive, setIsScannerActive] = useState<boolean>(false);
    const [scannerError, setScannerError] = useState<string>('');
    const [recentScans, setRecentScans] = useState<ScannedHistoryItem[]>([]);
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const [lastScanned, setLastScanned] = useState<{ code: string; time: number } | null>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const viewContainerId = "barcode-scanner-view";

    // Play high-pitched double beep on successful lookup
    const playSuccessBeep = () => {
        if (!soundEnabled) return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // First tone
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.1);

            // Second tone slightly offset
            setTimeout(() => {
                try {
                    const osc2 = audioCtx.createOscillator();
                    const gain2 = audioCtx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(audioCtx.destination);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1500, audioCtx.currentTime);
                    gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
                    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
                    osc2.start();
                    osc2.stop(audioCtx.currentTime + 0.1);
                } catch (err) {
                    // Ignore background audio limits
                }
            }, 60);

        } catch (e) {
            console.warn("Audio feedback error", e);
        }
    };

    // Play lower warning beep on unknown SKU
    const playErrorBeep = () => {
        if (!soundEnabled) return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(280, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);
        } catch (e) {
            console.warn("Audio feedback error", e);
        }
    };

    // Request camera list on open
    useEffect(() => {
        if (isOpen) {
            // Give layout a brief moment to render container
            const timer = setTimeout(() => {
                loadCameras();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            stopScanner();
            setScannerError('');
        }
    }, [isOpen]);

    const loadCameras = async () => {
        try {
            setScannerError('');
            
            // Check for secure context - modern browsers only allow camera in HTTPS or localhost
            if (!window.isSecureContext) {
                setScannerError("Camera access requires a secure (HTTPS) connection. Please check your URL.");
                return;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setScannerError("Your browser or device does not support camera access via the web.");
                return;
            }

            // Ask for temporary permissions first to get device labels if needed
            // This is the standard way to trigger the browser's permission prompt
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (pErr: any) {
                console.warn("Camera permission prompt failed:", pErr);
                if (pErr.name === 'NotAllowedError' || pErr.name === 'PermissionDeniedError') {
                    setScannerError("Camera permission was denied. Please click the camera icon in your browser's address bar to allow access and try again.");
                    return;
                }
                // If it's a NotFoundError or something else, we still try getCameras
            }

            try {
                const videoDevices = await Html5Qrcode.getCameras();
                if (videoDevices && videoDevices.length > 0) {
                    setDevices(videoDevices);
                    
                    // Prefer rear camera if available
                    const rearCamera = videoDevices.find(d => 
                        d.label.toLowerCase().includes('back') || 
                        d.label.toLowerCase().includes('rear') || 
                        d.label.toLowerCase().includes('environment')
                    );
                    
                    const selected = rearCamera ? rearCamera.id : videoDevices[0].id;
                    setSelectedDeviceId(selected);
                    startScanner(selected);
                } else {
                    setScannerError("No video cameras detected on your device. Please ensure your camera is connected and not in use by another app.");
                }
            } catch (getCamerasErr: any) {
                console.error("Camera listing failed", getCamerasErr);
                const errMsg = getCamerasErr.message || String(getCamerasErr);
                setScannerError(`Camera listing failed: ${errMsg}`);
                
                api.logSystemError({
                    type: 'CameraError',
                    message: `Camera listing failed: ${errMsg}`,
                    endpoint: 'BarcodeScanner:Html5Qrcode.getCameras',
                    user_id: user?.id,
                    trader_id: user?.traderId
                });
            }
        } catch (err: any) {
            console.error("Camera listing failed", err);
            const msg = err.message || String(err);
            if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
                setScannerError("Camera access denied. Please enable camera permissions in your browser settings for this site.");
            } else {
                setScannerError(`Hardware error: ${msg}. Try refreshing the page or using a different browser.`);
            }
        }
    };

    const startScanner = async (deviceId: string) => {
        try {
            setScannerError('');
            
            // Stop any existing scanner first
            if (scannerRef.current) {
                await stopScanner();
            }

            const html5QrCode = new Html5Qrcode(viewContainerId);
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                deviceId,
                {
                    fps: 20,
                    qrbox: (width, height) => {
                        // Narrow target rectangle is excellent for horizontal barcodes
                        const targetWidth = Math.min(width * 0.85, 280);
                        const targetHeight = Math.min(height * 0.35, 110);
                        return { width: targetWidth, height: targetHeight };
                    },
                    aspectRatio: 1.333333
                },
                (decodedText) => {
                    handleDecodedText(decodedText);
                },
                () => {
                    // Verbose error from camera scanning frames, safe to ignore
                }
            );

            setIsScannerActive(true);
        } catch (err: any) {
            console.error("Failed to start scanner", err);
            setScannerError(`Could not access this camera. It may be used by another app. Details: ${err.message || err}`);
            setIsScannerActive(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
            } catch (err) {
                console.warn("Failed stopping active scanner stream", err);
            } finally {
                scannerRef.current = null;
                setIsScannerActive(false);
            }
        }
    };

    const handleDecodedText = (text: string) => {
        const cleanedText = text.trim();
        if (!cleanedText) return;

        const now = Date.now();
        
        // Anti-shaking and duplicate scanning cooldown (1.5 seconds cooldown for identical barcodes)
        if (lastScanned && lastScanned.code === cleanedText && (now - lastScanned.time) < 1500) {
            return; 
        }

        setLastScanned({ code: cleanedText, time: now });

        // Lookup product
        const result = onScan(cleanedText);
        
        if (result.success) {
            playSuccessBeep();
            const newItem: ScannedHistoryItem = {
                id: Math.random().toString(36).substr(2, 9),
                code: cleanedText,
                productName: result.productName || 'Unknown Product',
                success: true,
                timestamp: new Date()
            };
            setRecentScans(prev => [newItem, ...prev.slice(0, 9)]);
        } else {
            playErrorBeep();
            const newItem: ScannedHistoryItem = {
                id: Math.random().toString(36).substr(2, 9),
                code: cleanedText,
                productName: result.error || 'Not in stock/catalog',
                success: false,
                timestamp: new Date()
            };
            setRecentScans(prev => [newItem, ...prev.slice(0, 9)]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                            <Camera size={18} className="animate-pulse" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800">Smart Camera Barcode Scanner</h4>
                            <p className="text-[10px] text-slate-400 font-medium">Position code in center frame to auto-add to cart</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`p-1.5 rounded-lg border transition ${
                                soundEnabled 
                                    ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' 
                                    : 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                            }`}
                            title={soundEnabled ? "Disable sound" : "Enable sound"}
                        >
                            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 transition"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
                    
                    {/* Viewfinder Container */}
                    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col items-center justify-center">
                        
                        {/* Target Scanning Overlay */}
                        {isScannerActive && (
                            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                                {/* Dimmed surroundings */}
                                <div className="absolute inset-0 bg-black/40"></div>
                                
                                {/* Target Viewfinder Rectangle Area */}
                                <div className="relative w-[280px] h-[110px] bg-transparent border-2 border-slate-300 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                                    
                                    {/* Neon Green Corners */}
                                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-sm"></div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-sm"></div>
                                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-sm"></div>
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-sm"></div>

                                    {/* Scanning laser line animation */}
                                    <div className="absolute left-0 w-full h-[2px] bg-emerald-400 opacity-80 shadow-[0_0_12px_#34d399] animate-[bounce_2s_infinite]"></div>
                                    
                                    {/* Target guide label */}
                                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-slate-900/90 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-sm whitespace-nowrap">
                                        Align Barcode/SKU
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Scanner View Div element required by Html5Qrcode */}
                        <div id={viewContainerId} className="w-full h-full object-cover"></div>

                        {/* Loading / Error States over view */}
                        {!isScannerActive && !scannerError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-950 z-20">
                                <RefreshCw className="animate-spin text-blue-500 mb-3" size={32} />
                                <p className="text-sm font-bold text-slate-300">Initializing device camera feed...</p>
                                <p className="text-xs text-slate-500 mt-1">Please confirm camera access when prompted.</p>
                            </div>
                        )}

                        {scannerError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400 z-20">
                                <CameraOff className="text-red-400 mb-3" size={40} />
                                <p className="text-sm font-black text-slate-200">Camera Interface Blocked</p>
                                <p className="text-xs text-red-300 max-w-sm mt-2 font-mono leading-relaxed bg-red-950/40 p-3 rounded-lg border border-red-900/30">
                                    {scannerError}
                                </p>
                                <button 
                                    onClick={loadCameras}
                                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition"
                                >
                                    <RefreshCw size={12} />
                                    Retry Access
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Controls & Camera Selection */}
                    {devices.length > 1 && !scannerError && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <RefreshCw size={10} className="animate-spin" /> Switch Video Source:
                            </span>
                            <select 
                                value={selectedDeviceId}
                                onChange={(e) => {
                                    setSelectedDeviceId(e.target.value);
                                    startScanner(e.target.value);
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs truncate shadow-sm cursor-pointer"
                            >
                                {devices.map((device, index) => (
                                    <option key={device.id} value={device.id}>
                                        🎥 {device.label || `Camera ${index + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Recently Scanned List inside modal */}
                    <div className="flex flex-col flex-1 min-h-[140px]">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-between">
                            <span>Scan History & Live Matches</span>
                            {recentScans.length > 0 && (
                                <button 
                                    onClick={() => setRecentScans([])}
                                    className="text-slate-400 hover:text-slate-600 lowercase text-[9px] hover:underline"
                                >
                                    clear history
                                </button>
                            )}
                        </h5>
                        
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex-1 max-h-[160px] overflow-y-auto custom-scrollbar">
                            {recentScans.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-xs italic flex flex-col items-center justify-center gap-1">
                                    <HelpCircle size={20} className="opacity-30" />
                                    <span>Waiting for your first scan...</span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">Try scanning code "SKU-001" or other product codes</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {recentScans.map(item => (
                                        <div key={item.id} className="py-2 px-2.5 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-1 duration-200">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black font-mono uppercase ${
                                                        item.success 
                                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                                            : 'bg-red-100 text-red-600 border border-red-200'
                                                    }`}>
                                                        {item.success ? 'Match' : 'No Match'}
                                                    </span>
                                                    <span className="text-slate-400 font-mono text-[10px]">{item.code}</span>
                                                </div>
                                                <div className="font-bold text-slate-800 truncate mt-1">
                                                    {item.productName}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                {item.success ? (
                                                    <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                        <Check size={12} />
                                                        <span>+1 Cart</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Ignored</span>
                                                )}
                                                <div className="text-[9px] text-slate-400 font-mono mt-1">
                                                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};
