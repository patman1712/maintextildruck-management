/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Custom Design-Template Engine
 * ---------------------------------
 * Ein Template ist eine einzelne HTML-Datei, die
 *  - <style>...</style>  (CSS, wird global eingebunden)
 *  - <template data-page="NAME"> ... </template>  (Layout-Blöcke)
 * enthalten kann.
 *
 * Verfügbare Seiten-Blöcke:
 *   layout, home, category, product, cart, checkout, content
 *
 * Platzhalter:
 *   {{shop_name}}                     einfacher Wert (HTML-escaped)
 *   {{{welcome_text}}}                Roh-Wert (HTML erlaubt)
 *   {{#products}}...{{/products}}     Schleife über eine Liste
 *   {{content}}                       Standard-Inhalt der Seite
 *   {{widget:products}}               Fertiges Widget (Produktraster)
 */

export interface ParsedTemplate {
  css: string;
  links: string[];
  blocks: Record<string, string>;
  hasBlocks: boolean;
}

/** Zerlegt das hochgeladene HTML in CSS + Seiten-Blöcke. */
export function parseTemplate(raw: string): ParsedTemplate {
  const cssParts: string[] = [];
  const links: string[] = [];
  let html = String(raw || '');

  // 1. Externe Stylesheets (<link rel="stylesheet" href="...">) einsammeln.
  //    Bei dangerouslySetInnerHTML lädt der Browser <link> nicht → wir rendern sie selbst.
  html = html.replace(/<link\b[^>]*>/gi, (tag: string) => {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) return tag;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) links.push(hrefMatch[1].trim());
    return '';
  });

  // 2. CSS extrahieren
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    cssParts.push(css);
    return '';
  });

  // 3. Doctype / html / head / body Hüllen entfernen (falls komplettes Dokument hochgeladen wurde)
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
  html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  html = html.replace(/<\/?(html|body|main)[^>]*>/gi, '');

  // 3. Seiten-Blöcke extrahieren
  const blocks: Record<string, string> = {};
  let hasBlocks = false;
  html = html.replace(
    /<template[^>]*\sdata-page\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/template>/gi,
    (_m, name: string, inner: string) => {
      hasBlocks = true;
      blocks[String(name).trim().toLowerCase()] = inner;
      return '';
    }
  );

  // Keine Blöcke definiert → das ganze File ist das Layout
  if (!hasBlocks && html.trim()) {
    blocks['layout'] = html;
    hasBlocks = false;
  }

  return { css: cssParts.join('\n'), links, blocks, hasBlocks };
}

function escapeHtml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Löst relative Asset-Pfade gegen den Asset-Basis-Pfad des Shops auf.
 * Absolute URLs, absolute Pfade, Daten-URLs und Anker bleiben unverändert.
 */
export function resolveAssetUrl(value: string, assetBase?: string): string {
  const v = String(value || '').trim();
  if (!v) return v;
  if (/^(https?:)?\/\//i.test(v)) return v;
  if (/^(data:|blob:|mailto:|tel:|#)/i.test(v)) return v;
  if (v.startsWith('/')) return v;
  if (!assetBase) return v;
  return assetBase.replace(/\/+$/, '') + '/' + v.replace(/^\.?\//, '');
}

/**
 * Ersetzt Platzhalter + Schleifen und gibt einen HTML-String zurück.
 * Widgets ({{content}}, {{widget:x}}) werden zu Marker-<div>s, in die React
 * später per Portal die fertigen Komponenten rendert.
 */
export function renderTemplateToString(
  templateHtml: string,
  context: Record<string, any>,
  assetBase?: string
): string {
  const base = assetBase !== undefined ? assetBase : (context?.asset_base || '');
  let html = String(templateHtml || '');

  // a) Widgets → Marker (vor den Skalaren, damit {{content}} nicht als Skalar gilt)
  html = html.replace(/\{\{\s*widget\s*:\s*([\w-]+)\s*\}\}/gi, (_m, name: string) => {
    return `<div data-shop-widget="${name}"></div>`;
  });
  html = html.replace(/\{\{\s*content\s*\}\}/gi, () => {
    return `<div data-shop-widget="content"></div>`;
  });

  // b) Schleifen/Bedingungen (mehrere Durchläufe für verschachtelte Listen)
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;

    // b1) Invertierte Bedingung {{^key}} ... {{/key}} (rendert, wenn leer/falsy)
    html = html.replace(/\{\{\s*\^\s*([\w-]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g, (_m, key: string, inner: string) => {
      changed = true;
      const value = context[key];
      const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
      return isEmpty ? renderTemplateToString(inner, context, base) : '';
    });

    // b2) Schleife/Bedingung {{#key}} ... {{/key}}
    html = html.replace(/\{\{\s*#\s*([\w-]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g, (_m, key: string, inner: string) => {
      const list = context[key];
      changed = true;
      if (Array.isArray(list)) {
        return list.map((item: any) => renderTemplateToString(inner, { ...context, ...item }, base)).join('');
      }
      // Nicht-Array: als Bedingung nutzen (truthy → einmal rendern, falsy → nichts)
      return list ? renderTemplateToString(inner, context, base) : '';
    });

    if (!changed) break;
  }

  // c) Roh-Werte {{{key}}}
  html = html.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_m, key: string) => {
    const value = context[key];
    return value === null || value === undefined ? '' : String(value);
  });

  // d) Werte (HTML-escaped) {{key}}
  html = html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
    return escapeHtml(context[key]);
  });

  // e) Relative Asset-Pfade (Bilder, Stylesheets) gegen /shop-assets/<shopId>/ auflösen
  if (base) {
    html = html.replace(/\b(href|src|poster|data-src)\s*=\s*"([^"]*)"/gi, (_m, attr: string, val: string) => {
      return `${attr}="${resolveAssetUrl(val, base)}"`;
    });
  }

  return html;
}

interface ShopTemplateProps {
  template: ParsedTemplate | null | undefined;
  page: string;
  context: Record<string, any>;
  widgets?: Record<string, React.ReactNode>;
  fallback?: React.ReactNode;
  /** Basis-Pfad für relative Assets, z.B. /shop-assets/<shopId>/ */
  assetBase?: string;
}

/**
 * Rendert einen Template-Block. Ist kein Block vorhanden oder schlägt das
 * Rendern fehl, wird automatisch der Standard-Inhalt (fallback) angezeigt.
 */
export function ShopTemplate({ template, page, context, widgets = {}, fallback = null, assetBase }: ShopTemplateProps) {
  const blockHtml = template?.blocks?.[page] || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({});

  const base = assetBase !== undefined ? assetBase : (context?.asset_base || '');
  const links = template?.links || [];

  const html = useMemo(() => {
    if (!blockHtml) return '';
    try {
      return renderTemplateToString(blockHtml, context || {}, base);
    } catch (e) {
      console.error('Template render error:', e);
      return '';
    }
  }, [blockHtml, context, base]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const map: Record<string, HTMLElement> = {};
    root.querySelectorAll('[data-shop-widget]').forEach((el) => {
      const name = el.getAttribute('data-shop-widget') || '';
      if (name) map[name] = el as HTMLElement;
    });
    setTargets(map);
  }, [html]);

  if (!blockHtml || !html) return <>{fallback}</>;

  return (
    <div style={{ display: 'contents' }}>
      {template?.css ? <style>{template.css}</style> : null}
      {links.map((href) => (
        <link key={href} rel="stylesheet" href={resolveAssetUrl(href, base)} />
      ))}
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
      {Object.entries(targets).map(([name, el]) =>
        widgets[name] ? createPortal(<React.Fragment key={name}>{widgets[name]}</React.Fragment>, el) : null
      )}
    </div>
  );
}

/** Basis-Kontext (global verfügbare Werte in jedem Block). */
export function buildBaseContext(shop: any, shopBaseUrl: string) {
  return {
    shop_name: shop?.name || '',
    logo_url: shop?.logo_url || '',
    footer_logo_url: shop?.footer_logo_url || '',
    asset_base: shop?.id ? `/shop-assets/${shop.id}/` : '',
    primary_color: shop?.primary_color || '#000000',
    secondary_color: shop?.secondary_color || '#ffffff',
    shop_url: shopBaseUrl || '/',
    year: String(new Date().getFullYear()),
    welcome_text: shop?.welcome_text || '',
    contact_phone: shop?.contact_phone || '',
    contact_email: shop?.contact_email || '',
    contact_address: shop?.contact_address || '',
    opening_hours: shop?.opening_hours || '',
    social_instagram: shop?.social_instagram || '',
    social_tiktok: shop?.social_tiktok || '',
    social_whatsapp: shop?.social_whatsapp || '',
  };
}

/** Beispiel-Template, das Admins als Startpunkt laden können. */
export const SAMPLE_TEMPLATE = `<!-- Custom Design-Template für den Online-Shop
     =========================================
     Aufbau:
       <style>  -> globales CSS
       <template data-page="layout">   -> Rahmen (Header/Footer) für ALLE Seiten, mit {{content}}
       <template data-page="home">     -> Startseite
       <template data-page="category"> -> Kategorieseite
       <template data-page="product">  -> Produktseite
       <template data-page="cart">     -> Warenkorb
       <template data-page="checkout"> -> Checkout

     Wichtige Platzhalter:
       {{shop_name}} {{logo_url}} {{primary_color}} {{secondary_color}} {{shop_url}} {{year}}
       {{content}}            -> Standard-Inhalt der jeweiligen Seite
       {{widget:products}}    -> Fertiges Produktraster
       {{#products}}{{name}} {{price}} {{url}} {{image}}{{/products}}  -> eigene Produktliste
       {{#categories}}{{name}} {{url}}{{/categories}}
  -->

<style>
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #0f172a; }
  .tpl-header { background: {{primary_color}}; color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
  .tpl-header a { color: #fff; text-decoration: none; font-weight: 700; margin-left: 18px; }
  .tpl-logo { height: 44px; object-fit: contain; }
  .tpl-nav { display: flex; align-items: center; }
  .tpl-hero { padding: 80px 24px; text-align: center; background: linear-gradient(135deg, {{primary_color}}, #111827); color: #fff; }
  .tpl-hero h1 { font-size: 44px; margin: 0 0 12px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
  .tpl-section { max-width: 1200px; margin: 0 auto; padding: 56px 24px; }
  .tpl-section h2 { font-size: 28px; font-weight: 800; margin-bottom: 24px; }
  .tpl-footer { background: {{primary_color}}; color: #fff; padding: 40px 24px; text-align: center; font-size: 14px; }
</style>

<template data-page="layout">
  <div class="tpl-header">
    <a href="{{shop_url}}">
      {{#logo_url}}<img src="{{logo_url}}" class="tpl-logo" alt="{{shop_name}}" />{{/logo_url}}
    </a>
    <nav class="tpl-nav">
      {{#categories}}<a href="{{url}}">{{name}}</a>{{/categories}}
      <a href="{{shop_url}}/cart">Warenkorb</a>
    </nav>
  </div>

  {{content}}

  <footer class="tpl-footer">
    <p><strong>{{shop_name}}</strong> &copy; {{year}}</p>
    {{#contact_phone}}<p>Tel: {{contact_phone}}</p>{{/contact_phone}}
    {{#contact_email}}<p>E-Mail: {{contact_email}}</p>{{/contact_email}}
  </footer>
</template>

<template data-page="home">
  <section class="tpl-hero">
    <h1>{{shop_name}}</h1>
    {{#welcome_text}}<p>{{welcome_text}}</p>{{/welcome_text}}
  </section>
  <section class="tpl-section">
    <h2>Unsere Produkte</h2>
    {{widget:products}}
  </section>
</template>

<template data-page="category">
  <section class="tpl-section">
    <h2>{{category_name}}</h2>
    {{widget:products}}
  </section>
</template>

<template data-page="product">
  <section class="tpl-section">
    {{content}}
  </section>
</template>

<template data-page="cart">
  <section class="tpl-section">
    <h2>Warenkorb</h2>
    {{content}}
  </section>
</template>

<template data-page="checkout">
  <section class="tpl-section">
    {{content}}
  </section>
</template>

<template data-page="content">
  <section class="tpl-section">
    <h2>{{content_title}}</h2>
    {{{content_body}}}
  </section>
</template>
`;
