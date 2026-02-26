
import { Router } from 'express';
import { exec } from 'child_process';
import util from 'util';

const router = Router();
const execAsync = util.promisify(exec);

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
