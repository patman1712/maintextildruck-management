import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual login logic
    if (username === "admin" && password === "admin") {
      navigate("/dashboard");
    } else {
      alert("Invalid credentials (try admin/admin)");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border-t-4 border-red-600">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center">
            {/* Logo Simulation */}
            <div className="flex items-center space-x-4 mb-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-800 to-red-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg border-2 border-red-900">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="border-l-2 border-red-800 h-12 mx-2"></div>
              <div className="text-left">
                <h1 className="text-4xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-red-500" style={{ fontFamily: 'sans-serif' }}>
                  MAIN
                </h1>
                <p className="text-sm font-bold tracking-widest text-slate-900 uppercase">
                  TEXTILDRUCK
                </p>
              </div>
            </div>
          </div>
          <p className="text-gray-500 mt-2">Management System Login</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Benutzername
            </label>
            <input
              id="username"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-red-700 to-red-500 hover:from-red-800 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
            >
              Anmelden
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
