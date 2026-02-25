// SVG Templates converted to Base64 Data URIs
// These are simple, clean vector representations of garments

const svgToDataUri = (svgString: string) => 
    `data:image/svg+xml;base64,${btoa(svgString)}`;

const TSHIRT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600">
  <path d="M160 20 C160 20 200 60 250 60 C300 60 340 20 340 20 L440 80 L400 160 L340 130 L340 580 L160 580 L160 130 L100 160 L60 80 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <path d="M250 60 C300 60 340 20 340 20" fill="none" stroke="#9ca3af" stroke-width="3"/>
</svg>`;

const HOODIE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600">
  <!-- Body -->
  <path d="M150 80 L350 80 L440 160 L400 220 L340 180 L340 580 L160 580 L160 180 L100 220 L60 160 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Pocket -->
  <path d="M180 400 L320 400 L340 550 L160 550 Z" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <!-- Hood -->
  <path d="M170 80 C170 80 150 10 250 10 C350 10 330 80 330 80" fill="#e5e7eb" stroke="#9ca3af" stroke-width="3"/>
  <!-- Strings -->
  <path d="M230 80 L230 180 M270 80 L270 180" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

const JACKET_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600">
  <path d="M150 60 L350 60 L440 140 L400 200 L340 160 L340 580 L160 580 L160 160 L100 200 L60 140 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Zipper -->
  <line x1="250" y1="60" x2="250" y2="580" stroke="#9ca3af" stroke-width="3" />
  <!-- Pockets -->
  <path d="M170 450 L170 550 M330 450 L330 550" stroke="#9ca3af" stroke-width="2"/>
  <!-- Collar -->
  <path d="M150 60 L250 100 L350 60" fill="none" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

const JERSEY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600">
  <path d="M150 20 L350 20 L450 100 L410 160 L350 120 L350 580 L150 580 L150 120 L90 160 L50 100 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- V Neck -->
  <path d="M150 20 L250 120 L350 20" fill="none" stroke="#9ca3af" stroke-width="3"/>
  <!-- Sleeve Stripes -->
  <path d="M60 120 L100 150 M400 150 L440 120" stroke="#9ca3af" stroke-width="5"/>
</svg>`;

const PANTS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600">
  <path d="M150 50 L350 50 L370 200 L360 580 L260 580 L250 250 L240 580 L140 580 L130 200 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Waistband -->
  <rect x="150" y="50" width="200" height="40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <!-- Pockets -->
  <path d="M150 100 Q200 150 150 250 M350 100 Q300 150 350 250" fill="none" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

const SHORTS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 600">
  <path d="M150 50 L350 50 L370 150 L360 350 L260 350 L250 200 L240 350 L140 350 L130 150 Z" fill="#f3f4f6" stroke="#9ca3af" stroke-width="3"/>
  <!-- Waistband -->
  <rect x="150" y="50" width="200" height="40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

export const PREVIEW_TEMPLATES = [
    { id: 'tshirt', name: 'T-Shirt', url: svgToDataUri(TSHIRT_SVG) },
    { id: 'hoodie', name: 'Hoodie', url: svgToDataUri(HOODIE_SVG) },
    { id: 'jacket', name: 'Sweat Jacke', url: svgToDataUri(JACKET_SVG) },
    { id: 'jersey', name: 'Trikot', url: svgToDataUri(JERSEY_SVG) },
    { id: 'pants', name: 'Hose', url: svgToDataUri(PANTS_SVG) },
    { id: 'shorts', name: 'Kurze Hose', url: svgToDataUri(SHORTS_SVG) },
];
