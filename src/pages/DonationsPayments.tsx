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
  quantity?: number
  item_total?: number
  order_total_amount?: number
  donation_total?: number
  paid?: number
  paid_at?: string | null
}

type DonationOrder = {
  key: string
  shop_id: string
  shop_name: string
  order_id: string
  order_number?: string
  order_date?: string
  paid: boolean
  rows: DonationRow[]
  totalQuantity: number
  totalAmount: number
  totalDonation: number
}

type DonationPayment = {
  id: string
  shop_id: string
  shop_name: string
  paid_at: string
  paid_by?: string | null
  order_ids: string[]
  total_orders: number
  total_donation: number
  receipt_received?: number
  receipt_received_at?: string | null
  receipt_reference?: string | null
}

export default function DonationsPayments() {
  const shops = useAppStore((s) => s.shops)
  const currentUser = useAppStore((s) => s.currentUser)
  const [shopId, setShopId] = useState<string>("")
  const [rows, setRows] = useState<DonationRow[]>([])
  const [payments, setPayments] = useState<DonationPayment[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<string, boolean>>({})
  const [receiptRefDraft, setReceiptRefDraft] = useState<Record<string, string>>({})
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [expandedPaymentOrders, setExpandedPaymentOrders] = useState<any[] | null>(null)

  const orders = useMemo<DonationOrder[]>(() => {
    const by = new Map<string, DonationOrder>()
    for (const r of rows) {
      if (!r.order_id) continue
      const key = r.order_id
      const existing = by.get(key)
      if (!existing) {
        by.set(key, {
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
        existing.paid = existing.paid && r.paid === 1
      }
    }
    return Array.from(by.values())
      .filter((o) => !o.paid)
      .map((o) => ({
        ...o,
        totalAmount:
          o.totalAmount > 0
            ? o.totalAmount
            : o.rows.reduce((sum, rr) => sum + (Number(rr.item_total) || 0), 0),
      }))
      .sort((a, b) => {
        const ad = a.order_date ? new Date(a.order_date).getTime() : 0
        const bd = b.order_date ? new Date(b.order_date).getTime() : 0
        return bd - ad
      })
  }, [rows])

  const selected = useMemo(() => {
    const ids = Object.entries(selectedOrderIds)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const totalDonation = orders.reduce((sum, o) => (selectedOrderIds[o.order_id] ? sum + (Number(o.totalDonation) || 0) : sum), 0)
    return { ids, totalDonation }
  }, [selectedOrderIds, orders])

  const fetchRows = async () => {
    if (!shopId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("shopId", shopId)
      const res = await fetch(`/api/donations?${params.toString()}`)
      const data = await res.json()
      if (data.success) setRows(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  const fetchPayments = async () => {
    if (!shopId) {
      setPayments([])
      return
    }
    const params = new URLSearchParams()
    params.set("shopId", shopId)
    const res = await fetch(`/api/donations/payments?${params.toString()}`)
    const data = await res.json()
    if (data.success) setPayments(data.data || [])
  }

  useEffect(() => {
    fetchRows()
    fetchPayments()
    setSelectedOrderIds({})
    setExpandedPaymentId(null)
    setExpandedPaymentOrders(null)
  }, [shopId])

  const createPayment = async () => {
    if (!shopId) return alert("Bitte Shop auswählen.")
    if (selected.ids.length === 0) return alert("Bitte mindestens einen Auftrag auswählen.")
    if (!confirm(`Spenden für ${selected.ids.length} Aufträge als bezahlt markieren?`)) return

    setSaving(true)
    try {
      const res = await fetch("/api/donations/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, orderIds: selected.ids, paidBy: currentUser?.name || null }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || "Fehler")
        return
      }
      await fetchRows()
      await fetchPayments()
      setSelectedOrderIds({})
    } finally {
      setSaving(false)
    }
  }

  const toggleReceipt = async (payment: DonationPayment, received: boolean) => {
    setSaving(true)
    try {
      const reference = receiptRefDraft[payment.id] ?? payment.receipt_reference ?? ""
      const res = await fetch(`/api/donations/payments/${payment.id}/receipt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received, reference }),
      })
      const data = await res.json()
      if (data.success) await fetchPayments()
      else alert(data.error || "Fehler")
    } finally {
      setSaving(false)
    }
  }

  const openPaymentDetails = async (id: string) => {
    if (expandedPaymentId === id) {
      setExpandedPaymentId(null)
      setExpandedPaymentOrders(null)
      return
    }
    setExpandedPaymentId(id)
    setExpandedPaymentOrders(null)
    const res = await fetch(`/api/donations/payments/${id}`)
    const data = await res.json()
    if (data.success) setExpandedPaymentOrders(data.data.orders || [])
    else alert(data.error || "Fehler")
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Spenden bezahlen</h1>
          <p className="text-sm text-slate-500">Aufträge auswählen, als bezahlt markieren und Quittung nachtragen</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Shop</label>
          <select className="w-full border border-slate-300 rounded-lg p-2" value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">Bitte wählen…</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:ml-auto text-right">
          <div className="text-xs font-bold uppercase text-slate-400">Auswahl</div>
          <div className="text-xl font-black text-slate-900">€ {selected.totalDonation.toFixed(2)}</div>
          <button
            onClick={createPayment}
            disabled={saving || selected.ids.length === 0 || !shopId}
            className="mt-2 px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60"
          >
            Als bezahlt markieren
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
        <div className="px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400 grid grid-cols-12 gap-2">
          <div className="col-span-1"></div>
          <div className="col-span-2">Datum</div>
          <div className="col-span-3">Bestellnr.</div>
          <div className="col-span-2 text-right">Artikel</div>
          <div className="col-span-2 text-right">Summe</div>
          <div className="col-span-2 text-right">Spende</div>
        </div>
        {loading ? (
          <div className="p-10 text-center text-slate-400">Lade...</div>
        ) : !shopId ? (
          <div className="p-10 text-center text-slate-400">Bitte Shop auswählen.</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Keine offenen Spenden-Aufträge.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((o) => (
              <div key={o.order_id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!selectedOrderIds[o.order_id]}
                    onChange={(e) => setSelectedOrderIds((prev) => ({ ...prev, [o.order_id]: e.target.checked }))}
                  />
                </div>
                <div className="col-span-2 text-sm text-slate-700">{o.order_date ? new Date(o.order_date).toLocaleDateString("de-DE") : "-"}</div>
                <div className="col-span-3 text-sm font-mono text-slate-600">{o.order_number || "-"}</div>
                <div className="col-span-2 text-sm text-slate-800 text-right">
                  <span className="font-bold">{o.totalQuantity}</span>
                </div>
                <div className="col-span-2 text-sm font-bold text-slate-800 text-right">€ {(Number(o.totalAmount) || 0).toFixed(2)}</div>
                <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(o.totalDonation) || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400 grid grid-cols-12 gap-2">
          <div className="col-span-2">Bezahlt am</div>
          <div className="col-span-3">Shop</div>
          <div className="col-span-2 text-right">Aufträge</div>
          <div className="col-span-2 text-right">Summe</div>
          <div className="col-span-3">Quittung</div>
        </div>

        {!shopId ? (
          <div className="p-10 text-center text-slate-400">Bitte Shop auswählen.</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Noch keine Zahlungen.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((p) => {
              const received = p.receipt_received === 1
              return (
                <div key={p.id}>
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                    <div className="col-span-2 text-sm text-slate-700">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("de-DE") : "-"}</div>
                    <div className="col-span-3 text-sm text-slate-800">{p.shop_name}</div>
                    <div className="col-span-2 text-sm text-slate-800 text-right font-bold">{p.total_orders || (p.order_ids || []).length}</div>
                    <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(p.total_donation) || 0).toFixed(2)}</div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPaymentDetails(p.id)}
                          className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                        >
                          Details
                        </button>
                        <select
                          className="border border-slate-300 rounded-lg p-1 text-xs"
                          value={received ? "yes" : "no"}
                          onChange={(e) => toggleReceipt(p, e.target.value === "yes")}
                          disabled={saving}
                        >
                          <option value="no">Keine</option>
                          <option value="yes">Erhalten</option>
                        </select>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                          placeholder="Quittungs-Notiz (optional)"
                          value={receiptRefDraft[p.id] ?? p.receipt_reference ?? ""}
                          onChange={(e) => setReceiptRefDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          disabled={saving}
                        />
                        <button
                          onClick={() => toggleReceipt(p, received)}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 disabled:opacity-60"
                        >
                          Speichern
                        </button>
                      </div>
                      {received && p.receipt_received_at ? (
                        <div className="mt-1 text-[11px] text-slate-500">Erhalten am: {new Date(p.receipt_received_at).toLocaleDateString("de-DE")}</div>
                      ) : null}
                    </div>
                  </div>
                  {expandedPaymentId === p.id && (
                    <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                      {!expandedPaymentOrders ? (
                        <div className="text-sm text-slate-500">Lade Details…</div>
                      ) : expandedPaymentOrders.length === 0 ? (
                        <div className="text-sm text-slate-500">Keine Details.</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-12 gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 pb-2">
                            <div className="col-span-3">Datum</div>
                            <div className="col-span-4">Bestellnr.</div>
                            <div className="col-span-2 text-right">Artikel</div>
                            <div className="col-span-1 text-right">Summe</div>
                            <div className="col-span-2 text-right">Spende</div>
                          </div>
                          <div className="divide-y divide-slate-200">
                            {expandedPaymentOrders.map((o: any) => (
                              <div key={o.order_id} className="grid grid-cols-12 gap-2 py-2 items-center">
                                <div className="col-span-3 text-sm text-slate-700">
                                  {o.order_date ? new Date(o.order_date).toLocaleDateString("de-DE") : "-"}
                                </div>
                                <div className="col-span-4 text-sm font-mono text-slate-600">{o.order_number || "-"}</div>
                                <div className="col-span-2 text-sm text-slate-800 text-right font-bold">{Number(o.total_quantity) || 0}</div>
                                <div className="col-span-1 text-sm text-slate-800 text-right">€ {(Number(o.total_amount) || 0).toFixed(2)}</div>
                                <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(o.total_donation) || 0).toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
