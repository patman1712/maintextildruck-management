import { Router } from 'express'
import db from '../db.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const router = Router()

router.get('/share-links', (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT s.id as shop_id, s.name as shop_name, l.token, l.enabled, l.created_at, l.updated_at,
               CASE WHEN l.password_hash IS NOT NULL AND l.password_hash != '' THEN 1 ELSE 0 END as has_password
        FROM shops s
        LEFT JOIN shop_donation_share_links l ON l.shop_id = s.id
        ORDER BY s.name ASC
      `
      )
      .all() as any[]

    res.json({ success: true, data: rows })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/share-links/:shopId', (req, res) => {
  try {
    const { shopId } = req.params
    const enable = req.body?.enabled
    const regenerate = !!req.body?.regenerate
    const password = typeof req.body?.password === 'string' ? req.body.password : undefined

    const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId) as any
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' })

    const existing = db.prepare('SELECT * FROM shop_donation_share_links WHERE shop_id = ?').get(shopId) as any
    const now = new Date().toISOString()

    let nextEnabled: number | undefined = undefined
    if (typeof enable === 'boolean') nextEnabled = enable ? 1 : 0

    let nextToken: string | undefined = undefined
    if (!existing || regenerate) nextToken = crypto.randomBytes(24).toString('hex')

    let nextPasswordHash: string | null | undefined = undefined
    if (password !== undefined) {
      const trimmed = password.trim()
      nextPasswordHash = trimmed ? bcrypt.hashSync(trimmed, 10) : null
    }

    if (!existing) {
      const id = crypto.randomUUID()
      const token = nextToken || crypto.randomBytes(24).toString('hex')
      const enabled = nextEnabled !== undefined ? nextEnabled : 1
      const passwordHashToStore = nextPasswordHash === undefined ? null : nextPasswordHash

      db.prepare(
        `
        INSERT INTO shop_donation_share_links (id, shop_id, token, enabled, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(id, shopId, token, enabled, passwordHashToStore, now, now)
    } else {
      const fields: string[] = []
      const params: any[] = []
      if (nextEnabled !== undefined) {
        fields.push('enabled = ?')
        params.push(nextEnabled)
      }
      if (nextToken !== undefined) {
        fields.push('token = ?')
        params.push(nextToken)
      }
      if (nextPasswordHash !== undefined) {
        fields.push('password_hash = ?')
        params.push(nextPasswordHash)
      }

      fields.push('updated_at = ?')
      params.push(now)
      params.push(shopId)

      db.prepare(`UPDATE shop_donation_share_links SET ${fields.join(', ')} WHERE shop_id = ?`).run(...params)
    }

    const row = db
      .prepare(
        `
        SELECT shop_id, token, enabled, created_at, updated_at,
               CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END as has_password
        FROM shop_donation_share_links
        WHERE shop_id = ?
      `
      )
      .get(shopId)

    res.json({ success: true, data: row })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/share-links/:shopId', (req, res) => {
  try {
    const { shopId } = req.params
    db.prepare('DELETE FROM shop_donation_share_links WHERE shop_id = ?').run(shopId)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/public/:token', (req, res) => {
  try {
    const { token } = req.params
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const link = db
      .prepare(
        `
        SELECT l.shop_id, l.enabled, l.password_hash, s.name as shop_name, s.logo_url as shop_logo_url
        FROM shop_donation_share_links l
        JOIN shops s ON s.id = l.shop_id
        WHERE l.token = ?
      `
      )
      .get(token) as any

    if (!link) return res.status(404).json({ success: false, error: 'Link ungültig.' })
    if (!link.enabled) return res.status(403).json({ success: false, error: 'Link deaktiviert.' })

    const hasPassword = !!(link.password_hash && String(link.password_hash).trim())
    if (hasPassword) {
      const ok = bcrypt.compareSync(password || '', link.password_hash)
      if (!ok) return res.json({ success: false, requiresPassword: true })
    }

    const sql = `
      SELECT
        sd.*,
        s.name as shop_name
      FROM shop_donations sd
      JOIN shops s ON s.id = sd.shop_id
      WHERE sd.shop_id = ?
      ORDER BY sd.order_date DESC, sd.created_at DESC
    `

    const rows = db.prepare(sql).all(link.shop_id)
    res.json({ success: true, data: { shopId: link.shop_id, shopName: link.shop_name, shopLogoUrl: link.shop_logo_url, rows } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

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

router.put('/order/:orderId/paid', (req, res) => {
  try {
    const { orderId } = req.params
    const paid = !!req.body?.paid
    const paidBy = typeof req.body?.paidBy === 'string' ? req.body.paidBy : null

    if (paid) {
      db.prepare('UPDATE shop_donations SET paid = 1, paid_at = CURRENT_TIMESTAMP, paid_by = ? WHERE order_id = ?').run(paidBy, orderId)
    } else {
      db.prepare('UPDATE shop_donations SET paid = 0, paid_at = NULL, paid_by = NULL WHERE order_id = ?').run(orderId)
    }

    const rows = db.prepare('SELECT * FROM shop_donations WHERE order_id = ?').all(orderId)
    res.json({ success: true, data: rows })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
