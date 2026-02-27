# Plan: Shopware Order Sync & Status Update

## Ziel
Erweiterung der "Online Aufträge" Funktionalität um bidirektionalen Status-Sync mit Shopware, korrekte Übernahme der Lieferadressen und intelligentes Artikel-Matching inklusive Druckdaten.

## 1. Backend: Shopware Order Import (`api/routes/shopware.ts`)
Der bestehende Sync (`/sync-orders`) muss überarbeitet werden.

### A. Adressdaten
*   **Aktuell:** Nutzt teilweise die Adresse des `customers` (B2B-Kunde/Agentur) als `customer_address` im Auftrag.
*   **Neu:** Muss die Lieferadresse (`shippingAddress`) aus der Shopware-Bestellung extrahieren und im Auftrag (`orders.customer_address`) speichern.
*   **Datenquelle:**
    *   Shopware 6: `order.deliveries[0].shippingOrderAddress`
    *   Shopware 5: `order.shipping` (oder fallback `billing`)

### B. Artikel-Matching & Druckdaten
*   **Ziel:** Beim Import prüfen, ob die bestellten Artikel (`lineItems`) bereits als "Online Produkte" (`customer_products` mit `source='shopware'`) beim Kunden existieren.
*   **Logik:**
    1.  Iteriere über `lineItems` der Shopware-Order.
    2.  Suche in `customer_products` nach `shopware_product_id` (oder `product_number` als Fallback).
    3.  Wenn gefunden:
        *   Prüfe `customer_product_files` dieses Produkts auf Dateien (`type='print'`).
        *   Wenn Druckdaten vorhanden sind: Kopiere diese in die `files`-Tabelle für den neuen Auftrag.
        *   **Wichtig:** Menge anpassen! Wenn Artikel 3x bestellt wurde, muss die Druckdatei-Menge auch mit 3 multipliziert werden (falls die Druckdatei eine Menge hat, z.B. "Frontlogo").
    4.  Erstelle `order_items` Einträge mit Verknüpfung zum `supplier_id` des gematchten Produkts (für spätere Warenbestellung).

## 2. Backend: Status Update (`api/routes/shopware.ts`)
Neue Route für Status-Updates.

*   **Route:** `POST /api/shopware/update-order-status`
*   **Parameter:** `orderId` (Interne ID), `status` (interner Status), `shopwareStatus` (optional, technischer Name für SW).
*   **Logik:**
    1.  Lade Auftrag & Kunde (für API-Keys).
    2.  Mappe internen Status auf Shopware-Status-Übergang.
        *   *Herausforderung:* Shopware State Machine. Man kann den Status oft nicht direkt "setzen", sondern muss eine "Transition" auslösen (z.B. `process` -> `complete`).
    3.  Sende Request an Shopware API.
    4.  Speichere Ergebnis im Auftrag (z.B. `shopware_status_synced_at`).

## 3. Frontend: Online Aufträge (`src/pages/OnlineOrders.tsx` - neu/anzupassen)
*   **Liste:** Anzeige der importierten Aufträge.
*   **Status-Änderung:** Dropdown oder Button, um den Status zu ändern.
    *   Sollte Option bieten: "Nur intern ändern" vs. "An Shopware senden".
*   **Details:** Anzeige der importierten Adressdaten und verknüpften Druckdaten.

## 4. Datenbank
*   Prüfen, ob `orders` Tabelle Spalten für Shopware-Status-Mapping hat (z.B. `shopware_order_number` existiert schon).

## Schritte
1.  **Backend Import Update:** Adressen & Artikel-Matching.
2.  **Backend Status Update:** Route implementieren.
3.  **Frontend:** UI für Online-Aufträge anpassen.
