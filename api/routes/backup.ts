import { Router } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { DATA_DIR } from '../db.js';

const execAsync = promisify(exec);
const router = Router();

router.get('/download', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.tar.gz`;
        const tmpDir = os.tmpdir();
        const outputPath = path.join(tmpDir, filename);

        // DATA_DIR is the folder we want to backup (contains uploads, db, downloads)
        // We want to archive the folder itself relative to its parent
        const parentDir = path.dirname(DATA_DIR);
        const dirName = path.basename(DATA_DIR);

        // Command: tar -czf output.tar.gz -C parent data
        const cmd = `tar -czf "${outputPath}" -C "${parentDir}" "${dirName}"`;
        
        console.log('Creating backup with command:', cmd);
        await execAsync(cmd);

        res.download(outputPath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Cleanup temp file
            fs.unlink(outputPath).catch(e => console.error('Cleanup error:', e));
        });

    } catch (error: any) {
        console.error('Backup failed:', error);
        res.status(500).json({ success: false, error: 'Backup creation failed: ' + error.message });
    }
});

export default router;
