import { useState } from 'react';
import { useAppStore } from '@/store';
import { User, Lock } from 'lucide-react';

export default function Profile() {
  const currentUser = useAppStore((state) => state.currentUser);
  const updateUser = useAppStore((state) => state.updateUser);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  if (!currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    try {
      await updateUser(currentUser.id, { password });
      setSuccess('Passwort erfolgreich geändert');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Ändern des Passworts');
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mein Profil</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center mb-6">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mr-4">
            <User size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{currentUser.name}</h2>
            <p className="text-gray-500">{currentUser.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}</p>
            <p className="text-sm text-gray-400">Benutzername: {currentUser.username}</p>
          </div>
        </div>
        
        <hr className="my-6 border-gray-100" />
        
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <Lock size={18} className="mr-2" />
          Passwort ändern
        </h3>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Neues Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passwort bestätigen</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
          </div>
          
          <div className="mt-6">
            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Passwort speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}