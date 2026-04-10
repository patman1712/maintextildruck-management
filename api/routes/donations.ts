import { Router } from 'express'
import db from '../db.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const router = Router()

router.get('/payments', (req, res) => {
  try {
    const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : null

    const where: string[] = []
    const params: any[] = []
    if (shopId) {
      where.push('p.shop_id = ?')
      params.push(shopId)
    }

    const rows = db
      .prepare(
        `
        SELECT p.*, s.name as shop_name
        FROM donation_payments p
        JOIN shops s ON s.id = p.shop_id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY datetime(p.paid_at) DESC, datetime(p.created_at) DESC
      `
      )
      .all(...params) as any[]

    const data = rows.map((r) => ({
      ...r,
      order_ids: r.order_ids_json ? JSON.parse(r.order_ids_json) : [],
    }))

    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/payments/:id', (req, res) => {
  try {
    const { id } = req.params
    const payment = db
      .prepare(
        `
        SELECT p.*, s.name as shop_name
        FROM donation_payments p
        JOIN shops s ON s.id = p.shop_id
        WHERE p.id = ?
      `
      )
      .get(id) as any

    if (!payment) return res.status(404).json({ success: false, error: 'Nicht gefunden.' })

    const orders = db
      .prepare(
        `
        SELECT
          sd.order_id,
          MAX(sd.order_number) as order_number,
          MAX(sd.order_date) as order_date,
          SUM(sd.quantity) as total_quantity,
          SUM(sd.item_total) as total_amount,
          SUM(sd.donation_total) as total_donation,
          MIN(sd.paid) as paid
        FROM shop_donations sd
        WHERE sd.payment_id = ?
        GROUP BY sd.order_id
        ORDER BY datetime(order_date) DESC
      `
      )
      .all(id)

    res.json({
      success: true,
      data: {
        ...payment,
        order_ids: payment.order_ids_json ? JSON.parse(payment.order_ids_json) : [],
        orders,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/payments', (req, res) => {
  try {
    const shopId = typeof req.body?.shopId === 'string' ? req.body.shopId : ''
    const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds.filter((x: any) => typeof x === 'string') : []
    const paidBy = typeof req.body?.paidBy === 'string' ? req.body.paidBy : null

    if (!shopId) return res.status(400).json({ success: false, error: 'Shop fehlt.' })
    if (!orderIds || orderIds.length === 0) return res.status(400).json({ success: false, error: 'Keine Aufträge ausgewählt.' })

    const shop = db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId) as any
    if (!shop) return res.status(404).json({ success: false, error: 'Shop nicht gefunden.' })

    const placeholders = orderIds.map(() => '?').join(',')
    const checkRows = db
      .prepare(
        `
        SELECT order_id, shop_id, paid
        FROM shop_donations
        WHERE shop_id = ?
          AND order_id IN (${placeholders})
        GROUP BY order_id
      `
      )
      .all(shopId, ...orderIds) as any[]

    const found = new Set(checkRows.map((r) => r.order_id))
    const missing = orderIds.filter((id: string) => !found.has(id))
    if (missing.length > 0) return res.status(400).json({ success: false, error: 'Aufträge nicht gefunden.', missing })

    const alreadyPaid = checkRows.filter((r) => r.paid === 1).map((r) => r.order_id)
    if (alreadyPaid.length > 0) return res.status(400).json({ success: false, error: 'Einige Aufträge sind bereits bezahlt.', alreadyPaid })

    const totals = db
      .prepare(
        `
        SELECT
          COUNT(DISTINCT order_id) as total_orders,
          SUM(donation_total) as total_donation
        FROM shop_donations
        WHERE shop_id = ?
          AND order_id IN (${placeholders})
      `
      )
      .get(shopId, ...orderIds) as any

    const paymentId = crypto.randomUUID()
    const now = new Date().toISOString()

    const tx = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO donation_payments (id, shop_id, paid_at, paid_by, order_ids_json, total_orders, total_donation, receipt_received, receipt_received_at, receipt_reference, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)
      `
      ).run(
        paymentId,
        shopId,
        now,
        paidBy,
        JSON.stringify(orderIds),
        Number(totals?.total_orders) || orderIds.length,
        Number(totals?.total_donation) || 0,
        now
      )

      db.prepare(
        `
        UPDATE shop_donations
        SET paid = 1, paid_at = CURRENT_TIMESTAMP, paid_by = ?, payment_id = ?
        WHERE shop_id = ?
          AND order_id IN (${placeholders})
      `
      ).run(paidBy, paymentId, shopId, ...orderIds)
    })

    tx()

    const payment = db.prepare('SELECT * FROM donation_payments WHERE id = ?').get(paymentId) as any
    res.json({ success: true, data: { ...(payment || {}), order_ids: orderIds } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/payments/:id/receipt', (req, res) => {
  try {
    const { id } = req.params
    const received = !!req.body?.received
    const reference = typeof req.body?.reference === 'string' ? req.body.reference : null

    const existing = db.prepare('SELECT id FROM donation_payments WHERE id = ?').get(id) as any
    if (!existing) return res.status(404).json({ success: false, error: 'Nicht gefunden.' })

    if (received) {
      db.prepare(
        `
        UPDATE donation_payments
        SET receipt_received = 1, receipt_received_at = CURRENT_TIMESTAMP, receipt_reference = ?
        WHERE id = ?
      `
      ).run(reference, id)
    } else {
      db.prepare(
        `
        UPDATE donation_payments
        SET receipt_received = 0, receipt_received_at = NULL, receipt_reference = ?
        WHERE id = ?
      `
      ).run(reference, id)
    }

    const row = db.prepare('SELECT * FROM donation_payments WHERE id = ?').get(id)
    res.json({ success: true, data: row })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

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

router.get('/share-links/:shopId', (req, res) => {
  try {
    const { shopId } = req.params
    const row = db
      .prepare(
        `
        SELECT shop_id, token, enabled, created_at, updated_at,
               CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END as has_password,
               password_plain
        FROM shop_donation_share_links
        WHERE shop_id = ?
      `
      )
      .get(shopId)

    if (!row) return res.status(404).json({ success: false, error: 'Nicht gefunden.' })
    res.json({ success: true, data: row })
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
    let nextPasswordPlain: string | null | undefined = undefined
    if (password !== undefined) {
      const trimmed = password.trim()
      nextPasswordHash = trimmed ? bcrypt.hashSync(trimmed, 10) : null
      nextPasswordPlain = trimmed ? trimmed : null
    }

    if (!existing) {
      const id = crypto.randomUUID()
      const token = nextToken || crypto.randomBytes(24).toString('hex')
      const enabled = nextEnabled !== undefined ? nextEnabled : 1
      const passwordHashToStore = nextPasswordHash === undefined ? null : nextPasswordHash
      const passwordPlainToStore = nextPasswordPlain === undefined ? null : nextPasswordPlain

      db.prepare(
        `
        INSERT INTO shop_donation_share_links (id, shop_id, token, enabled, password_hash, password_plain, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(id, shopId, token, enabled, passwordHashToStore, passwordPlainToStore, now, now)
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
      if (nextPasswordPlain !== undefined) {
        fields.push('password_plain = ?')
        params.push(nextPasswordPlain)
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
               CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END as has_password,
               password_plain
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

router.post('/public/:token/payments', (req, res) => {
  try {
    const { token } = req.params
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const link = db
      .prepare(
        `
        SELECT l.shop_id, l.enabled, l.password_hash
        FROM shop_donation_share_links l
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

    const rows = db
      .prepare(
        `
        SELECT p.*, s.name as shop_name
        FROM donation_payments p
        JOIN shops s ON s.id = p.shop_id
        WHERE p.shop_id = ?
        ORDER BY datetime(p.paid_at) DESC, datetime(p.created_at) DESC
      `
      )
      .all(link.shop_id) as any[]

    const data = rows.map((r) => ({
      ...r,
      order_ids: r.order_ids_json ? JSON.parse(r.order_ids_json) : [],
    }))

    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/public/:token/payments/:paymentId', (req, res) => {
  try {
    const { token, paymentId } = req.params
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const link = db
      .prepare(
        `
        SELECT l.shop_id, l.enabled, l.password_hash
        FROM shop_donation_share_links l
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

    const payment = db.prepare('SELECT * FROM donation_payments WHERE id = ? AND shop_id = ?').get(paymentId, link.shop_id) as any
    if (!payment) return res.status(404).json({ success: false, error: 'Nicht gefunden.' })

    const orders = db
      .prepare(
        `
        SELECT
          sd.order_id,
          MAX(sd.order_number) as order_number,
          MAX(sd.order_date) as order_date,
          SUM(sd.quantity) as total_quantity,
          SUM(sd.item_total) as total_amount,
          SUM(sd.donation_total) as total_donation,
          MIN(sd.paid) as paid
        FROM shop_donations sd
        WHERE sd.payment_id = ?
        GROUP BY sd.order_id
        ORDER BY datetime(order_date) DESC
      `
      )
      .all(paymentId)

    const items = db
      .prepare(
        `
        SELECT
          sd.order_id,
          sd.item_name,
          sd.item_number,
          sd.quantity,
          sd.item_total,
          sd.donation_per_item,
          sd.donation_total
        FROM shop_donations sd
        WHERE sd.payment_id = ?
        ORDER BY datetime(sd.order_date) DESC, sd.created_at DESC
      `
      )
      .all(paymentId)

    res.json({
      success: true,
      data: {
        ...payment,
        order_ids: payment.order_ids_json ? JSON.parse(payment.order_ids_json) : [],
        orders,
        items,
      },
    })
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

router.post('/public/:token/products', (req, res) => {
  try {
    const { token } = req.params
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const link = db
      .prepare(
        `
        SELECT l.shop_id, l.enabled, l.password_hash
        FROM shop_donation_share_links l
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

    const rows = db
      .prepare(
        `
        SELECT
          cp.product_number,
          cp.name as product_name,
          spa.price,
          COALESCE(spa.donation_amount, 0) as donation_amount
        FROM shop_product_assignments spa
        JOIN customer_products cp ON cp.id = spa.product_id
        WHERE spa.shop_id = ?
          AND (spa.is_active = 1 OR spa.is_active IS NULL)
        ORDER BY cp.product_number, cp.name
      `
      )
      .all(link.shop_id)

    res.json({ success: true, data: rows })
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
