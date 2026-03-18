import { Router } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : null
    const paid = typeof req.query.paid === 'string' ? req.query.paid : null

    const where: string[] = []
    const params: any[] = []

    if (shopId) {
      where.push('sd.shop_id = ?')
      params.push(shopId)
    }

    if (paid === 'true' || paid === 'false') {
      where.push('sd.paid = ?')
      params.push(paid === 'true' ? 1 : 0)
    }

    const sql = `
      SELECT
        sd.*,
        s.name as shop_name
      FROM shop_donations sd
      JOIN shops s ON s.id = sd.shop_id
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sd.order_date DESC, sd.created_at DESC
    `

    const rows = db.prepare(sql).all(...params)
    res.json({ success: true, data: rows })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/paid', (req, res) => {
  try {
    const { id } = req.params
    const paid = !!req.body?.paid
    const paidBy = typeof req.body?.paidBy === 'string' ? req.body.paidBy : null

    if (paid) {
      db.prepare('UPDATE shop_donations SET paid = 1, paid_at = CURRENT_TIMESTAMP, paid_by = ? WHERE id = ?').run(paidBy, id)
    } else {
      db.prepare('UPDATE shop_donations SET paid = 0, paid_at = NULL, paid_by = NULL WHERE id = ?').run(id)
    }

    const row = db.prepare('SELECT * FROM shop_donations WHERE id = ?').get(id)
    res.json({ success: true, data: row })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
