import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import potrace from 'potrace';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/vector/potrace
router.post('/potrace', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

  // Potrace params
  const params = {
    threshold: 128,
    turnPolicy: 'black',
    turdSize: 2,
    alphaMax: 1,
    optCurve: true,
    optTolerance: 0.2,
    blackOnWhite: true,
    color: 'black',
    background: 'transparent'
  };

  potrace.trace(req.file.path, params, (err: any, svg: string) => {
    // Cleanup temp file
    fs.unlink(req.file!.path, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete temp file:", unlinkErr);
    });

    if (err) {
      console.error("Potrace error:", err);
      return res.status(500).json({ success: false, error: 'Vectorization failed' });
    }
    
    res.json({ success: true, svg });
  });
});

export default router;
