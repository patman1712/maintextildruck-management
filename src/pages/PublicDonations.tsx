import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"

type DonationRow = {
  id: string
  shop_id: string
  shop_name: string
  order_id?: string
  order_number?: string
  order_date?: string
  item_name?: string
  quantity?: number
  order_total_amount?: number
  item_total?: number
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

export default function PublicDonations() {
  const { token } = useParams<{ token: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [allRows, setAllRows] = useState<DonationRow[]>([])
  const [shopName, setShopName] = useState<string>("")
  const [shopLogoUrl, setShopLogoUrl] = useState<string>("")
  const [mainLogoUrl, setMainLogoUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [password, setPassword] = useState("")
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState<boolean>(false)
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [expandedPaymentOrders, setExpandedPaymentOrders] = useState<any[] | null>(null)
  const [expandedPaymentItems, setExpandedPaymentItems] = useState<any[] | null>(null)
  const [paymentsError, setPaymentsError] = useState<string>("")
  const [expandedOrderKey, setExpandedOrderKey] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [productsLoading, setProductsLoading] = useState<boolean>(false)
  const [productsError, setProductsError] = useState<string>("")

  const tab = (searchParams.get("tab") || "dashboard").toLowerCase()

  const orders = useMemo<DonationOrder[]>(() => {
    const byKey = new Map<string, DonationOrder>()
    for (const r of allRows) {
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
        existing.paid = existing.paid && r.paid === 1
      }
    }

    return Array.from(byKey.values())
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
  }, [allRows])

  const openOrders = useMemo(() => orders.filter((o) => !o.paid), [orders])
  const paidOrders = useMemo(() => orders.filter((o) => o.paid), [orders])

  const counts = useMemo(() => {
    const paid = allRows.filter((r) => r.paid === 1).length
    const open = allRows.length - paid
    return { paid, open, total: allRows.length }
  }, [allRows])

  const totals = useMemo(() => {
    const totalOpen = openOrders.reduce((sum, o) => sum + (Number(o.totalDonation) || 0), 0)
    const totalPaid = paidOrders.reduce((sum, o) => sum + (Number(o.totalDonation) || 0), 0)
    return { totalOpen, totalPaid }
  }, [openOrders, paidOrders])

  const fetchData = async (pw?: string) => {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/donations/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw ?? password }),
      })
      const data = await res.json()
      if (data.success) {
        setAllRows(data.data.rows || [])
        setShopName(data.data.shopName || "")
        setShopLogoUrl(data.data.shopLogoUrl || "")
        setRequiresPassword(false)
      } else if (data.requiresPassword) {
        setRequiresPassword(true)
      } else {
        setError(data.error || "Fehler")
      }
    } catch (e: any) {
      setError(e?.message || "Netzwerkfehler")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings && data.settings.logo) setMainLogoUrl(data.settings.logo)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
  }, [token])

  const fetchPayments = async (pw?: string) => {
    if (!token) return
    setPaymentsLoading(true)
    setPaymentsError("")
    try {
      const res = await fetch(`/api/donations/public/${token}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw ?? password }),
      })
      const data = await res.json()
      if (data.success) {
        setPayments(data.data || [])
      } else if (data.requiresPassword) {
        setRequiresPassword(true)
      } else {
        setPaymentsError(data.error || "Fehler")
      }
    } catch (e: any) {
      setPaymentsError(e?.message || "Netzwerkfehler")
    } finally {
      setPaymentsLoading(false)
    }
  }

  useEffect(() => {
    if (requiresPassword) return
    fetchPayments()
  }, [token, requiresPassword])

  useEffect(() => {
    if (requiresPassword) return
    fetchProducts()
  }, [token, requiresPassword])

  const openPaymentDetails = async (paymentId: string) => {
    if (!token) return
    if (expandedPaymentId === paymentId) {
      setExpandedPaymentId(null)
      setExpandedPaymentOrders(null)
      setExpandedPaymentItems(null)
      return
    }
    setExpandedPaymentId(paymentId)
    setExpandedPaymentOrders(null)
    setExpandedPaymentItems(null)
    try {
      const res = await fetch(`/api/donations/public/${token}/payments/${paymentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.success) {
        setExpandedPaymentOrders(data.data.orders || [])
        setExpandedPaymentItems(data.data.items || [])
      }
      else if (data.requiresPassword) setRequiresPassword(true)
      else alert(data.error || "Fehler")
    } catch (e: any) {
      alert(e?.message || "Fehler")
    }
  }

  const fetchProducts = async (pw?: string) => {
    if (!token) return
    setProductsLoading(true)
    setProductsError("")
    try {
      const res = await fetch(`/api/donations/public/${token}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw ?? password }),
      })
      const data = await res.json()
      if (data.success) {
        setProducts(data.data || [])
      } else if (data.requiresPassword) {
        setRequiresPassword(true)
      } else {
        setProductsError(data.error || "Fehler")
      }
    } catch (e: any) {
      setProductsError(e?.message || "Netzwerkfehler")
    } finally {
      setProductsLoading(false)
    }
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-red-800 to-red-600 py-10 px-4">
        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            {mainLogoUrl ? (
              <img src={mainLogoUrl} alt="Main Textildruck" className="h-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 font-black flex items-center justify-center">M</div>
            )}
            {shopLogoUrl ? <img src={shopLogoUrl} alt={shopName || "Shop"} className="h-10 object-contain" /> : null}
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-1">Spendenübersicht</h1>
          <p className="text-sm text-slate-500 mb-4">{shopName || "Shop"} · Bitte Passwort eingeben.</p>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg p-3 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button
            onClick={async () => {
              await fetchData(password)
              await fetchPayments(password)
              await fetchProducts(password)
            }}
            className="mt-4 w-full px-4 py-3 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700"
          >
            Öffnen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-red-800 to-red-600">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {mainLogoUrl ? (
              <img src={mainLogoUrl} alt="Main Textildruck" className="h-10 object-contain bg-white/90 rounded-md px-2 py-1" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-white/90 text-red-700 font-black flex items-center justify-center">M</div>
            )}
            {shopLogoUrl ? (
              <img src={shopLogoUrl} alt={shopName || "Shop"} className="h-10 object-contain bg-white/90 rounded-md px-2 py-1" />
            ) : null}
            <div className="text-white min-w-0">
              <div className="text-xl font-black truncate">Spendenübersicht</div>
              <div className="text-sm text-white/80 truncate">{shopName || "Shop"}</div>
            </div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-xs font-bold">
            Offen: {counts.open} · Bezahlt: {counts.paid}
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "open", label: "Offene Spenden" },
              { id: "payments", label: "Zahlungen" },
              { id: "products", label: "Produkte" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  p.set("tab", t.id)
                  return p
                })}
                className={`px-3 py-2 rounded-lg text-sm font-bold border ${
                  tab === t.id ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase text-slate-400">Offen</div>
            <div className="text-lg font-black text-slate-900">€ {totals.totalOpen.toFixed(2)}</div>
          </div>
        </div>

        {tab === "dashboard" ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            {loading ? (
              <div className="p-10 text-center text-slate-400">Lade...</div>
            ) : error ? (
              <div className="p-6 text-center text-red-600">{error}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold uppercase text-slate-400">Offene Spenden</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">€ {totals.totalOpen.toFixed(2)}</div>
                  <div className="text-sm text-slate-500 mt-1">{counts.open} Positionen</div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold uppercase text-slate-400">Zahlungen</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{payments.length}</div>
                  <div className="text-sm text-slate-500 mt-1">Batches</div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold uppercase text-slate-400">Produkte mit Spende</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{products.filter((p: any) => Number(p.donation_amount) > 0).length}</div>
                  <div className="text-sm text-slate-500 mt-1">Artikel</div>
                </div>
              </div>
            )}
          </div>
        ) : tab === "payments" ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400 grid grid-cols-12 gap-2">
              <div className="col-span-3">Bezahlt am</div>
              <div className="col-span-2 text-right">Aufträge</div>
              <div className="col-span-2 text-right">Summe</div>
              <div className="col-span-5">Quittung</div>
            </div>
            {paymentsLoading ? (
              <div className="p-10 text-center text-slate-400">Lade...</div>
            ) : paymentsError ? (
              <div className="p-10 text-center text-red-600">{paymentsError}</div>
            ) : payments.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Noch keine Zahlungen.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map((p: any) => {
                  const received = p.receipt_received === 1
                  return (
                    <div key={p.id} className="px-4 py-3">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 text-sm text-slate-700">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("de-DE") : "-"}</div>
                        <div className="col-span-2 text-sm text-slate-800 text-right font-bold">{p.total_orders || (p.order_ids || []).length}</div>
                        <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(p.total_donation) || 0).toFixed(2)}</div>
                        <div className="col-span-5 flex items-center justify-between gap-3">
                          <div className="text-sm text-slate-700">{received ? "Quittung erhalten" : "Keine Quittung"}</div>
                          <button
                            onClick={() => openPaymentDetails(p.id)}
                            className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                      {expandedPaymentId === p.id ? (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                          {!expandedPaymentOrders ? (
                            <div className="text-sm text-slate-500">Lade Details…</div>
                          ) : expandedPaymentOrders.length === 0 ? (
                            <div className="text-sm text-slate-500">Keine Details.</div>
                          ) : (
                            <>
                              <div className="grid grid-cols-12 gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 pb-2">
                                <div className="col-span-4">Datum</div>
                                <div className="col-span-4">Bestellnr.</div>
                                <div className="col-span-2 text-right">Artikel</div>
                                <div className="col-span-2 text-right">Spende</div>
                              </div>
                              <div className="divide-y divide-slate-200">
                                {expandedPaymentOrders.map((o: any) => (
                                  <div key={o.order_id} className="grid grid-cols-12 gap-2 py-2 items-center">
                                    <div className="col-span-4 text-sm text-slate-700">
                                      {o.order_date ? new Date(o.order_date).toLocaleDateString("de-DE") : "-"}
                                    </div>
                                    <div className="col-span-4 text-sm font-mono text-slate-600">{o.order_number || "-"}</div>
                                    <div className="col-span-2 text-sm text-slate-800 text-right font-bold">{Number(o.total_quantity) || 0}</div>
                                    <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(o.total_donation) || 0).toFixed(2)}</div>
                                  </div>
                                ))}
                              </div>
                              {expandedPaymentItems && expandedPaymentItems.length > 0 ? (
                                <div className="mt-4">
                                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 pb-2">Artikel in dieser Zahlung</div>
                                  <div className="grid grid-cols-12 gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 pb-2">
                                    <div className="col-span-5">Artikel</div>
                                    <div className="col-span-2 text-right">Anzahl</div>
                                    <div className="col-span-3 text-right">Artikelpreis</div>
                                    <div className="col-span-2 text-right">Spende</div>
                                  </div>
                                  <div className="divide-y divide-slate-200">
                                    {expandedPaymentItems.map((it: any, idx: number) => (
                                      <div key={`${it.order_id}-${idx}`} className="grid grid-cols-12 gap-2 py-2 items-center">
                                        <div className="col-span-5 text-sm text-slate-800 font-semibold">{it.item_name || "-"}</div>
                                        <div className="col-span-2 text-sm text-slate-700 text-right">{Number(it.quantity) || 0}</div>
                                        <div className="col-span-3 text-sm text-slate-700 text-right">€ {(Number(it.item_total) || 0).toFixed(2)}</div>
                                        <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(it.donation_total) || 0).toFixed(2)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : tab === "products" ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400 grid grid-cols-12 gap-2">
              <div className="col-span-3">Artikel-Nr.</div>
              <div className="col-span-5">Artikelname</div>
              <div className="col-span-2 text-right">Verkaufspreis</div>
              <div className="col-span-2 text-right">Spende</div>
            </div>
            {productsLoading ? (
              <div className="p-10 text-center text-slate-400">Lade...</div>
            ) : productsError ? (
              <div className="p-10 text-center text-red-600">{productsError}</div>
            ) : products.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Keine Produkte gefunden.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {products.map((p: any, idx: number) => (
                  <div key={`${p.product_number}-${idx}`} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                    <div className="col-span-3 text-sm font-mono text-slate-600">{p.product_number || "-"}</div>
                    <div className="col-span-5 text-sm text-slate-800 font-semibold">{p.product_name || "-"}</div>
                    <div className="col-span-2 text-sm text-slate-800 text-right">€ {(Number(p.price) || 0).toFixed(2)}</div>
                    <div className="col-span-2 text-sm font-black text-slate-900 text-right">€ {(Number(p.donation_amount) || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <div className="col-span-2">Datum</div>
              <div className="col-span-3">Bestellnr.</div>
              <div className="col-span-2 text-right">Artikel</div>
              <div className="col-span-2 text-right">Summe</div>
              <div className="col-span-3 text-right">Spende</div>
            </div>
            {loading ? (
              <div className="p-10 text-center text-slate-400">Lade...</div>
            ) : error ? (
              <div className="p-10 text-center text-red-600">{error}</div>
            ) : openOrders.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Keine Einträge.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {openOrders.map((o) => {
                  const isExpanded = expandedOrderKey === o.key
                  return (
                    <div key={o.key}>
                      <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                        <div className="col-span-2 text-sm text-slate-700">
                          {o.order_date ? new Date(o.order_date).toLocaleDateString("de-DE") : "-"}
                        </div>
                        <div className="col-span-3 text-sm font-mono text-slate-600">{o.order_number || "-"}</div>
                        <div className="col-span-2 text-sm text-slate-800 text-right">
                          <span className="font-bold">{o.totalQuantity}</span>
                        </div>
                        <div className="col-span-2 text-sm font-bold text-slate-800 text-right">
                          € {(Number(o.totalAmount) || 0).toFixed(2)}
                        </div>
                        <div className="col-span-3 text-right">
                          <div className="text-sm font-black text-slate-900">€ {(Number(o.totalDonation) || 0).toFixed(2)}</div>
                          <div className="mt-1 flex justify-end gap-2">
                            <button
                              onClick={() => setExpandedOrderKey((prev) => (prev === o.key ? null : o.key))}
                              className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            >
                              {isExpanded ? "Details zu" : "Details"}
                            </button>
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                                o.paid ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-slate-600 border-slate-200"
                              }`}
                            >
                              {o.paid ? "Bezahlt" : "Offen"}
                            </span>
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
        )}
      </div>
    </div>
  )
}
