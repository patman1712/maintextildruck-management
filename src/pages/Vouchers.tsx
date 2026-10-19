import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { Ticket, Plus, Edit, Trash2, X, Save, AlertCircle, Loader2, Percent, Euro } from 'lucide-react'

type Voucher = {
  id: string
  shop_id: string
  shop_name?: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  active: boolean
  valid_until: string | null
  min_order_value: number | null
  once_per_customer: boolean
  created_at?: string
}

type VoucherForm = {
  shopId: string
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: string
  active: boolean
  validUntil: string
  minOrderValue: string
  oncePerCustomer: boolean
}

const EMPTY_FORM: VoucherForm = {
  shopId: '',
  code: '',
  discountType: 'percent',
  discountValue: '',
  active: true,
  validUntil: '',
  minOrderValue: '',
  oncePerCustomer: false,
}

export default function Vouchers() {
  const shops = useAppStore((s) => s.shops)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [filterShopId, setFilterShopId] = useState('')
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<VoucherForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchVouchers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/vouchers')
      const data = await res.json()
      if (data.success) {
        setVouchers(data.data)
      } else {
        setError(data.error || 'Gutscheine konnten nicht geladen werden.')
      }
    } catch {
      setError('Gutscheine konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVouchers()
  }, [])

  const visibleVouchers = useMemo(
    () => (filterShopId ? vouchers.filter((v) => v.shop_id === filterShopId) : vouchers),
    [vouchers, filterShopId]
  )

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, shopId: filterShopId || shops[0]?.id || '' })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (v: Voucher) => {
    setEditingId(v.id)
    setForm({
      shopId: v.shop_id,
      code: v.code,
      discountType: v.discount_type,
      discountValue: String(v.discount_value),
      active: v.active,
      validUntil: v.valid_until || '',
      minOrderValue: v.min_order_value != null ? String(v.min_order_value) : '',
      oncePerCustomer: v.once_per_customer,
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.shopId) return setFormError('Bitte einen Shop auswählen.')
    if (!form.code.trim()) return setFormError('Bitte einen Gutscheincode angeben.')
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      return setFormError('Bitte einen Rabattwert größer 0 angeben.')
    }
    if (form.discountType === 'percent' && Number(form.discountValue) > 100) {
      return setFormError('Ein prozentualer Rabatt darf maximal 100 % betragen.')
    }

    setSaving(true)
    try {
      const payload = {
        shopId: form.shopId,
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        active: form.active,
        validUntil: form.validUntil || null,
        minOrderValue: form.minOrderValue === '' ? null : Number(form.minOrderValue),
        oncePerCustomer: form.oncePerCustomer,
      }
      const res = await fetch(editingId ? `/api/vouchers/${editingId}` : '/api/vouchers', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchVouchers()
      } else {
        setFormError(data.error || 'Speichern fehlgeschlagen.')
      }
    } catch {
      setFormError('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (v: Voucher) => {
    if (!window.confirm(`Gutschein "${v.code}" wirklich löschen?`)) return
    setDeletingId(v.id)
    try {
      const res = await fetch(`/api/vouchers/${v.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setVouchers((prev) => prev.filter((x) => x.id !== v.id))
      } else {
        alert(data.error || 'Löschen fehlgeschlagen.')
      }
    } catch {
      alert('Löschen fehlgeschlagen.')
    } finally {
      setDeletingId(null)
    }
  }

  const isExpired = (v: Voucher) => !!v.valid_until && new Date(v.valid_until + 'T23:59:59') < new Date()

  const formatValue = (v: Voucher) =>
    v.discount_type === 'percent'
      ? `${v.discount_value} %`
      : `${v.discount_value.toFixed(2).replace('.', ',')} €`

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <Ticket size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">Gutscheine</h1>
            <p className="text-xs text-slate-500 font-medium">Rabattcodes pro Shop verwalten</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center px-5 py-3 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-colors shadow-lg"
        >
          <Plus size={16} className="mr-2" /> Neuer Gutschein
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Shop</label>
        <select
          value={filterShopId}
          onChange={(e) => setFilterShopId(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium bg-white"
        >
          <option value="">Alle Shops</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-6 flex items-center text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="mr-2" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : visibleVouchers.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-medium">
          Noch keine Gutscheincodes angelegt.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Shop</th>
                <th className="px-6 py-4">Rabatt</th>
                <th className="px-6 py-4">Regeln</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleVouchers.map((v) => {
                const expired = isExpired(v)
                return (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-800 tracking-wider">{v.code}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{v.shop_name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-sm font-bold text-slate-800">
                        {v.discount_type === 'percent' ? <Percent size={14} className="mr-1" /> : <Euro size={14} className="mr-1" />}
                        {formatValue(v)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-medium space-y-0.5">
                      {v.min_order_value != null && <div>ab {v.min_order_value.toFixed(2).replace('.', ',')} €</div>}
                      {v.valid_until && <div>bis {new Date(v.valid_until).toLocaleDateString('de-DE')}</div>}
                      {v.once_per_customer && <div>1× pro Kunde</div>}
                      {v.min_order_value == null && !v.valid_until && !v.once_per_customer && <span className="text-slate-300">Keine</span>}
                    </td>
                    <td className="px-6 py-4">
                      {!v.active ? (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-100 text-slate-500">Inaktiv</span>
                      ) : expired ? (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-amber-50 text-amber-600">Abgelaufen</span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-50 text-emerald-600">Aktiv</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          disabled={deletingId === v.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Löschen"
                        >
                          {deletingId === v.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-lg font-black uppercase italic tracking-tighter">
                {editingId ? 'Gutschein bearbeiten' : 'Neuer Gutschein'}
              </h2>
              <button onClick={() => !saving && setShowModal(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="mr-2 flex-shrink-0" /> {formError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shop*</label>
                <select
                  value={form.shopId}
                  onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                >
                  <option value="">Bitte wählen…</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {form.shopId && !shops.find((s) => s.id === form.shopId)?.vouchers_enabled && (
                  <p className="text-[11px] text-amber-600 font-bold">
                    Hinweis: Gutscheine sind für diesen Shop noch nicht unter „Allgemein" freigegeben.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gutscheincode*</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="z. B. SOMMER2026"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-black uppercase tracking-wider"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rabattart*</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discountType: 'percent' })}
                    className={`flex items-center justify-center py-3 rounded-xl border-2 font-black uppercase tracking-widest text-xs transition-colors ${form.discountType === 'percent' ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Percent size={14} className="mr-2" /> Prozent
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discountType: 'fixed' })}
                    className={`flex items-center justify-center py-3 rounded-xl border-2 font-black uppercase tracking-widest text-xs transition-colors ${form.discountType === 'fixed' ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Euro size={14} className="mr-2" /> Fixbetrag
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {form.discountType === 'percent' ? 'Rabatt in %*' : 'Rabatt in €*'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  placeholder={form.discountType === 'percent' ? '10' : '5.00'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gültig bis</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mindestbestellwert (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderValue}
                    onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                <div>
                  <div className="font-bold text-sm text-slate-700">Nur einmal pro Kunde</div>
                  <div className="text-[11px] text-slate-500">Der Code kann pro Kunde nur einmal eingelöst werden.</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.oncePerCustomer}
                  onChange={(e) => setForm({ ...form, oncePerCustomer: e.target.checked })}
                  className="w-5 h-5 rounded accent-red-600"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                <div>
                  <div className="font-bold text-sm text-slate-700">Aktiv</div>
                  <div className="text-[11px] text-slate-500">Inaktive Codes werden im Shop nicht akzeptiert.</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-5 h-5 rounded accent-red-600"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button
                onClick={() => !saving && setShowModal(false)}
                className="px-5 py-3 rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-6 py-3 rounded-xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
