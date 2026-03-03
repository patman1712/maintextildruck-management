
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const router = Router();

// Get all variables
router.get('/', (req, res) => {
  try {
    const variables = db.prepare(`
      SELECT v.id, v.name, v.type, v.variable_values as "values", v.created_at, 
      (SELECT json_group_array(shop_id) FROM shop_variable_assignments WHERE variable_id = v.id) as assigned_shop_ids
      FROM product_variables v 
      ORDER BY v.created_at DESC
    `).all();
    
    // Parse assigned_shop_ids from JSON string to array
    const data = variables.map((v: any) => ({
        ...v,
        assigned_shop_ids: v.assigned_shop_ids ? JSON.parse(v.assigned_shop_ids) : []
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create variable
router.post('/', (req, res) => {
  try {
    const { name, type, values, shop_ids } = req.body;
    
    if (!name || !type || !values) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const id = crypto.randomUUID();
    
    // Values: If array, join or stringify. If string, keep.
    // Ideally we store as string for simplicity if it's comma separated sizes, 
    // or JSON string if it's complex (like colors with hex codes).
    // For now, let's assume it's a string (e.g. "S, M, L" or "#fff|#000").
    // The frontend will handle formatting.
    const valuesStr = Array.isArray(values) ? values.join(',') : values;

    db.prepare(`
      INSERT INTO product_variables (id, name, type, variable_values)
      VALUES (?, ?, ?, ?)
    `).run(id, name, type, valuesStr);

    // Assign to shops
    if (shop_ids && Array.isArray(shop_ids)) {
        const insert = db.prepare('INSERT INTO shop_variable_assignments (id, shop_id, variable_id) VALUES (?, ?, ?)');
        for (const shopId of shop_ids) {
            insert.run(crypto.randomUUID(), shopId, id);
        }
    }

    const variable = db.prepare('SELECT id, name, type, variable_values as "values", created_at FROM product_variables WHERE id = ?').get(id);
    res.json({ success: true, data: variable });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update variable
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, values, shop_ids } = req.body;

    const valuesStr = Array.isArray(values) ? values.join(',') : values;

    db.prepare(`
      UPDATE product_variables 
      SET name = ?, type = ?, variable_values = ?
      WHERE id = ?
    `).run(name, type, valuesStr, id);

    // Update assignments
    if (shop_ids && Array.isArray(shop_ids)) {
        // Delete old
        db.prepare('DELETE FROM shop_variable_assignments WHERE variable_id = ?').run(id);
        
        // Insert new
        const insert = db.prepare('INSERT INTO shop_variable_assignments (id, shop_id, variable_id) VALUES (?, ?, ?)');
        for (const shopId of shop_ids) {
            insert.run(crypto.randomUUID(), shopId, id);
        }
    }

    const variable = db.prepare('SELECT id, name, type, variable_values as "values", created_at FROM product_variables WHERE id = ?').get(id);
    res.json({ success: true, data: variable });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete variable
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM product_variables WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get variables available for a specific shop
router.get('/shop/:shopId', (req, res) => {
    try {
        const { shopId } = req.params;
        const variables = db.prepare(`
            SELECT v.id, v.name, v.type, v.variable_values as "values", v.created_at 
            FROM product_variables v
            JOIN shop_variable_assignments sva ON v.id = sva.variable_id
            WHERE sva.shop_id = ?
        `).all(shopId);
        res.json({ success: true, data: variables });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
