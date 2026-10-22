import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getDeviceId, getDeviceDescription } from '../services/deviceId';
import {
  Settings,
  Building,
  Key,
  Smartphone,
  Save,
  CheckCircle2,
  Info,
  ShieldCheck,
  MapPin
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { can } = useAuth();
  const [settings, setSettings] = useState<any>({
    companyName: '',
    companyCnpj: '',
    companyAddress: '',
    safetyManager: '',
    googleMapsApiKey: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const deviceId = getDeviceId();
  const deviceDesc = getDeviceDescription();

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.get('/settings');
        setSettings(data);
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.put('/settings', settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Configurações da Empresa & Sistema
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dados para o cabeçalho dos PDFs de APR, chave de API do Google Maps e informações do aparelho
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Settings */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-slate-900 text-sm">Dados da Empresa Emissora de APR</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social / Nome da Empresa</label>
              <input
                type="text"
                value={settings.companyName || ''}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="Ex: Indústria & Engenharia Brasil S.A."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                disabled={!can('settings', 'manage')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ da Empresa</label>
              <input
                type="text"
                value={settings.companyCnpj || ''}
                onChange={(e) => setSettings({ ...settings, companyCnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                disabled={!can('settings', 'manage')}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Operacional / Planta Industrial</label>
              <input
                type="text"
                value={settings.companyAddress || ''}
                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                placeholder="Av. Industrial, 1500 - Distrito Industrial"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                disabled={!can('settings', 'manage')}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável Técnico SST Padrão</label>
              <input
                type="text"
                value={settings.safetyManager || ''}
                onChange={(e) => setSettings({ ...settings, safetyManager: e.target.value })}
                placeholder="Ex: Carlos Mendes - Registro MTE 004128/SP"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                disabled={!can('settings', 'manage')}
              />
            </div>
          </div>
        </div>

        {/* Google Maps API Key Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-slate-900 text-sm">Google Maps API (Opcional)</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chave da Google Maps JavaScript API</label>
            <input
              type="password"
              value={settings.googleMapsApiKey || ''}
              onChange={(e) => setSettings({ ...settings, googleMapsApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              disabled={!can('settings', 'manage')}
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              <strong>Nota sobre o Mapa:</strong> O sistema já possui um mapa interativo completo integrado (OpenStreetMap/Leaflet) que funciona imediatamente sem precisar de chave. Caso queira usar as camadas e satélite do Google Maps, basta colar sua chave da API acima.
            </span>
          </div>
        </div>

        {/* Current Device Audit Info */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Smartphone className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-slate-900 text-sm">Auditoria do Seu Dispositivo Atual</h3>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">ID Único do Aparelho:</span>
              <strong className="font-mono text-amber-800">{deviceId}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Identificação do Navegador/SO:</span>
              <span className="text-slate-800">{deviceDesc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Modo PWA (Offline):</span>
              <span className="text-emerald-700 font-bold">Habilitado (Cache Local & Assinaturas)</span>
            </div>
          </div>
        </div>

        {/* Save button */}
        {can('settings', 'manage') && (
          <div className="flex items-center justify-end gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Configurações salvas com sucesso!
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
