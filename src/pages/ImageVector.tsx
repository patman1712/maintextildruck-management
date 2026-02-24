import { useState, useRef, useEffect } from "react";
import { Upload, Download, Sliders, Image as ImageIcon, Zap, AlertTriangle, Layers } from "lucide-react";
// @ts-ignore
import ImageTracer from 'imagetracerjs';
import { jsPDF } from "jspdf";
import "svg2pdf.js";

export default function ImageVector() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [vectorSvg, setVectorSvg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [options, setOptions] = useState({
    ltres: 1,
    qtres: 1,
    pathomit: 8,
    colorsampling: 2, // 0: disabled, 1: random, 2: deterministic
    numberofcolors: 16,
    mincolorratio: 0,
    colorquantcycles: 3,
    strokewidth: 1,
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

  const vectorizeImage = () => {
    if (!originalImage) return;
    setProcessing(true);

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
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-medium text-gray-500">Farben (Anzahl)</label>
                            <span className="text-xs font-bold text-gray-700">{options.numberofcolors}</span>
                        </div>
                        <input 
                            type="range" min="2" max="64" step="1" 
                            value={options.numberofcolors} 
                            onChange={(e) => setOptions({...options, numberofcolors: parseInt(e.target.value)})}
                            className="w-full accent-red-600"
                        />
                    </div>
                    
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="block text-xs font-medium text-gray-500">Detailgenauigkeit</label>
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
                            <button 
                                onClick={downloadPdf}
                                className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 flex items-center justify-center mt-3 font-medium transition-colors shadow-sm"
                            >
                                <Download size={18} className="mr-2" /> Als PDF speichern
                            </button>
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
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[500px] flex flex-col">
            <h2 className="font-semibold text-lg mb-4 flex items-center justify-between text-gray-700">
                <span>Vorschau & Vergleich</span>
                {vectorSvg && <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Schieber bewegen zum Vergleichen</span>}
            </h2>

            <div className="flex-1 relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center select-none p-4">
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
                            className="max-w-full max-h-[600px] object-contain block bg-white" 
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
