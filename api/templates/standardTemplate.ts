/**
 * Standard-Vorlage für Custom-Design-Templates (Warenkorb-ZIP-Download).
 *
 * Enthält die Einstiegsdatei (index.html) sowie das Stylesheet (assets/style.css).
 * Alle Platzhalter im Format {{...}} werden beim Rendern im Shop ersetzt.
 *
 * Hinweis: Die Einstiegs-HTML verweist per <link rel="stylesheet" href="assets/style.css">
 * auf das Stylesheet. Beim Upload eines ZIP-Pakets werden relative Pfade automatisch
 * auf /shop-assets/<shopId>/ aufgelöst.
 */

export const STANDARD_TEMPLATE_ENTRY = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{shop_name}}</title>
  <link rel="stylesheet" href="assets/style.css" />
</head>
<body>

<!-- ============================================================
     LAYOUT: Rahmen für ALLE Seiten. {{content}} ist der Platzhalter
     für den jeweiligen Seiteninhalt.
     ============================================================ -->
<template data-page="layout">
  <div class="tpl-announcement">Offizieller Fanshop</div>

  <header class="tpl-header">
    <a class="tpl-brand" href="{{shop_url}}">
      {{#logo_url}}<img src="{{logo_url}}" alt="{{shop_name}}" class="tpl-logo">{{/logo_url}}
      {{^logo_url}}<span class="tpl-brand-text">{{shop_name}}</span>{{/logo_url}}
    </a>
    <nav class="tpl-nav">
      <a href="{{shop_url}}">Start</a>
      {{#categories}}<a href="{{url}}">{{name}}</a>{{/categories}}
      <a href="{{shop_url}}/cart">Warenkorb ({{cart_count}})</a>
    </nav>
  </header>

  <main class="tpl-main">
    {{content}}
  </main>

  <footer class="tpl-footer">
    <div class="tpl-footer-grid">
      <div>
        <h4>{{shop_name}}</h4>
        {{#contact_phone}}<p>Tel: {{contact_phone}}</p>{{/contact_phone}}
        {{#opening_hours}}<p>{{opening_hours}}</p>{{/opening_hours}}
        {{#contact_email}}<p>{{contact_email}}</p>{{/contact_email}}
      </div>
      <div>
        <h4>Information</h4>
        <a href="{{shop_url}}/page/impressum">Impressum</a>
        <a href="{{shop_url}}/page/datenschutz">Datenschutz</a>
        <a href="{{shop_url}}/page/ueber-uns">Über uns</a>
      </div>
      <div>
        <h4>Service</h4>
        <a href="{{shop_url}}/page/kontakt">Kontakt</a>
        <a href="{{shop_url}}/page/widerrufsrecht">Widerrufsrecht</a>
        <a href="{{shop_url}}/page/versand">Versand &amp; Zahlung</a>
        <a href="{{shop_url}}/page/agb">AGB</a>
      </div>
    </div>
    <p class="tpl-copy">{{shop_name}} &copy; {{year}} – Alle Preise inkl. gesetzl. MwSt.</p>
  </footer>
</template>

<!-- ============================================================
     STARTSEITE
     ============================================================ -->
<template data-page="home">
  <section class="tpl-hero">
    <h1>{{shop_name}}</h1>
    {{#welcome_text}}<p>{{welcome_text}}</p>{{/welcome_text}}
  </section>

  <section class="tpl-section">
    <h2>Unsere Produkte</h2>
    <div class="tpl-grid">
      {{#products}}
        <a class="tpl-card" href="{{url}}">
          {{#image}}<img src="{{image}}" alt="{{name}}" loading="lazy">{{/image}}
          <h3>{{name}}</h3>
          <span class="tpl-price">{{price}} €</span>
        </a>
      {{/products}}
    </div>
  </section>
</template>

<!-- ============================================================
     KATEGORIESEITE
     ============================================================ -->
<template data-page="category">
  <section class="tpl-section">
    <h1>{{category_name}}</h1>
    <div class="tpl-grid">
      {{#products}}
        <a class="tpl-card" href="{{url}}">
          {{#image}}<img src="{{image}}" alt="{{name}}" loading="lazy">{{/image}}
          <h3>{{name}}</h3>
          <span class="tpl-price">{{price}} €</span>
        </a>
      {{/products}}
    </div>
  </section>
</template>

<!-- ============================================================
     PRODUKTSEITE – {{content}} bleibt erhalten (Auswahl, Preise, Warenkorb)
     ============================================================ -->
<template data-page="product">
  <section class="tpl-section">
    {{content}}
  </section>
</template>

<!-- ============================================================
     WARENKORB – {{content}} MUSS erhalten bleiben (Warenkorb-Logik)
     ============================================================ -->
<template data-page="cart">
  <section class="tpl-section">
    <h1>Warenkorb</h1>
    {{content}}
  </section>
</template>

<!-- ============================================================
     CHECKOUT – {{content}} MUSS erhalten bleiben (Bestell-/PayPal-Logik)
     ============================================================ -->
<template data-page="checkout">
  <section class="tpl-section">
    {{content}}
  </section>
</template>

<!-- ============================================================
     RECHTS-/INHALTSSEITEN (Impressum, Datenschutz, Über uns, Kontakt, …)
     ============================================================ -->
<template data-page="content">
  <section class="tpl-section tpl-narrow">
    <h1>{{content_title}}</h1>
    {{{content_body}}}
  </section>
</template>

</body>
</html>
`;

export const STANDARD_TEMPLATE_CSS = `:root {
  --tpl-primary: {{primary_color}};
  --tpl-secondary: {{secondary_color}};
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #0f172a;
  background: #ffffff;
}

img { max-width: 100%; display: block; }

/* ---------- Announcement ---------- */
.tpl-announcement {
  background: var(--tpl-primary);
  color: var(--tpl-secondary);
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 8px 16px;
}

/* ---------- Header ---------- */
.tpl-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 24px;
  height: 80px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.tpl-brand { display: flex; align-items: center; text-decoration: none; }
.tpl-logo { height: 48px; width: auto; object-fit: contain; }
.tpl-brand-text {
  font-size: 24px;
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  color: var(--tpl-primary);
}

.tpl-nav { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
.tpl-nav a {
  color: #334155;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.tpl-nav a:hover { color: var(--tpl-primary); }

/* ---------- Layout ---------- */
.tpl-main { flex: 1; }

.tpl-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px 24px;
}
.tpl-narrow { max-width: 900px; }

.tpl-section h1 { font-size: 34px; font-weight: 900; margin: 0 0 28px; }
.tpl-section h2 { font-size: 26px; font-weight: 800; margin: 0 0 28px; }

/* ---------- Hero ---------- */
.tpl-hero {
  padding: 88px 24px;
  text-align: center;
  color: var(--tpl-secondary);
  background: linear-gradient(135deg, var(--tpl-primary), #0f172a);
}
.tpl-hero h1 {
  margin: 0 0 14px;
  font-size: 48px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.03em;
}
.tpl-hero p { margin: 0; font-size: 18px; opacity: 0.9; }

/* ---------- Produkt-Raster ---------- */
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px;
}

.tpl-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.tpl-card:hover {
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  transform: translateY(-3px);
}
.tpl-card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  background: #f8fafc;
  border-radius: 10px;
}
.tpl-card h3 { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.35; }
.tpl-price { font-size: 16px; font-weight: 900; }

/* ---------- Footer ---------- */
.tpl-footer {
  background: var(--tpl-primary);
  color: var(--tpl-secondary);
  padding: 48px 24px 24px;
  margin-top: 64px;
}
.tpl-footer-grid {
  max-width: 1200px;
  margin: 0 auto 32px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 32px;
}
.tpl-footer h4 {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.tpl-footer p { margin: 0 0 8px; font-size: 14px; opacity: 0.9; }
.tpl-footer a {
  display: block;
  color: inherit;
  text-decoration: none;
  font-size: 14px;
  padding: 3px 0;
  opacity: 0.9;
}
.tpl-footer a:hover { opacity: 1; text-decoration: underline; }
.tpl-copy {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  font-size: 12px;
  opacity: 0.85;
  text-align: center;
}

/* ---------- Mobil ---------- */
@media (max-width: 768px) {
  .tpl-header { height: auto; padding: 12px 16px; flex-direction: column; gap: 12px; }
  .tpl-nav { justify-content: center; gap: 14px; }
  .tpl-hero { padding: 56px 20px; }
  .tpl-hero h1 { font-size: 32px; }
  .tpl-section { padding: 36px 16px; }
}
`;

export const STANDARD_TEMPLATE_README = `Standard-Vorlage für ein Custom-Design-Template
===============================================

Inhalt:
  index.html          -> Einstiegsdatei mit den Seiten-Blöcken <template data-page="...">
  assets/style.css    -> Stylesheet (wird per <link rel="stylesheet"> eingebunden)
  README.txt          -> diese Datei

Vorgehen:
  1. Diese Dateien bearbeiten (HTML/CSS, Bilder/Fonts dürfen ergänzt werden).
  2. Alles wieder als ZIP packen (index.html muss im Wurzelverzeichnis liegen).
  3. Im Shop-Dashboard unter "Design" -> "ZIP-Paket hochladen".
  4. Toggle auf "Custom Design aktiv" stellen und speichern.

Seiten-Blöcke (<template data-page="NAME">):
  layout    Rahmen für ALLE Seiten – muss {{content}} enthalten
  home      Startseite
  category  Kategorieseite
  product   Produktseite
  cart      Warenkorb
  checkout  Kasse
  content   Rechts-/Inhaltsseiten (Impressum, Datenschutz, ...)

Platzhalter:
  Einfacher Wert (HTML-sicher):  {{shop_name}}
  Roh-Wert (HTML erlaubt):       {{{content_body}}}
  Schleife:                      {{#products}} ... {{/products}}
  Invertierte Bedingung:         {{^logo_url}} ... {{/logo_url}}
  Standard-Inhalt der Seite:     {{content}}
  Fertiges Widget:               {{widget:products}}

Globale Werte:
  {{shop_name}} {{logo_url}} {{footer_logo_url}} {{shop_url}} {{asset_base}}
  {{primary_color}} {{secondary_color}} {{year}} {{cart_count}}
  {{welcome_text}} {{contact_phone}} {{contact_email}} {{contact_address}} {{opening_hours}}
  {{social_instagram}} {{social_tiktok}} {{social_whatsapp}}

Listen:
  {{#categories}} -> {{name}} {{url}}
  {{#products}}   -> {{name}} {{price}} {{url}} {{image}} {{product_number}}
  {{#cart_items}} -> {{name}} {{price}} {{quantity}} {{image}} {{size}} {{color}}

Inhaltsseiten:
  {{content_title}}  Titel der Seite (z.B. "Impressum")
  {{{content_body}}}  Inhalt als HTML

Wichtig:
  - {{content}} in cart/checkout/product MUSS erhalten bleiben, sonst funktionieren
    Warenkorb, Bestellung und Zahlung nicht.
  - JavaScript wird NICHT ausgeführt. Bitte kein JS verwenden.
  - Bilder/Fonts im ZIP werden automatisch unter /shop-assets/... ausgeliefert.
    Relative Pfade wie "assets/bild.png" funktionieren direkt.
  - Erlaubte Dateitypen: html, css, svg, png, jpg, jpeg, webp, gif, ico,
    woff, woff2, ttf, otf, eot, json, txt, md.
  - Wenn das Template deaktiviert, leer oder fehlerhaft ist, zeigt der Shop
    automatisch wieder das Standard-Design.
`;
