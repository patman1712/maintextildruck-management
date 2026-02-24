import { useState, useRef, useEffect } from "react";
import { Upload, Download, Sliders, Image as ImageIcon, Zap, AlertTriangle, Layers, Maximize2, Minimize2, X } from "lucide-react";
// @ts-ignore
import ImageTracer from 'imagetracerjs';
import { jsPDF } from "jspdf";
import "svg2pdf.js";

export default function ImageVector() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [vectorSvg, setVectorSvg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [zoom100, setZoom100] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [comicMode, setComicMode] = useState(false);
  const [mode, setMode] = useState<'local' | 'server-bw' | 'server-color'>('local');
  const [options, setOptions] = useState({
    ltres: 0.1,
    qtres: 0.1,
    pathomit: 2,
    colorsampling: 2, // 0: disabled, 1: random, 2: deterministic
    numberofcolors: 16,
    mincolorratio: 0,
    colorquantcycles: 3,
    strokewidth: 0,
    linefilter: false,
    scale: 1,
    roundcoords: 1,
    viewbox: 0,
    desc: false,
    lcpr: 0,
    qcpr: 0,
    blurradius: 0,
    blurdelta: 20
  });

  const applyPreset = (type: 'logo' | 'photo' | 'bw' | 'server-bw' | 'server-color') => {
      if (type === 'server-bw') {
          setMode('server-bw');
          return;
      }
      if (type === 'server-color') {
          setMode('server-color');
          setOptions(prev => ({ ...prev, numberofcolors: 8 })); // Cleaner logos with fewer colors
          return;
      }
      setMode('local');
      if (type === 'logo') {
          setOptions(prev => ({ ...prev, numberofcolors: 16, ltres: 1, qtres: 1, pathomit: 8, strokewidth: 1 }));
      } else if (type === 'photo') {
          setOptions(prev => ({ ...prev, numberofcolors: 64, ltres: 0.1, qtres: 0.1, pathomit: 1, strokewidth: 0 }));
      } else if (type === 'bw') {
          setOptions(prev => ({ ...prev, numberofcolors: 2, ltres: 0.5, qtres: 0.5, pathomit: 4, strokewidth: 0 }));
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setVectorSvg(null); 
      };
      reader.readAsDataURL(file);
    }
  };

  const vectorizeImage = async () => {
    if (!originalImage) return;
    setProcessing(true);

    if (mode.startsWith('server')) {
        try {
            const res = await fetch(originalImage);
            const blob = await res.blob();
            const formData = new FormData();
            formData.append('image', blob, 'image.png');
            
            if (mode === 'server-color') {
                formData.append('colors', options.numberofcolors.toString());
                // Map ltres to detail (0-100) for server
                const detail = Math.max(0, Math.min(100, Math.round(100 - ((options.ltres - 0.1) / 4.9) * 100)));
                formData.append('detail', detail.toString());
                if (comicMode) formData.append('comic', 'true');
            }

            const endpoint = mode === 'server-bw' ? '/api/vector/potrace' : '/api/vector/potrace-color';
            const apiRes = await fetch(endpoint, { method: 'POST', body: formData });
            const data = await apiRes.json();
            
            if (data.success) {
                setVectorSvg(data.svg);
            } else {
                alert("Server Fehler: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Netzwerkfehler beim Server-Upload");
        } finally {
            setProcessing(false);
        }
        return;
    }

    setTimeout(() => {
        try {
            ImageTracer.imageToSVG(
                originalImage,
                (svgstr: string) => {
                    setVectorSvg(svgstr);
                    setProcessing(false);
                },
                options
            );
        } catch (error) {
            console.error(error);
            alert("Fehler bei der Vektorisierung");
            setProcessing(false);
        }
    }, 100);
  };

  const downloadSvg = () => {
    if (!vectorSvg) return;
    const blob = new Blob([vectorSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vector-image.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!vectorSvg) return;
    
    const container = document.createElement('div');
    container.innerHTML = vectorSvg;
    const svgElement = container.querySelector('svg');
    
    if (!svgElement) return;

    // Fix SVG dimensions for PDF if missing
    let width = parseFloat(svgElement.getAttribute('width') || '0');
    let height = parseFloat(svgElement.getAttribute('height') || '0');
    
    // If width/height are missing or percentage, try viewBox
    if (!width || !height) {
       const viewBox = svgElement.getAttribute('viewBox');
       if (viewBox) {
           const parts = viewBox.split(' ');
           width = parseFloat(parts[2]);
           height = parseFloat(parts[3]);
       } else {
           // Fallback defaults
           width = 595; 
           height = 842;
       }
    }

    const doc = new jsPDF({
        orientation: width > height ? 'l' : 'p',
        unit: 'pt',
        format: [width, height]
    });

    await doc.svg(svgElement, {
        x: 0,
        y: 0,
        width: width,
        height: height
    });

    doc.save('vector-image.pdf');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <Layers className="mr-2 text-red-600" />
        Bild Vektorisierer
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
            <h2 className="font-semibold text-lg mb-4 flex items-center text-gray-700"><Sliders size={18} className="mr-2"/> Einstellungen</h2>
            
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bild hochladen</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-red-50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-gray-400" />
                        <p className="text-sm text-gray-500"><span className="font-semibold">Klicken zum Hochladen</span></p>
                        <p className="text-xs text-gray-500">JPG, PNG (Max. 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
            </div>

            {originalImage && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">Schnell-Einstellungen</label>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => applyPreset('logo')} className="px-2 py-2 bg-gray-50 hover:bg-gray-100 text-xs rounded border border-gray-200 text-gray-700 transition-colors">Logo (Einfach)</button>
                            <button onClick={() => applyPreset('photo')} className="px-2 py-2 bg-gray-50 hover:bg-gray-100 text-xs rounded border border-gray-200 text-gray-700 transition-colors">Foto (Detail)</button>
                            <button onClick={() => applyPreset('bw')} className="px-2 py-2 bg-gray-50 hover:bg-gray-100 text-xs rounded border border-gray-200 text-gray-700 transition-colors">Schwarz/Weiß</button>
                            <button onClick={() => applyPreset('server-bw')} className="px-2 py-2 bg-blue-50 hover:bg-blue-100 text-xs rounded border border-blue-200 text-blue-700 transition-colors font-medium">Profi S/W (Server)</button>
                            <button onClick={() => applyPreset('server-color')} className="px-2 py-2 bg-purple-50 hover:bg-purple-100 text-xs rounded border border-purple-200 text-purple-700 transition-colors font-medium col-span-2">Profi Farbe (Server)</button>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-medium text-gray-500">Farben (Anzahl) (Lokal & Server)</label>
                            <span className="text-xs font-bold text-gray-700">{options.numberofcolors}</span>
                        </div>
                        <input 
                            type="range" min="2" max="64" step="1" 
                            value={options.numberofcolors} 
                            onChange={(e) => setOptions({...options, numberofcolors: parseInt(e.target.value)})}
                            className="w-full accent-red-600"
                        />
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 mt-2 cursor-pointer select-none">
                            <input type="checkbox" checked={comicMode} onChange={e => setComicMode(e.target.checked)} className="rounded text-red-600 focus:ring-red-500" />
                            <span>Comic-Modus (für Illustrationen/Anime)</span>
                        </label>
                    </div>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="block text-xs font-medium text-gray-500">Detailgenauigkeit (Lokal & Server)</label>
                             <span className="text-xs font-bold text-gray-700">{options.ltres}</span>
                        </div>
                        <input 
                            type="range" min="0.1" max="5" step="0.1" 
                            value={options.ltres} 
                            onChange={(e) => setOptions({...options, ltres: parseFloat(e.target.value)})}
                            className="w-full accent-red-600"
                        />
                         <div className="text-right text-[10px] text-gray-400">Kleiner = Genauer (mehr Pfade)</div>
                    </div>

                    <div className="pt-2">
                        <button 
                            onClick={vectorizeImage}
                            disabled={processing}
                            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 flex items-center justify-center disabled:opacity-50 font-medium transition-colors shadow-sm"
                        >
                            {processing ? (
                                <><Zap className="animate-pulse mr-2" size={18} /> Verarbeite...</>
                            ) : (
                                <><Zap className="mr-2" size={18} /> Vektorisieren starten</>
                            )}
                        </button>
                        
                        {vectorSvg && (
                            <div className="flex gap-2 mt-3">
                                <button 
                                    onClick={downloadSvg}
                                    className="flex-1 bg-white text-slate-800 border border-slate-300 py-3 rounded-lg hover:bg-slate-50 flex items-center justify-center font-medium transition-colors shadow-sm"
                                >
                                    <Download size={18} className="mr-2" /> SVG
                                </button>
                                <button 
                                    onClick={downloadPdf}
                                    className="flex-1 bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 flex items-center justify-center font-medium transition-colors shadow-sm"
                                >
                                    <Download size={18} className="mr-2" /> PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="mt-6 p-3 bg-yellow-50 rounded border border-yellow-100 text-xs text-yellow-800 flex items-start">
                <AlertTriangle size={14} className="mr-2 mt-0.5 shrink-0" />
                <p>Hinweis: Die Vektorisierung läuft lokal in Ihrem Browser. Große Bilder können kurzzeitig das Fenster einfrieren.</p>
            </div>
        </div>

        {/* Preview Area */}
        <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col transition-all duration-300 ${fullscreen ? 'fixed inset-0 z-[100] h-screen w-screen rounded-none' : 'lg:col-span-2 min-h-[500px]'}`}>
            <h2 className="font-semibold text-lg mb-4 flex items-center justify-between text-gray-700">
                <span>Vorschau & Vergleich</span>
                <div className="flex items-center space-x-2">
                    {vectorSvg && (
                        <button 
                            onClick={() => setFullscreen(!fullscreen)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors mr-2"
                            title={fullscreen ? "Vollbild beenden" : "Vollbild"}
                        >
                             {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                    )}
                    {vectorSvg && (
                        <button 
                            onClick={() => setZoom100(!zoom100)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${zoom100 ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-300 text-gray-600'}`}
                        >
                            {zoom100 ? 'Zoom: 100%' : 'Zoom: Fit'}
                        </button>
                    )}
                    {vectorSvg && <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Schieber bewegen</span>}
                </div>
            </h2>

            <div className={`flex-1 relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center select-none p-4 ${zoom100 ? 'overflow-auto block' : ''}`}>
                {!originalImage ? (
                    <div className="text-center text-gray-400">
                        <ImageIcon size={64} className="mx-auto mb-4 opacity-20" />
                        <p className="font-medium">Bitte laden Sie ein Bild hoch</p>
                    </div>
                ) : (
                    <div className="relative inline-block shadow-lg">
                        {/* Original Image (Background) */}
                        <img 
                            src={originalImage} 
                            alt="Original" 
                            className={`object-contain block bg-white ${zoom100 ? 'max-w-none' : (fullscreen ? 'max-w-full max-h-[calc(100vh-150px)]' : 'max-w-full max-h-[600px]')}`} 
                        />
                        
                        {/* Vector Image (Overlay) - Clipped */}
                        {vectorSvg && (
                            <div 
                                className="absolute inset-0 bg-white"
                                style={{ 
                                    clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                                    // Ensure inner SVG scales exactly like the IMG
                                }}
                            >
                                <div 
                                    className="w-full h-full"
                                    dangerouslySetInnerHTML={{ __html: vectorSvg }} 
                                    // We rely on SVG usually having width/height set by imagetracer to match img
                                />
                            </div>
                        )}
                        
                        {/* Slider Control Overlay */}
                        {vectorSvg && (
                            <>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={sliderPosition}
                                    onChange={(e) => setSliderPosition(parseInt(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10 m-0"
                                    style={{ appearance: 'none' }}
                                />
                                {/* Slider Handle Visual Line */}
                                <div 
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none z-20"
                                    style={{ left: `${sliderPosition}%` }}
                                >
                                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-red-600">
                                        <Sliders size={16} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            
            {vectorSvg && (
                <div className="mt-4 flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <span className="text-red-600">Original (Raster)</span>
                    <span className="text-green-600">Vektorisierung (SVG)</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
