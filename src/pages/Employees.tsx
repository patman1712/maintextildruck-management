import { useState, useEffect } from 'react';
import { useAppStore, User } from '@/store';
import { Plus, Edit, Trash2, Shield, User as UserIcon, Store, Check, X } from 'lucide-react';

interface ShopPermission {
  view: boolean;
  edit: boolean;
}
interface ShopAssignment {
  shop_id: string;
  shop_name: string;
  selected: boolean;
  permissions: { products: ShopPermission; categories: ShopPermission; design: ShopPermission };
}

export default function Employees() {
  const users = useAppStore((state) => state.users);
  const shops = useAppStore((state) => state.shops);
  const fetchUsers = useAppStore((state) => state.fetchUsers);
  const addUser = useAppStore((state) => state.addUser);
  const deleteUser = useAppStore((state) => state.deleteUser);
  const updateUser = useAppStore((state) => state.updateUser);
  const currentUser = useAppStore((state) => state.currentUser);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee' | 'shop_operator'>('employee');
  const [error, setError] = useState('');

  // Shop-Betreiber Rechte
  const [shopAssignments, setShopAssignments] = useState<ShopAssignment[]>([]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const initShopAssignments = (existing?: any[]) => {
    const existingMap = new Map(existing?.map((e) => [e.shop_id, e.permissions]));
    setShopAssignments(
      shops.map((s) => {
        const existingPerms = existingMap.get(s.id);
        return {
          shop_id: s.id,
          shop_name: s.name,
          selected: !!existingPerms,
          permissions: existingPerms || {
            products: { view: false, edit: false },
            categories: { view: false, edit: false },
            design: { view: false, edit: false },
          },
        };
      })
    );
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setRole('employee');
    setError('');
    setEditingUser(null);
    setShopAssignments([]);
  };

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    setRole(user.role as any);
    setPassword('');
    setError('');

    if (user.role === 'shop_operator') {
      try {
        const res = await fetch(`/api/users/${user.id}/shops`);
        const data = await res.json();
        initShopAssignments(data.success ? data.data : []);
      } catch {
        initShopAssignments([]);
      }
    } else {
      initShopAssignments([]);
    }

    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Benutzer wirklich löschen?')) {
      await deleteUser(id);
    }
  };

  const toggleShop = (shopId: string) => {
    setShopAssignments((prev) =>
      prev.map((s) =>
        s.shop_id === shopId ? { ...s, selected: !s.selected } : s
      )
    );
  };

  const togglePerm = (shopId: string, module: 'products' | 'categories' | 'design', perm: 'view' | 'edit') => {
    setShopAssignments((prev) =>
      prev.map((s) => {
        if (s.shop_id !== shopId) return s;
        const next = { ...s, permissions: { ...s.permissions } };
        next.permissions[module] = { ...next.permissions[module], [perm]: !next.permissions[module][perm] };
        // Wenn edit aktiviert, view muss auch aktiv sein
        if (perm === 'edit' && next.permissions[module].edit) {
          next.permissions[module].view = true;
        }
        // Wenn view deaktiviert, edit muss auch deaktiviert werden
        if (perm === 'view' && !next.permissions[module].view) {
          next.permissions[module].edit = false;
        }
        return next;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        const prevRole = editingUser.role;
        const updates: any = { name, username, role };
        if (password) updates.password = password;
        await updateUser(editingUser.id, updates);

        // Shop-Rechte speichern wenn shop_operator
        if (role === 'shop_operator') {
          const shopsPayload = shopAssignments
            .filter((s) => s.selected)
            .map((s) => ({ shop_id: s.shop_id, permissions: s.permissions }));
          await fetch(`/api/users/${editingUser.id}/shops`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shops: shopsPayload }),
          });
        } else if ((prevRole as string) === 'shop_operator') {
          // Rollenwechsel weg von shop_operator → alle Zuordnungen löschen
          await fetch(`/api/users/${editingUser.id}/shops`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shops: [] }),
          });
        }
      } else {
        if (!password) {
          setError('Passwort ist erforderlich');
          return;
        }
        const newUser = await addUser({ name, username, password, role });
        if (role === 'shop_operator' && newUser?.id) {
          const shopsPayload = shopAssignments
            .filter((s) => s.selected)
            .map((s) => ({ shop_id: s.shop_id, permissions: s.permissions }));
          await fetch(`/api/users/${newUser.id}/shops`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shops: shopsPayload }),
          });
        }
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
    }
  };

  const handleOpenNew = () => {
    resetForm();
    initShopAssignments([]);
    setShowModal(true);
  };

  const roleBadge = (r: string) => {
    if (r === 'admin') return 'Administrator';
    if (r === 'shop_operator') return 'Shop-Betreiber';
    return 'Mitarbeiter';
  };

  const roleBadgeClass = (r: string) => {
    if (r === 'admin') return 'bg-purple-100 text-purple-800';
    if (r === 'shop_operator') return 'bg-amber-100 text-amber-800';
    return 'bg-green-100 text-green-800';
  };

  if (currentUser?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Zugriff verweigert. Nur für Administratoren.</div>;
  }

  const modules: { key: 'products' | 'categories' | 'design'; label: string }[] = [
    { key: 'products', label: 'Produkte' },
    { key: 'categories', label: 'Kategorien' },
    { key: 'design', label: 'Design & Einstellungen' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Benutzer verwalten</h1>
          <p className="text-sm text-gray-500 mt-1">Mitarbeiter und Shop-Betreiber mit individuellen Rechten</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-red-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Benutzer hinzufügen
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Benutzername</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rolle</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                      user.role === 'shop_operator' ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {user.role === 'admin' ? <Shield size={16} /> : user.role === 'shop_operator' ? <Store size={16} /> : <UserIcon size={16} />}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.username}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleBadgeClass(user.role)}`}>
                    {roleBadge(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900 mr-3">
                    <Edit size={18} />
                  </button>
                  {user.id !== currentUser.id && (
                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 my-8">
            <h2 className="text-xl font-bold mb-4">{editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</h2>

            {error && <div className="bg-red-50 text-red-600 p-2 rounded mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Benutzername</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {editingUser ? 'Neues Passwort (leer lassen zum Behalten)' : 'Passwort'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    required={!editingUser}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rolle</label>
                  <select
                    value={role}
                    onChange={(e: any) => {
                      setRole(e.target.value);
                      if (e.target.value === 'shop_operator' && shopAssignments.length === 0) {
                        initShopAssignments([]);
                      }
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="employee">Mitarbeiter (volle Verwaltung)</option>
                    <option value="admin">Administrator</option>
                    <option value="shop_operator">Shop-Betreiber (eingeschränkt)</option>
                  </select>
                </div>
              </div>

              {role === 'shop_operator' && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                    <Store size={18} className="mr-2 text-amber-600" />
                    Shop-Zuordnung &amp; Rechte
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Wähle aus, welche Shops dieser Betreiber verwalten darf und welche Rechte er pro Modul hat.
                    <strong className="block mt-1">Login-URL für Shop-Betreiber:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded">/shop-login</code>
                  </p>

                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Shop</th>
                          {modules.map((m) => (
                            <th key={m.key} className="px-3 py-2 text-center text-xs font-medium text-gray-600" colSpan={2}>
                              {m.label}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-gray-100">
                          <th className="px-3 py-1"></th>
                          {modules.map((m) => (
                            <>
                              <th key={`${m.key}-view`} className="px-2 py-1 text-center text-[11px] text-gray-500">Lesen</th>
                              <th key={`${m.key}-edit`} className="px-2 py-1 text-center text-[11px] text-gray-500">Ändern</th>
                            </>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {shopAssignments.map((s) => (
                          <tr key={s.shop_id} className={s.selected ? 'bg-amber-50/50' : ''}>
                            <td className="px-3 py-2">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={s.selected}
                                  onChange={() => toggleShop(s.shop_id)}
                                  className="h-4 w-4 mr-2"
                                />
                                <span className="font-medium text-gray-700">{s.shop_name}</span>
                              </label>
                            </td>
                            {modules.map((m) => (
                              <>
                                <td key={`${s.shop_id}-${m.key}-view`} className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={s.selected && s.permissions[m.key].view}
                                    disabled={!s.selected}
                                    onChange={() => togglePerm(s.shop_id, m.key, 'view')}
                                    className="h-4 w-4 disabled:opacity-40"
                                  />
                                </td>
                                <td key={`${s.shop_id}-${m.key}-edit`} className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={s.selected && s.permissions[m.key].edit}
                                    disabled={!s.selected}
                                    onChange={() => togglePerm(s.shop_id, m.key, 'edit')}
                                    className="h-4 w-4 disabled:opacity-40"
                                  />
                                </td>
                              </>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}