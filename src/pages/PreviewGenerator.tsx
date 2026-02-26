import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Image as ImageIcon, Save, Upload, Plus, Move, Trash2, ZoomIn, RotateCw, X, Download, Printer, Shirt } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from "jspdf";
import { PREVIEW_TEMPLATES } from "@/utils/preview-templates";

interface CanvasElement {
    id: string;
    type: 'image';
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scale: number;
}

const TEMPLATES = PREVIEW_TEMPLATES;

export default function PreviewGenerator() {
    const [template, setTemplate] = useState<string | null>(null);
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [elementStart, setElementStart] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    
    // File Picker State
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [fileSearch, setFileSearch] = useState("");
    const customers = useAppStore((state) => state.customers);
    const orders = useAppStore((state) => state.orders);
    const addOrder = useAppStore((state) => state.addOrder);
    const updateOrder = useAppStore((state) => state.updateOrder);
    
    // Save State
    const [isSaving, setIsSaving] = useState(false);
    const [customTitle, setCustomTitle] = useState("");
    const [saveMode, setSaveMode] = useState<'archive' | 'customer'>('archive');
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [assignToOrder, setAssignToOrder] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState("");

    useEffect(() => {
        setAssignToOrder(false);
        setSelectedOrderId("");
    }, [selectedCustomer]);

    // --- Canvas Logic ---

    const handleTemplateSelect = (url: string) => {
        setTemplate(url);
    };

    const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            setTemplate(url);
        }
    };

    const addImageElement = (url: string) => {
        const newElement: CanvasElement = {
            id: Math.random().toString(),
            type: 'image',
            src: url,
            x: 100, // Centerish
            y: 100,
            width: 200, // Default width
            height: 200,
            rotation: 0,
            scale: 1
        };
        setElements([...elements, newElement]);
        setSelectedId(newElement.id);
        setShowFilePicker(false);
    };

    const updateElement = (id: string, updates: Partial<CanvasElement>) => {
        setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const removeElement = (id: string) => {
        setElements(elements.filter(el => el.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    // Drag Logic (Mouse & Touch)
    const handleStart = (clientX: number, clientY: number, id: string) => {
        setSelectedId(id);
        setIsDragging(true);
        setDragStart({ x: clientX, y: clientY });
        const el = elements.find(el => el.id === id);
        if (el) setElementStart({ x: el.x, y: el.y });
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (isDragging && selectedId) {
            const dx = clientX - dragStart.x;
            const dy = clientY - dragStart.y;
            updateElement(selectedId, {
                x: elementStart.x + dx,
                y: elementStart.y + dy
            });
        }
    };

    const handleEnd = () => {
        setIsDragging(false);
    };

    // Mouse Events
    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        handleStart(e.clientX, e.clientY, id);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
        handleEnd();
    };

    // Touch Events
    const handleTouchStart = (e: React.TouchEvent, id: string) => {
        e.stopPropagation();
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, id);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
        handleEnd();
    };

    const [selectedCustomerForFiles, setSelectedCustomerForFiles] = useState("");

    // --- File Picker Data ---
    // Get all orders and products
    const products = useAppStore((state) => state.products) || [];

    // Filter by customer if selected
    const availableOrders = selectedCustomerForFiles 
        ? orders.filter(o => o.customerId === selectedCustomerForFiles)
        : orders;
        
    const availableProducts = selectedCustomerForFiles
        ? products.filter(p => p.supplier_id === selectedCustomerForFiles)
        : products;

    // Collect files
    const orderFiles = availableOrders.flatMap(o => (o.files || []).map(f => ({ 
        ...f, 
        source: 'Auftrag: ' + o.title,
        date: o.createdAt,
        orderTitle: o.title // Keep for type compatibility
    })));

    const productFiles = availableProducts.flatMap(p => (p.files || []).map(f => ({
        ...f,
        name: f.customName || f.file_name || f.name || p.name,
        url: f.file_url || f.url,
        thumbnail: f.thumbnail_url || f.thumbnail,
        source: 'Produkt: ' + p.name,
        date: p.created_at || new Date().toISOString(),
        orderTitle: undefined // Explicitly undefined for type
    })));

    const combinedFiles = [...orderFiles, ...productFiles]
        .filter(f => (f.type === 'print' || f.type === 'vector'));
    
    const uniqueFiles = Array.from(new Map(combinedFiles.map(f => [f.url, f])).values());
    const filteredFiles = uniqueFiles.filter(f => (f.name || '').toLowerCase().includes(fileSearch.toLowerCase()));

    // --- Saving Logic ---
    const handleSave = async (format: 'png' | 'pdf') => {
        if (!canvasRef.current) return;
        setIsSaving(true);
        setSelectedId(null); // Deselect to hide handles

        try {
            // Wait for render
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(canvasRef.current, {
                useCORS: true,
                scale: 2 // Better quality
            });

            let blob: Blob | null = null;
            let filename = `${customTitle || 'vorschau'}-${Date.now()}`;

            if (format === 'png') {
                blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
                filename += '.png';
            } else {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: canvas.width > canvas.height ? 'l' : 'p',
                    unit: 'px',
                    format: [canvas.width, canvas.height] // Match canvas size roughly or fit A4? Let's match canvas for now or fit
                });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                blob = pdf.output('blob');
                filename += '.pdf';
            }

            if (!blob) throw new Error("Blob creation failed");

            // Upload
            const formData = new FormData();
            formData.append('print', blob, filename);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!data.success || !data.files.print[0]) throw new Error("Upload failed");
            
            const uploadedFile = data.files.print[0];
            const fileUrl = uploadedFile.path;
            const thumbUrl = uploadedFile.thumbnail;

            // Assign
            if (saveMode === 'customer' && selectedCustomer) {
                // Create Dummy Product for Preview if needed, or just add to customer files?
                // Request said "wie bei freisteller" -> assign to customer.
                // We'll create a "VORSCHAU" product or check if one exists, OR just add file to customer product list?
                // In CustomerDetails, we filter previews. So we need to assign it to a product.
                // Let's create a "Vorschau Entwürfe" product.
                
                const prodRes = await fetch(`/api/products/${selectedCustomer}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: customTitle || filename,
                        productNumber: 'FREISTELLER' // Reuse this key to group in previews tab
                    })
                });
                const prodData = await prodRes.json();
                
                await fetch(`/api/products/${prodData.id}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileUrl: fileUrl,
                        fileName: filename,
                        customName: customTitle,
                        thumbnailUrl: thumbUrl,
                        type: 'preview' // Important for the tab!
                    })
                });
                
                // Assign to Order if selected
                if (assignToOrder && selectedOrderId) {
                     const order = orders.find(o => o.id === selectedOrderId);
                     if (order) {
                        const newFile = {
                            name: filename,
                            type: 'preview' as const,
                            url: fileUrl,
                            thumbnail: thumbUrl,
                            customName: customTitle || filename
                        };
                        const existingFiles = order.files || [];
                        await updateOrder(selectedOrderId, {
                            files: [...existingFiles, newFile]
                        });
                     }
                }

                alert("Erfolgreich als Vorschau beim Kunden gespeichert!" + (assignToOrder && selectedOrderId ? " Und dem Auftrag zugewiesen." : ""));
            } else {
                // Archive
                const archiveId = 'preview-archive';
                let archiveOrder = orders.find(o => o.id === archiveId);
                
                if (!archiveOrder) {
                    await addOrder({
                        id: archiveId,
                        title: 'Vorschau Archiv',
                        customerName: 'System',
                        status: 'archived',
                        createdAt: new Date().toISOString(),
                        steps: { processing: true, produced: true, invoiced: true },
                        deadline: new Date().toISOString(),
                        employees: [],
                        files: []
                    });
                    archiveOrder = useAppStore.getState().orders.find(o => o.id === archiveId);
                }

                const newFile = {
                    name: filename,
                    type: 'preview' as const,
                    url: fileUrl,
                    thumbnail: thumbUrl,
                    customName: customTitle || filename
                };

                const existingFiles = archiveOrder?.files || [];
                await updateOrder(archiveId, {
                    files: [...existingFiles, newFile]
                });
                alert("Erfolgreich im Archiv gespeichert!");
            }

        } catch (e) {
            console.error(e);
            alert("Fehler beim Speichern.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Template Picker Logic (Customer Previews) ---
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [selectedCustomerForTemplates, setSelectedCustomerForTemplates] = useState("");
    
    // Filter previews from products for template usage
    const customerPreviews = (selectedCustomerForTemplates 
        ? products.filter(p => p.supplier_id === selectedCustomerForTemplates)
        : products
    ).flatMap(p => (p.files || [])
        .filter(f => f.type === 'preview') // Only preview images
        .map(f => ({
            ...f,
            productName: p.name,
            customerName: customers.find(c => c.id === p.supplier_id)?.name
        }))
    );

    return (
        <div 
            className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col" 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                    <Shirt className="mr-3 text-red-600" />
                    Vorschau-Generierer
                </h1>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setShowTemplatePicker(true)}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center hover:bg-gray-50 shadow-sm"
                    >
                        <ImageIcon size={18} className="mr-2" />
                        Kunden-Vorschau als Template
                    </button>
                    <button 
                        onClick={() => setShowFilePicker(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 shadow-sm"
                    >
                        <Plus size={18} className="mr-2" />
                        Grafik / Logo hinzufügen
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left: Tools & Templates */}
                <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col overflow-y-auto">
                    <h3 className="font-bold text-gray-700 mb-3">Templates</h3>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        {TEMPLATES.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => handleTemplateSelect(t.url)}
                                className={`p-2 border rounded text-xs text-center hover:bg-red-50 hover:border-red-200 transition-colors ${template === t.url ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                            >
                                <div className="h-10 bg-gray-100 mb-1 rounded flex items-center justify-center">
                                    <Shirt size={16} className="text-gray-400" />
                                </div>
                                {t.name}
                            </button>
                        ))}
                    </div>

                    <div className="mb-6">
                        <h3 className="font-bold text-gray-700 mb-3">Eigener Upload</h3>
                        <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="text-center text-gray-500">
                                <Upload size={20} className="mx-auto mb-1" />
                                <span className="text-xs">Bild wählen</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleUploadTemplate} />
                        </label>
                    </div>

                    {selectedId && (
                        <div className="border-t pt-4">
                            <h3 className="font-bold text-gray-700 mb-3">Element bearbeiten</h3>
                            {(() => {
                                const el = elements.find(e => e.id === selectedId);
                                if (!el) return null;
                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Größe (Skalierung)</label>
                                            <input 
                                                type="range" min="0.1" max="3" step="0.1" 
                                                value={el.scale}
                                                onChange={(e) => updateElement(selectedId, { scale: parseFloat(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Drehung</label>
                                            <input 
                                                type="range" min="0" max="360" step="1" 
                                                value={el.rotation}
                                                onChange={(e) => updateElement(selectedId, { rotation: parseFloat(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => removeElement(selectedId)}
                                            className="w-full bg-red-100 text-red-700 py-2 rounded text-sm hover:bg-red-200 flex items-center justify-center"
                                        >
                                            <Trash2 size={16} className="mr-2" /> Entfernen
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Center: Canvas */}
                <div className="lg:col-span-6 bg-gray-100 rounded-lg shadow-inner flex items-center justify-center p-4 relative overflow-hidden border border-gray-300">
                    {!template ? (
                        <div className="text-center text-gray-400">
                            <Shirt size={64} className="mx-auto mb-4 opacity-50" />
                            <p>Wähle ein Template oder lade ein Bild hoch</p>
                        </div>
                    ) : (
                        <div 
                            ref={canvasRef}
                            className="relative bg-white shadow-lg overflow-hidden"
                            style={{ width: '500px', height: '600px' }} // Fixed canvas size for simplicity
                        >
                            {/* Background */}
                            <img src={template} alt="Template" className="w-full h-full object-cover pointer-events-none select-none" />
                            
                            {/* Elements */}
                            {elements.map(el => (
                                <div
                                    key={el.id}
                                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                                    onTouchStart={(e) => handleTouchStart(e, el.id)}
                                    className={`absolute cursor-move group ${selectedId === el.id ? 'ring-2 ring-blue-500' : ''}`}
                                    style={{
                                        left: el.x,
                                        top: el.y,
                                        width: el.width * el.scale,
                                        height: el.height * el.scale,
                                        transform: `rotate(${el.rotation}deg)`,
                                        transformOrigin: 'center center'
                                    }}
                                >
                                    <img src={el.src} alt="" className="w-full h-full object-contain pointer-events-none select-none" />
                                    {selectedId === el.id && (
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100">
                                            Verschieben
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Save Options */}
                <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col">
                    <h3 className="font-bold text-gray-700 mb-4">Speichern & Export</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Titel / Name</label>
                            <input 
                                type="text" 
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                className="w-full border rounded p-2 text-sm"
                                placeholder="z.B. Hoodie Entwurf V1"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center text-sm">
                                <input 
                                    type="radio" 
                                    name="saveMode" 
                                    value="archive" 
                                    checked={saveMode === 'archive'} 
                                    onChange={() => setSaveMode('archive')}
                                    className="mr-2"
                                />
                                Nur ins Archiv
                            </label>
                            <label className="flex items-center text-sm">
                                <input 
                                    type="radio" 
                                    name="saveMode" 
                                    value="customer" 
                                    checked={saveMode === 'customer'} 
                                    onChange={() => setSaveMode('customer')}
                                    className="mr-2"
                                />
                                Kunde zuordnen
                            </label>
                        </div>

                        {saveMode === 'customer' && (
                            <>
                                <select 
                                    className="w-full border rounded p-2 text-sm"
                                    value={selectedCustomer}
                                    onChange={(e) => setSelectedCustomer(e.target.value)}
                                >
                                    <option value="">Kunde wählen...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>

                                {selectedCustomer && orders.filter(o => o.customerId === selectedCustomer && o.status === 'active').length > 0 && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                        <label className="flex items-center text-xs font-medium text-gray-700 mb-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="mr-2"
                                                checked={assignToOrder}
                                                onChange={(e) => setAssignToOrder(e.target.checked)}
                                            />
                                            Auch einem offenen Auftrag zuweisen?
                                        </label>
                                        
                                        {assignToOrder && (
                                            <select 
                                                className="w-full border rounded p-1.5 text-xs"
                                                value={selectedOrderId}
                                                onChange={(e) => setSelectedOrderId(e.target.value)}
                                            >
                                                <option value="">Auftrag wählen...</option>
                                                {orders
                                                    .filter(o => o.customerId === selectedCustomer && o.status === 'active')
                                                    .map(o => (
                                                        <option key={o.id} value={o.id}>
                                                            #{o.orderNumber || o.id.substr(0,8)} - {o.title}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        <div className="border-t pt-4 space-y-2">
                            <button 
                                onClick={() => handleSave('png')}
                                disabled={isSaving || (saveMode === 'customer' && !selectedCustomer) || !template}
                                className="w-full bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center text-sm"
                            >
                                <Save size={16} className="mr-2" />
                                Als PNG speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Picker Modal */}
            {showTemplatePicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold">Kunden-Vorschau als Hintergrund wählen</h3>
                            <button onClick={() => setShowTemplatePicker(false)}><X size={20} /></button>
                        </div>
                        <div className="p-4 border-b">
                            <select 
                                className="w-full border border-gray-300 rounded p-2"
                                value={selectedCustomerForTemplates}
                                onChange={(e) => setSelectedCustomerForTemplates(e.target.value)}
                            >
                                <option value="">Alle Kunden durchsuchen...</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {customerPreviews.map((file, idx) => (
                                <div 
                                    key={idx} 
                                    className="border rounded p-2 hover:bg-gray-50 cursor-pointer flex flex-col items-center"
                                    onClick={() => {
                                        if (file.file_url || file.url) {
                                            handleTemplateSelect(file.file_url || file.url || '');
                                            setShowTemplatePicker(false);
                                        }
                                    }}
                                >
                                    <div className="h-24 w-24 flex items-center justify-center overflow-hidden bg-gray-100 rounded mb-2">
                                        {(file.thumbnail_url || file.thumbnail || file.file_url || file.url) ? (
                                            <img src={file.thumbnail_url || file.thumbnail || file.file_url || file.url} className="max-w-full max-h-full object-contain" />
                                        ) : (
                                            <ImageIcon className="text-gray-300" />
                                        )}
                                    </div>
                                    <span className="text-[10px] text-center truncate w-full block font-medium" title={file.file_name || file.name}>{file.file_name || file.name}</span>
                                    <span className="text-[9px] text-gray-500 text-center truncate w-full block">{file.customerName}</span>
                                </div>
                            ))}
                            {customerPreviews.length === 0 && (
                                <div className="col-span-full text-center py-8 text-gray-500">
                                    Keine Vorschaubilder gefunden.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* File Picker Modal */}
            {showFilePicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold">Grafik aus System wählen</h3>
                            <button onClick={() => setShowFilePicker(false)}><X size={20} /></button>
                        </div>
                        <div className="p-4 border-b">
                            <select 
                                className="w-full border border-gray-300 rounded p-2 mb-2"
                                value={selectedCustomerForFiles}
                                onChange={(e) => setSelectedCustomerForFiles(e.target.value)}
                            >
                                <option value="">Alle Kunden durchsuchen...</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <input 
                                type="text" 
                                placeholder="Dateiname suchen..." 
                                value={fileSearch}
                                onChange={(e) => setFileSearch(e.target.value)}
                                className="w-full border border-gray-300 rounded p-2"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {filteredFiles.map((file, idx) => (
                                <div 
                                    key={idx} 
                                    className="border rounded p-2 hover:bg-gray-50 cursor-pointer flex flex-col items-center"
                                    onClick={() => {
                                        const isPdf = (file.name || '').toLowerCase().endsWith('.pdf');
                                        addImageElement(isPdf ? (file.thumbnail || '') : (file.url || file.thumbnail || ''));
                                    }}
                                >
                                    <div className="h-20 w-20 flex items-center justify-center overflow-hidden bg-gray-100 rounded mb-2">
                                        {(file.thumbnail || file.url) ? (
                                            <img src={file.thumbnail || file.url} className="max-w-full max-h-full object-contain" />
                                        ) : (
                                            <Printer className="text-gray-300" />
                                        )}
                                    </div>
                                    <span className="text-[10px] text-center truncate w-full block font-medium" title={file.name}>{file.name}</span>
                                    <span className="text-[9px] text-gray-500 text-center truncate w-full block">{file.source || file.orderTitle}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
