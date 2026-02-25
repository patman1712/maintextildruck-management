// SVG Templates converted to Base64 Data URIs
// These are simple, clean vector representations of garments

const svgToDataUri = (svgString: string) => 
    `data:image/svg+xml;base64,${btoa(svgString)}`;

const TSHIRT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <path d="M140 20 C140 20 180 50 250 50 C320 50 360 20 360 20 L480 100 L440 160 L360 120 L360 480 L140 480 L140 120 L60 160 L20 100 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <path d="M250 50 C300 50 360 20 360 20" fill="none" stroke="#9ca3af" stroke-width="3"/>
</svg>`;

const HOODIE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <!-- Body -->
  <path d="M120 60 L380 60 L480 140 L440 200 L380 160 L380 480 L120 480 L120 160 L60 200 L20 140 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Pocket -->
  <path d="M150 350 L350 350 L370 460 L130 460 Z" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <!-- Hood -->
  <path d="M150 60 C150 60 130 0 250 0 C370 0 350 60 350 60" fill="#e5e7eb" stroke="#9ca3af" stroke-width="3"/>
  <!-- Strings -->
  <path d="M220 60 L220 180 M280 60 L280 180" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

const JACKET_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <path d="M120 40 L380 40 L480 120 L440 180 L380 140 L380 480 L120 480 L120 140 L60 180 L20 120 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Zipper -->
  <line x1="250" y1="40" x2="250" y2="480" stroke="#9ca3af" stroke-width="3" />
  <!-- Pockets -->
  <path d="M150 380 L150 460 M350 380 L350 460" stroke="#9ca3af" stroke-width="2"/>
  <!-- Collar -->
  <path d="M120 40 L250 80 L380 40" fill="none" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

const JERSEY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <path d="M120 20 L380 20 L480 100 L440 160 L380 120 L380 480 L120 480 L120 120 L60 160 L20 100 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- V Neck -->
  <path d="M120 20 L250 100 L380 20" fill="none" stroke="#9ca3af" stroke-width="3"/>
  <!-- Sleeve Stripes -->
  <path d="M40 120 L80 140 M420 140 L460 120" stroke="#9ca3af" stroke-width="5"/>
</svg>`;

const PANTS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <path d="M130 20 L370 20 L400 150 L380 480 L270 480 L250 200 L230 480 L120 480 L100 150 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Waistband -->
  <rect x="130" y="20" width="240" height="40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <!-- Pockets -->
  <path d="M130 60 Q180 110 130 200 M370 60 Q320 110 370 200" fill="none" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

const SHORTS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <path d="M130 20 L370 20 L400 120 L380 350 L270 350 L250 150 L230 350 L120 350 L100 120 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Waistband -->
  <rect x="130" y="20" width="240" height="40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

export const PREVIEW_TEMPLATES = [
    { id: 'tshirt', name: 'T-Shirt', url: svgToDataUri(TSHIRT_SVG) },
    { id: 'hoodie', name: 'Hoodie', url: svgToDataUri(HOODIE_SVG) },
    { id: 'jacket', name: 'Sweat Jacke', url: svgToDataUri(JACKET_SVG) },
    { id: 'jersey', name: 'Trikot', url: svgToDataUri(JERSEY_SVG) },
    { id: 'pants', name: 'Hose', url: svgToDataUri(PANTS_SVG) },
    { id: 'shorts', name: 'Kurze Hose', url: svgToDataUri(SHORTS_SVG) },
];
