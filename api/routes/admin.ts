
import { Router } from 'express';
import { exec } from 'child_process';
import util from 'util';
import db from '../db.js';

const router = Router();
const execAsync = util.promisify(exec);

router.post('/cleanup-product-files', (req, res) => {
    try {
        console.log('Starting cleanup of duplicate customer product files via API...');
        
        // 1. Get all customer product files
        const allFiles = db.prepare('SELECT * FROM customer_product_files').all() as any[];
        
        // 2. Group by product_id + file_url
        const groups: Record<string, any[]> = {};
        
        for (const file of allFiles) {
            const key = `${file.product_id}|${file.file_url}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(file);
        }

        // 3. Identify duplicates
        let deletedCount = 0;
        let keptCount = 0;
        const deleteStmt = db.prepare('DELETE FROM customer_product_files WHERE id = ?');

        const transaction = db.transaction(() => {
            for (const key in groups) {
                const files = groups[key];
                if (files.length > 1) {
                    // Keep the first one, remove others
                    const [keep, ...remove] = files;
                    
                    for (const fileToRemove of remove) {
                        deleteStmt.run(fileToRemove.id);
                        deletedCount++;
                    }
                    keptCount++;
                } else {
                    keptCount++;
                }
            }
        });

        transaction();

        console.log(`Cleanup complete. Kept ${keptCount}, Deleted ${deletedCount}.`);
        res.json({ success: true, message: `Cleanup complete. Deleted ${deletedCount} duplicate entries.` });
    } catch (error: any) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/changelog', async (req, res) => {
    try {
        // Get last 20 commits with hash, date, and message
        // Format: Hash|Date|Message
        const { stdout } = await execAsync('git log -n 50 --pretty=format:"%h|%ad|%s" --date=format:"%d.%m.%Y %H:%M"');
        
        const logs = stdout.split('\n').map(line => {
            const [hash, date, message] = line.split('|');
            return { hash, date, message };
        }).filter(log => log.hash); // Filter empty lines

        res.json({ success: true, logs });
    } catch (error: any) {
        console.error('Error fetching git log:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch changelog: ' + error.message });
    }
});

export default router;
