import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

type DonationRow = {
  id: string
  shop_id: string
  shop_name: string
  order_number?: string
  order_date?: string
  item_name?: string
  quantity?: number
  order_total_amount?: number
  donation_total?: number
  paid?: number
  paid_at?: string | null
}

export default function PublicDonations() {
  const { token } = useParams<{ token: string }>()
  const [allRows, setAllRows] = useState<DonationRow[]>([])
  const [shopName, setShopName] = useState<string>("")
  const [shopLogoUrl, setShopLogoUrl] = useState<string>("")
  const [mainLogoUrl, setMainLogoUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [password, setPassword] = useState("")
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [showPaid, setShowPaid] = useState<boolean>(false)

  const rows = useMemo(() => {
    if (showPaid) return allRows
    return allRows.filter((r) => !(r.paid === 1))
  }, [allRows, showPaid])

  const counts = useMemo(() => {
    const paid = allRows.filter((r) => r.paid === 1).length
    const open = allRows.length - paid
    return { paid, open, total: allRows.length }
  }, [allRows])

  const totals = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + (Number(r.donation_total) || 0), 0)
    return { total }
  }, [rows])

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
            onClick={() => fetchData(password)}
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center space-x-3">
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
            <div className="sm:ml-auto text-right">
              <div className="text-xs font-bold uppercase text-slate-400">Summe</div>
              <div className="text-xl font-black text-slate-900">€ {totals.total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400">
            <div className="col-span-2">Datum</div>
            <div className="col-span-2">Bestellnr.</div>
            <div className="col-span-4">Artikel</div>
            <div className="col-span-2 text-right">Gesamt</div>
            <div className="col-span-2 text-right">Spende</div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-400">Lade...</div>
          ) : error ? (
            <div className="p-10 text-center text-red-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-slate-400">Keine Spenden gefunden.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                  <div className="col-span-2 text-sm text-slate-700">
                    {r.order_date ? new Date(r.order_date).toLocaleDateString("de-DE") : "-"}
                  </div>
                  <div className="col-span-2 text-sm font-mono text-slate-600">{r.order_number || "-"}</div>
                  <div className="col-span-4 text-sm text-slate-800">
                    <div className="font-semibold">{r.item_name || "-"}</div>
                    <div className="text-xs text-slate-400">
                      Menge: {r.quantity || 0} · {r.paid === 1 ? "Bezahlt" : "Offen"}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm font-bold text-slate-800 text-right">
                    € {(Number(r.order_total_amount) || 0).toFixed(2)}
                  </div>
                  <div className="col-span-2 text-sm font-black text-slate-900 text-right">
                    € {(Number(r.donation_total) || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
