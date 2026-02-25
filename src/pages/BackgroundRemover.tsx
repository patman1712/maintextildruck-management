import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, Save, User, Archive } from 'lucide-react';
import { removeBackground } from "@imgly/background-removal";
import { jsPDF } from "jspdf";
import { useAppStore } from "@/store";

export default function BackgroundRemover() {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [saveMode, setSaveMode] = useState<'archive' | 'customer'>('archive');
    const [progress, setProgress] = useState<string>("");
    
    const customers = useAppStore((state) => state.customers);
    const addOrder = useAppStore((state) => state.addOrder);
    const updateOrder = useAppStore((state) => state.updateOrder);
    const orders = useAppStore((state) => state.orders);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setOriginalImage(url);
            setProcessedImage(null);
            setProcessedBlob(null);
            setProgress("");
        }
    };

    const handleRemoveBackground = async () => {
        if (!originalImage) return;
        setIsProcessing(true);
        setProgress("Starte...");
        
        try {
            // Using imgly with config
            const blob = await removeBackground(originalImage, {
                progress: (key: string, current: number, total: number) => {
                    const percent = Math.round((current / total) * 100);
                    setProgress(`${key}: ${percent}%`);
                },
                debug: true
            });
            const url = URL.createObjectURL(blob);
            setProcessedImage(url);
            setProcessedBlob(blob);
        } catch (error: any) {
            console.error("Background removal failed:", error);
            alert(`Fehler beim Entfernen des Hintergrunds: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async (asPdf: boolean) => {
        if (!processedBlob) return;
        setIsSaving(true);

        try {
            let fileToUpload = processedBlob;
            let filename = `freisteller-${Date.now()}.png`;

            if (asPdf) {
                // Convert to PDF
                const pdf = new jsPDF();
                
                // Get image dimensions to fit PDF or keep aspect ratio
                // Create an image element to get dims
                const img = new Image();
                img.src = processedImage!;
                await new Promise(r => img.onload = r);
                
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                // Scale to fit page
                const ratio = Math.min(pdfWidth / img.width, pdfHeight / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                
                pdf.addImage(processedImage!, 'PNG', 0, 0, w, h);
                const pdfBlob = pdf.output('blob');
                fileToUpload = pdfBlob;
                filename = `freisteller-${Date.now()}.pdf`;
            }

            // Upload File
            const formData = new FormData();
            formData.append('print', fileToUpload, filename);
            
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (!data.success || !data.files.print[0]) throw new Error("Upload failed");
            
            const uploadedFile = data.files.print[0];
            const fileUrl = uploadedFile.path;
            const thumbUrl = uploadedFile.thumbnail;

            // Assign
            if (saveMode === 'customer' && selectedCustomer) {
                // Create Product for Customer
                const prodRes = await fetch(`/api/products/${selectedCustomer}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: filename,
                        productNumber: 'FREISTELLER'
                    })
                });
                const prodData = await prodRes.json();
                if (!prodData.success) throw new Error("Product creation failed");
                
                // Assign File
                await fetch(`/api/products/${prodData.id}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileUrl: fileUrl,
                        fileName: filename,
                        thumbnailUrl: thumbUrl,
                        type: 'print'
                    })
                });
                
                alert("Erfolgreich dem Kunden zugeordnet!");
            } else {
                // Save to Archive (Create/Update 'freisteller-archive' order)
                const archiveId = 'freisteller-archive';
                let archiveOrder = orders.find(o => o.id === archiveId);
                
                if (!archiveOrder) {
                    await addOrder({
                        id: archiveId,
                        title: 'Freisteller Archiv',
                        customerName: 'System',
                        status: 'archived',
                        createdAt: new Date().toISOString(),
                        steps: { processing: true, produced: true, invoiced: true },
                        deadline: new Date().toISOString(),
                        employees: [],
                        files: []
                    });
                    // Refresh orders
                    archiveOrder = useAppStore.getState().orders.find(o => o.id === archiveId);
                }

                const newFile = {
                    name: filename,
                    type: 'print' as const,
                    url: fileUrl,
                    thumbnail: thumbUrl,
                    customName: filename
                };

                const existingFiles = archiveOrder?.files || [];
                await updateOrder(archiveId, {
                    files: [...existingFiles, newFile]
                });
                
                alert("Erfolgreich im Archiv gespeichert!");
            }

        } catch (error) {
            console.error(error);
            alert("Fehler beim Speichern.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <ImageIcon className="mr-3 text-red-600" />
                Freisteller (Hintergrund entfernen)
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Left: Input */}
                <div className="bg-white rounded-lg shadow p-6 flex flex-col">
                    <h3 className="font-semibold mb-4">Originalbild</h3>
                    
                    <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 relative overflow-hidden">
                        {originalImage ? (
                            <img src={originalImage} alt="Original" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="text-center text-gray-400">
                                <Upload className="mx-auto mb-2" size={48} />
                                <p>Bild hierher ziehen oder klicken</p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>

                    <div className="mt-4 flex justify-center">
                        <button 
                            onClick={handleRemoveBackground}
                            disabled={!originalImage || isProcessing}
                            className={`px-6 py-2 rounded-lg text-white font-medium flex items-center ${
                                !originalImage || isProcessing 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ImageIcon className="mr-2" />}
                            {isProcessing ? `Verarbeite... ${progress}` : 'Hintergrund entfernen'}
                        </button>
                    </div>
                </div>

                {/* Right: Output */}
                <div className="bg-white rounded-lg shadow p-6 flex flex-col">
                    <h3 className="font-semibold mb-4">Ergebnis (Freigestellt)</h3>
                    
                    <div className="flex-1 border border-gray-200 rounded-lg flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAACh4556AAAAK0lEQVQ4CWNgGdvgPxIwqoNhBCi42NjY/qM4j0QDKDAawCiIpFohI4OQjOpgGAEKLjY2tv8oziMRAwAAOw140530kQAAAABJRU5ErkJggg==')] relative overflow-hidden">
                        {processedImage ? (
                            <img src={processedImage} alt="Processed" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="text-center text-gray-400">
                                <p>Noch kein Ergebnis</p>
                            </div>
                        )}
                    </div>

                    {processedImage && (
                        <div className="mt-4 space-y-4">
                            <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-2">Speichern als:</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="saveMode" 
                                                value="archive" 
                                                checked={saveMode === 'archive'} 
                                                onChange={() => setSaveMode('archive')}
                                                className="mr-2"
                                            />
                                            <Archive size={16} className="mr-1" />
                                            Nur Archiv
                                        </label>
                                        <label className="flex items-center">
                                            <input 
                                                type="radio" 
                                                name="saveMode" 
                                                value="customer" 
                                                checked={saveMode === 'customer'} 
                                                onChange={() => setSaveMode('customer')}
                                                className="mr-2"
                                            />
                                            <User size={16} className="mr-1" />
                                            Kunde zuordnen
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {saveMode === 'customer' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Kunde wählen</label>
                                    <select 
                                        className="w-full border rounded p-2"
                                        value={selectedCustomer}
                                        onChange={(e) => setSelectedCustomer(e.target.value)}
                                    >
                                        <option value="">Bitte wählen...</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving || (saveMode === 'customer' && !selectedCustomer)}
                                    className="flex-1 bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center"
                                >
                                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                    Als PNG speichern
                                </button>
                                <button 
                                    onClick={() => handleSave(true)}
                                    disabled={isSaving || (saveMode === 'customer' && !selectedCustomer)}
                                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
                                >
                                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                    Als PDF speichern
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}