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
  const [rows, setRows] = useState<DonationRow[]>([])
  const [shopName, setShopName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [password, setPassword] = useState("")
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [showPaid, setShowPaid] = useState<boolean>(false)

  const totals = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + (Number(r.donation_total) || 0), 0)
    return { total }
  }, [rows])

  const fetchData = async (pw?: string) => {
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (showPaid) params.set("showPaid", "true")
      const res = await fetch(`/api/donations/public/${token}?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw ?? password }),
      })
      const data = await res.json()
      if (data.success) {
        setRows(data.data.rows || [])
        setShopName(data.data.shopName || "")
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
    fetchData()
  }, [token, showPaid])

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h1 className="text-xl font-black text-slate-900 mb-2">Spendenübersicht</h1>
          <p className="text-sm text-slate-500 mb-4">Bitte Passwort eingeben.</p>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg p-3 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => fetchData(password)}
            className="mt-4 w-full px-4 py-3 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800"
          >
            Öffnen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Spendenübersicht</h1>
          <p className="text-sm text-slate-500 mt-1">{shopName || "Shop"}</p>

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
