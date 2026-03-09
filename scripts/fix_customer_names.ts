import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad zur Datenbank (angepasst an Projektstruktur)
const DATA_DIR = path.join(process.cwd(), 'data');
const dbPath = path.join(DATA_DIR, 'database.sqlite');

console.log(`Öffne Datenbank: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error('Datenbank nicht gefunden!');
    process.exit(1);
}

const db = new Database(dbPath);

console.log('Liste alle Kunden auf:');

// Hole alle Kunden
const customers = db.prepare('SELECT id, email, first_name, last_name FROM shop_customers').all() as any[];

console.log(`Gefunden: ${customers.length} Einträge.`);

const updateStmt = db.prepare('UPDATE shop_customers SET first_name = ?, last_name = ? WHERE id = ?');

db.transaction(() => {
    for (const customer of customers) {
        console.log(`Kunde [${customer.email}]: '${customer.first_name}' '${customer.last_name}'`);
        
        let changed = false;
        let newFirst = customer.first_name || '';
        let newLast = customer.last_name || '';

        // Prüfe First Name (alle Zahlen am Ende weg)
        if (newFirst.toString().endsWith('0')) {
             console.log(`--> Korrigiere Vorname von '${newFirst}' zu '${newFirst.slice(0, -1)}'`);
             newFirst = newFirst.slice(0, -1);
             changed = true;
        }

        // Prüfe Last Name
        if (newLast.toString().endsWith('0')) {
             console.log(`--> Korrigiere Nachname von '${newLast}' zu '${newLast.slice(0, -1)}'`);
             newLast = newLast.slice(0, -1);
             changed = true;
        }
        
        // Härterer Fix: Versuche auch " 0" (Leerzeichen + 0)
        if (newLast.toString().endsWith(' 0')) {
             console.log(`--> Korrigiere Nachname von '${newLast}' zu '${newLast.slice(0, -2)}'`);
             newLast = newLast.slice(0, -2);
             changed = true;
        }

        if (changed) {
            updateStmt.run(newFirst, newLast, customer.id);
            console.log("UPDATE ausgeführt.");
        }
    }
})();

console.log(`Fertig.`);
