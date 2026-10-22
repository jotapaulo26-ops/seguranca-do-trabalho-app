import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeviceId, getDeviceDescription } from '../services/deviceId';
import { ShieldCheck, Lock, Mail, Smartphone, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const deviceId = getDeviceId();
  const deviceDesc = getDeviceDescription();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha o e-mail e a senha.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-amber-500 items-center justify-center text-3xl shadow-xl shadow-amber-500/20 mb-3 animate-bounce">
            🛡️
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SegTrabalho</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão Integrada de Segurança, APRs e Mapa de Riscos
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Entrar no Sistema</h2>
          <p className="text-xs text-slate-500 mb-6">Acesso autorizado para técnicos, gestores e operadores.</p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com.br"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Senha de Acesso</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Device ID info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-0.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                <span>Rastreabilidade de Aparelho Ativa</span>
              </div>
              <p className="truncate font-mono text-[10px] text-slate-600">
                ID: {deviceId}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Acessar Sistema'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins for Pair Programming / Review */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Acesso Rápido para Testes
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@segtrabalho.com.br', 'admin123')}
                className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-semibold text-center transition-colors"
              >
                👑 Administrador
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('carlos.mendes@segtrabalho.com.br', 'tec123')}
                className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-[11px] font-semibold text-center transition-colors"
              >
                👷 Técnico SST
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
