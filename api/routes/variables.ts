
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const router = Router();

// Get all variables
router.get('/', (req, res) => {
  try {
    const variables = db.prepare(`
      SELECT v.id, v.name, v.type, v.variable_values as "values", v.price_per_value, v.variable_prices, v.created_at, 
      (SELECT json_group_array(shop_id) FROM shop_variable_assignments WHERE variable_id = v.id) as assigned_shop_ids
      FROM product_variables v 
      ORDER BY v.created_at DESC
    `).all();
    
    // Parse assigned_shop_ids and variable_prices
    const data = variables.map((v: any) => ({
        ...v,
        assigned_shop_ids: v.assigned_shop_ids ? JSON.parse(v.assigned_shop_ids) : [],
        variable_prices: v.variable_prices ? JSON.parse(v.variable_prices) : {}
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create variable
router.post('/', (req, res) => {
  try {
    const { name, type, values, shop_ids, price_per_value, variable_prices } = req.body;
    
    if (!name || !type || !values) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const id = crypto.randomUUID();
    const valuesStr = Array.isArray(values) ? values.join(',') : values;
    const pricesStr = variable_prices ? JSON.stringify(variable_prices) : null;

    db.prepare(`
      INSERT INTO product_variables (id, name, type, variable_values, price_per_value, variable_prices)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, type, valuesStr, price_per_value ? 1 : 0, pricesStr);

    // Assign to shops
    if (shop_ids && Array.isArray(shop_ids)) {
        const insert = db.prepare('INSERT INTO shop_variable_assignments (id, shop_id, variable_id) VALUES (?, ?, ?)');
        for (const shopId of shop_ids) {
            insert.run(crypto.randomUUID(), shopId, id);
        }
    }

    const variable = db.prepare('SELECT id, name, type, variable_values as "values", price_per_value, variable_prices, created_at FROM product_variables WHERE id = ?').get(id);
    res.json({ success: true, data: variable });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update variable
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, values, shop_ids, price_per_value, variable_prices } = req.body;

    const valuesStr = Array.isArray(values) ? values.join(',') : values;
    const pricesStr = variable_prices ? JSON.stringify(variable_prices) : null;

    db.prepare(`
      UPDATE product_variables 
      SET name = ?, type = ?, variable_values = ?, price_per_value = ?, variable_prices = ?
      WHERE id = ?
    `).run(name, type, valuesStr, price_per_value ? 1 : 0, pricesStr, id);

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

    const variable = db.prepare('SELECT id, name, type, variable_values as "values", price_per_value, variable_prices, created_at FROM product_variables WHERE id = ?').get(id);
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
            SELECT v.id, v.name, v.type, v.variable_values as "values", v.price_per_value, v.variable_prices, v.created_at 
            FROM product_variables v
            JOIN shop_variable_assignments sva ON v.id = sva.variable_id
            WHERE sva.shop_id = ?
        `).all(shopId);
        
        const data = variables.map((v: any) => ({
            ...v,
            variable_prices: v.variable_prices ? JSON.parse(v.variable_prices) : {}
        }));

        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
