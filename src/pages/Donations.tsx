import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/store"

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

export default function Donations() {
  const shops = useAppStore((s) => s.shops)
  const currentUser = useAppStore((s) => s.currentUser)
  const [rows, setRows] = useState<DonationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState<string>("")
  const [showPaid, setShowPaid] = useState<boolean>(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [shareLinks, setShareLinks] = useState<Record<string, any>>({})
  const [sharePassword, setSharePassword] = useState<string>("")
  const [shareSaving, setShareSaving] = useState<boolean>(false)

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (shopId && r.shop_id !== shopId) return false
      if (!showPaid && r.paid === 1) return false
      return true
    })
  }, [rows, shopId, showPaid])

  const totals = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + (Number(r.donation_total) || 0), 0)
    return { total }
  }, [filteredRows])

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
  }, [shopId])

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

  const togglePaid = async (row: DonationRow) => {
    setSavingId(row.id)
    try {
      const paid = !(row.paid === 1)
      const res = await fetch(`/api/donations/${row.id}/paid`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid, paidBy: currentUser?.name || null }),
      })
      const data = await res.json()
      if (data.success) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...data.data } : r)))
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
                    type="password"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    placeholder={shareLinks[shopId]?.has_password ? "Passwort ändern…" : "Passwort setzen…"}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    disabled={shareSaving}
                  />
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
          <div className="col-span-3">Artikel</div>
          <div className="col-span-1 text-right">Gesamt</div>
          <div className="col-span-1 text-right">Spende</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">Lade Spenden...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Keine Spenden gefunden.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((r) => {
              const isPaid = r.paid === 1
              return (
                <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
                  <div className="col-span-2 text-sm text-slate-700">
                    {r.order_date ? new Date(r.order_date).toLocaleDateString("de-DE") : "-"}
                  </div>
                  <div className="col-span-2 text-sm font-mono text-slate-600">{r.order_number || "-"}</div>
                  <div className="col-span-3 text-sm text-slate-800">{r.shop_name}</div>
                  <div className="col-span-3 text-sm text-slate-800">
                    <div className="font-semibold">{r.item_name || "-"}</div>
                    <div className="text-xs text-slate-400">Menge: {r.quantity || 0}</div>
                  </div>
                  <div className="col-span-1 text-sm font-bold text-slate-800 text-right">
                    € {(Number(r.order_total_amount) || 0).toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right">
                    <div className="text-sm font-black text-slate-900">€ {(Number(r.donation_total) || 0).toFixed(2)}</div>
                    <button
                      onClick={() => togglePaid(r)}
                      disabled={savingId === r.id}
                      className={`mt-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                        isPaid ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      } ${savingId === r.id ? "opacity-60" : ""}`}
                    >
                      {isPaid ? "Bezahlt" : "Offen"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
