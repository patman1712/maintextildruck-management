# Maintextildruck Management - Server Deployment Guide

## Voraussetzungen
- Node.js (v18 oder höher)
- NPM oder Yarn
- Ein Server (Linux/Ubuntu empfohlen)

## Schritte zur Installation

1. **Code auf den Server laden**
   Kopieren Sie den gesamten Projektordner auf Ihren Server.

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

3. **Frontend bauen**
   Dieser Schritt erstellt die optimierten Dateien für den Browser im `dist` Ordner.
   ```bash
   npm run build
   ```

4. **Server starten (Manuell)**
   Zum Testen können Sie den Server direkt starten:
   ```bash
   npm start
   ```
   Der Server läuft standardmäßig auf Port 3001 (oder 3000 wenn in `ecosystem.config.cjs` konfiguriert).

## Dauerhafter Betrieb (Produktion)

Für den produktiven Einsatz empfehlen wir **PM2**, einen Prozess-Manager für Node.js.

1. **PM2 installieren (falls nicht vorhanden)**
   ```bash
   npm install -g pm2
   ```

2. **Anwendung starten**
   Wir haben eine Konfigurationsdatei `ecosystem.config.cjs` vorbereitet.
   ```bash
   pm2 start ecosystem.config.cjs
   ```

3. **Status prüfen**
   ```bash
   pm2 status
   pm2 logs
   ```

4. **Autostart einrichten** (damit der Server nach einem Neustart wieder hochfährt)
   ```bash
   pm2 startup
   pm2 save
   ```

## Updates einspielen

Wenn Sie Änderungen am Code vornehmen:

1. Code aktualisieren (z.B. via git pull)
2. Frontend neu bauen: `npm run build`
3. Server neu starten: `pm2 restart maintextildruck-manager`

## Konfiguration

- **Port**: Standardmäßig 3000 (in `ecosystem.config.cjs` definiert).
- **Datenbank**: Die SQLite-Datenbank wird in `data/database.sqlite` gespeichert. Stellen Sie sicher, dass dieser Ordner existiert und beschreibbar ist.
- **Uploads**: Dateien werden im `uploads/` Ordner gespeichert.
