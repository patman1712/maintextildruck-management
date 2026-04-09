import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/store"

type DonationRow = {
  id: string
  shop_id: string
  shop_name: string
  order_id?: string
  order_number?: string
  order_date?: string
  item_name?: string
  item_total?: number
  quantity?: number
  donation_per_item?: number
  order_total_amount?: number
  donation_total?: number
  paid?: number
  paid_at?: string | null
}

type DonationOrder = {
  key: string
  shop_id: string
  shop_name: string
  order_id?: string
  order_number?: string
  order_date?: string
  paid: boolean
  rows: DonationRow[]
  totalQuantity: number
  totalAmount: number
  totalDonation: number
}

export default function Donations() {
  const shops = useAppStore((s) => s.shops)
  const currentUser = useAppStore((s) => s.currentUser)
  const [rows, setRows] = useState<DonationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState<string>("")
  const [showPaid, setShowPaid] = useState<boolean>(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expandedOrderKey, setExpandedOrderKey] = useState<string | null>(null)
  const [shareLinks, setShareLinks] = useState<Record<string, any>>({})
  const [sharePassword, setSharePassword] = useState<string>("")
  const [shareSaving, setShareSaving] = useState<boolean>(false)
  const [showSharePassword, setShowSharePassword] = useState<boolean>(false)

  const orders = useMemo<DonationOrder[]>(() => {
    const byKey = new Map<string, DonationOrder>()

    for (const r of rows) {
      if (shopId && r.shop_id !== shopId) continue

      const key = r.order_id || `${r.shop_id}:${r.order_number || "no"}:${r.order_date || "no"}`
      const existing = byKey.get(key)

      if (!existing) {
        byKey.set(key, {
          key,
          shop_id: r.shop_id,
          shop_name: r.shop_name,
          order_id: r.order_id,
          order_number: r.order_number,
          order_date: r.order_date,
          paid: r.paid === 1,
          rows: [r],
          totalQuantity: Number(r.quantity) || 0,
          totalAmount: Number(r.order_total_amount) || Number(r.item_total) || 0,
          totalDonation: Number(r.donation_total) || 0,
        })
      } else {
        existing.rows.push(r)
        existing.totalQuantity += Number(r.quantity) || 0
        existing.totalDonation += Number(r.donation_total) || 0
        const amountCandidate = Number(r.order_total_amount) || 0
        if (amountCandidate > existing.totalAmount) existing.totalAmount = amountCandidate
        if (!amountCandidate) existing.totalAmount += 0
        existing.paid = existing.paid && r.paid === 1
      }
    }

    const list = Array.from(byKey.values())
      .map((o) => ({
        ...o,
        totalAmount:
          o.totalAmount > 0
            ? o.totalAmount
            : o.rows.reduce((sum, rr) => sum + (Number(rr.item_total) || 0), 0),
      }))
      .filter((o) => (showPaid ? true : !o.paid))
      .sort((a, b) => {
        const ad = a.order_date ? new Date(a.order_date).getTime() : 0
        const bd = b.order_date ? new Date(b.order_date).getTime() : 0
        return bd - ad
      })

    return list
  }, [rows, shopId, showPaid])

  const totals = useMemo(() => {
    const total = orders.reduce((sum, o) => sum + (Number(o.totalDonation) || 0), 0)
    return { total }
  }, [orders])

  const fetchDonations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (shopId) params.set("shopId", shopId)
      const res = await fetch(`/api/donations?${params.toString()}`)
      const data = await res.json()
      if (data.success) setRows(data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDonations()
  }, [shopId])

  const fetchShareLinks = async () => {
    try {
      const res = await fetch("/api/donations/share-links")
      const data = await res.json()
      if (data.success) {
        const map: Record<string, any> = {}
        for (const row of data.data || []) {
          map[row.shop_id] = row
        }
        setShareLinks(map)
      }
    } catch {}
  }

  useEffect(() => {
    fetchShareLinks()
  }, [])

  useEffect(() => {
    setSharePassword("")
    setShowSharePassword(false)
    setExpandedOrderKey(null)
  }, [shopId])

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    let out = ""
    const bytes = new Uint32Array(16)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < bytes.length; i++) {
      out += chars[bytes[i] % chars.length]
    }
    return out
  }

  const updateShareLink = async (payload: any) => {
    if (!shopId) return
    setShareSaving(true)
    try {
      const res = await fetch(`/api/donations/share-links/${shopId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        await fetchShareLinks()
        if (payload.password !== undefined) setSharePassword("")
      } else {
        alert(data.error || "Fehler")
      }
    } finally {
      setShareSaving(false)
    }
  }

  const toggleOrderPaid = async (order: DonationOrder) => {
    if (!order.order_id) return
    setSavingId(order.key)
    try {
      const paid = !order.paid
      const res = await fetch(`/api/donations/order/${order.order_id}/paid`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid, paidBy: currentUser?.name || null }),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        const updated = new Map<string, any>()
        for (const r of data.data) updated.set(r.id, r)
        setRows((prev) => prev.map((r) => (updated.has(r.id) ? { ...r, ...updated.get(r.id) } : r)))
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Spenden (Alle Shops)</h1>
          <p className="text-sm text-slate-500">Bestellungen mit Spendenanteil je Artikel</p>
        </div>
        <button
          onClick={fetchDonations}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
        >
          Aktualisieren
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Shop</label>
          <select
            className="w-full border border-slate-300 rounded-lg p-2"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
          >
            <option value="">Alle Shops</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-3 pt-6 md:pt-0">
          <input
            id="showPaid"
            type="checkbox"
            className="h-4 w-4"
            checked={showPaid}
            onChange={(e) => setShowPaid(e.target.checked)}
          />
          <label htmlFor="showPaid" className="text-sm font-medium text-slate-700">
            Bezahlte anzeigen
          </label>
        </div>

        <div className="md:ml-auto text-right">
          <div className="text-xs font-bold uppercase text-slate-400">Summe (Filter)</div>
          <div className="text-xl font-black text-slate-900">€ {totals.total.toFixed(2)}</div>
        </div>
      </div>

      {shopId && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-slate-400">Externer Zugriff</div>
              <div className="text-lg font-black text-slate-900">{shops.find((s) => s.id === shopId)?.name || "Shop"}</div>
              <div className="text-sm text-slate-500">Link für den Shopbetreiber (nur Übersicht, keine Bearbeitung)</div>
            </div>
            <div className="flex items-center gap-2">
              {!shareLinks[shopId]?.token ? (
                <button
                  onClick={() => updateShareLink({ enabled: true, regenerate: true })}
                  disabled={shareSaving}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  Link erstellen
                </button>
              ) : (
                <>
                  <button
                    onClick={() => updateShareLink({ regenerate: true })}
                    disabled={shareSaving}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Link neu
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Link wirklich löschen?")) return
                      setShareSaving(true)
                      try {
                        const res = await fetch(`/api/donations/share-links/${shopId}`, { method: "DELETE" })
                        const data = await res.json()
                        if (data.success) await fetchShareLinks()
                        else alert(data.error || "Fehler")
                      } finally {
                        setShareSaving(false)
                      }
                    }}
                    disabled={shareSaving}
                    className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 disabled:opacity-60"
                  >
                    Löschen
                  </button>
                </>
              )}
            </div>
          </div>

          {shareLinks[shopId]?.token && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Link</label>
                <div className="flex gap-2">
                  <input
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                    readOnly
                    value={`${window.location.origin}/donations/${shareLinks[shopId].token}`}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}/donations/${shareLinks[shopId].token}`)
                      } catch {
                        alert("Kopieren nicht möglich.")
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
                  >
                    Kopieren
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <select
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    value={shareLinks[shopId]?.enabled === 0 ? "off" : "on"}
                    onChange={(e) => updateShareLink({ enabled: e.target.value === "on" })}
                    disabled={shareSaving}
                  >
                    <option value="on">Aktiv</option>
                    <option value="off">Deaktiviert</option>
                  </select>
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Passwort (optional)</label>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type={showSharePassword ? "text" : "password"}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    placeholder={shareLinks[shopId]?.has_password ? "Passwort ändern…" : "Passwort setzen…"}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    disabled={shareSaving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSharePassword((v) => !v)}
                    disabled={shareSaving}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    {showSharePassword ? "Verbergen" : "Anzeigen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pw = generatePassword()
                      setSharePassword(pw)
                      setShowSharePassword(true)
                      try {
                        navigator.clipboard.writeText(pw)
                      } catch {}
                    }}
                    disabled={shareSaving}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Generieren
                  </button>
                  <button
                    onClick={() => updateShareLink({ password: sharePassword })}
                    disabled={shareSaving}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-60"
                  >
                    Speichern
                  </button>
                  {shareLinks[shopId]?.has_password ? (
                    <button
                      onClick={() => updateShareLink({ password: "" })}
                      disabled={shareSaving}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      Entfernen
                    </button>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {shareLinks[shopId]?.has_password ? "Passwortschutz aktiv." : "Kein Passwortschutz."}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400">
          <div className="col-span-2">Datum</div>
          <div className="col-span-2">Bestellnr.</div>
          <div className="col-span-3">Shop</div>
          <div className="col-span-2 text-right">Artikel</div>
          <div className="col-span-1 text-right">Summe</div>
          <div className="col-span-2 text-right">Spende</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">Lade Spenden...</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Keine Spenden gefunden.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((o) => {
              const isExpanded = expandedOrderKey === o.key
              return (
                <div key={o.key}>
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                    <div className="col-span-2 text-sm text-slate-700">
                      {o.order_date ? new Date(o.order_date).toLocaleDateString("de-DE") : "-"}
                    </div>
                    <div className="col-span-2 text-sm font-mono text-slate-600">{o.order_number || "-"}</div>
                    <div className="col-span-3 text-sm text-slate-800">{o.shop_name}</div>
                    <div className="col-span-2 text-sm text-slate-800 text-right">
                      <span className="font-bold">{o.totalQuantity}</span>
                    </div>
                    <div className="col-span-1 text-sm font-bold text-slate-800 text-right">
                      € {(Number(o.totalAmount) || 0).toFixed(2)}
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-sm font-black text-slate-900">€ {(Number(o.totalDonation) || 0).toFixed(2)}</div>
                      <div className="mt-1 flex justify-end gap-2">
                        <button
                          onClick={() => setExpandedOrderKey((prev) => (prev === o.key ? null : o.key))}
                          className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        >
                          {isExpanded ? "Details zu" : "Details"}
                        </button>
                        {o.order_id ? (
                          <button
                            onClick={() => toggleOrderPaid(o)}
                            disabled={savingId === o.key}
                            className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                              o.paid ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            } ${savingId === o.key ? "opacity-60" : ""}`}
                          >
                            {o.paid ? "Bezahlt" : "Offen"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                      <div className="grid grid-cols-12 gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 pb-2">
                        <div className="col-span-6">Artikel</div>
                        <div className="col-span-2 text-right">Anzahl</div>
                        <div className="col-span-2 text-right">Artikelpreis</div>
                        <div className="col-span-2 text-right">Spende</div>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {o.rows.map((r) => (
                          <div key={r.id} className="grid grid-cols-12 gap-2 py-2 items-center">
                            <div className="col-span-6 text-sm text-slate-800 font-semibold">{r.item_name || "-"}</div>
                            <div className="col-span-2 text-sm text-slate-700 text-right">{Number(r.quantity) || 0}</div>
                            <div className="col-span-2 text-sm text-slate-700 text-right">€ {(Number(r.item_total) || 0).toFixed(2)}</div>
                            <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(r.donation_total) || 0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
