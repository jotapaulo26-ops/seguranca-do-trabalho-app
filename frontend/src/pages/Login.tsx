import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getDeviceId, getDeviceDescription } from '../services/deviceId';
import { FrontalCameraModal } from '../components/FrontalCameraModal';
import { BiometricLoginModal } from '../components/BiometricLoginModal';
import {
  ShieldCheck,
  Lock,
  Mail,
  Smartphone,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Camera,
  UserPlus,
  ArrowLeft,
  Building2,
  Phone,
  User
} from 'lucide-react';

export const Login: React.FC = () => {
  const { setAuthSession } = useAuth();
  const navigate = useNavigate();
  const deviceId = getDeviceId();
  const deviceDesc = getDeviceDescription();

  // Mode: 'login' | 'register' | 'success'
  const [mode, setMode] = useState<'login' | 'register' | 'success'>('login');

  // --- LOGIN FORM STATE ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Biometric validation modal
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [preLoginData, setPreLoginData] = useState<{
    preToken: string;
    userId: string;
    userName: string;
    userEmail: string;
    referencePhotoUrl?: string;
  } | null>(null);

  // --- REGISTER FORM STATE ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPhotoUrl, setRegPhotoUrl] = useState<string | null>(null);
  const [regPhotoModalOpen, setRegPhotoModalOpen] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // 1. Submit Login (Etapa 1: Validação de Credenciais)
  const handlePreLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Preencha seu e-mail e senha de acesso.');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await api.post<{
        success: boolean;
        directLogin?: boolean;
        token?: string;
        user?: any;
        requireFacialEnrollment?: boolean;
        requireFacialValidation?: boolean;
        preToken?: string;
        userId?: string;
        userName?: string;
        userEmail?: string;
        referencePhotoUrl?: string;
      }>('/auth/pre-login', {
        email,
        password,
        deviceId,
        deviceName: deviceDesc
      });

      // Se for Administrador com liberação direta (sem biometria)
      if (res.directLogin && res.token && res.user) {
        setAuthSession(res.token, res.user);
        navigate('/');
        return;
      }

      setPreLoginData(res as any);

      if (res.requireFacialEnrollment) {
        // Conta existente sem foto cadastrada -> cadastrar face
        setIsEnrollModalOpen(true);
      } else if (res.requireFacialValidation && res.referencePhotoUrl) {
        // Abrir câmera frontal para validação facial ao vivo
        setIsBiometricModalOpen(true);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Falha ao validar credenciais.');
    } finally {
      setLoginLoading(false);
    }
  };

  // 2. Concluir Login com Biometria Aprovada (Etapa 2)
  const handleBiometricSuccess = async (score: number) => {
    if (!preLoginData?.preToken) return;

    try {
      const res = await api.post<{
        token: string;
        user: any;
      }>('/auth/biometric-login', {
        preToken: preLoginData.preToken,
        biometricScore: score,
        deviceId,
        deviceName: deviceDesc
      });

      setIsBiometricModalOpen(false);
      setAuthSession(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao emitir acesso biométrico.');
      setIsBiometricModalOpen(false);
    }
  };

  // 3. Concluir Cadastro Facial de Conta Existente (ex: Admin no primeiro acesso)
  const handleEnrollFacialCapture = async (photoDataUrl: string) => {
    if (!preLoginData?.preToken) return;

    try {
      const res = await api.post<{
        token: string;
        user: any;
      }>('/auth/enroll-facial', {
        preToken: preLoginData.preToken,
        photo_url: photoDataUrl,
        deviceId,
        deviceName: deviceDesc
      });

      setIsEnrollModalOpen(false);
      setAuthSession(res.token, res.user);
      navigate('/');
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao registrar biometria facial.');
      setIsEnrollModalOpen(false);
    }
  };

  // 4. Submit Auto-Cadastro de Novo Usuário
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setRegError('Preencha seu nome completo, e-mail e senha.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('As senhas digitadas não coincidem.');
      return;
    }

    if (!regPhotoUrl) {
      setRegError('A captura da biometria facial frontal é obrigatória para o cadastro.');
      return;
    }

    setRegLoading(true);

    try {
      await api.post('/auth/register', {
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment.trim(),
        phone: regPhone.trim(),
        photo_url: regPhotoUrl
      });

      setMode('success');
    } catch (err: any) {
      setRegError(err.message || 'Erro ao registrar cadastro.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-amber-500 items-center justify-center text-3xl shadow-xl shadow-amber-500/20 mb-2.5">
            🛡️
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SegTrabalho</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestão Integrada de Segurança, APRs e Mapa de Riscos
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100">
          {mode === 'login' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Entrar no Sistema</h2>
                  <p className="text-xs text-slate-500">Acesso protegido por Biometria Facial.</p>
                </div>
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{loginError}</span>
                </div>
              )}

              <form onSubmit={handlePreLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Corporativo</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Senha de Acesso</label>
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

                {/* Device trace active */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-0.5">
                    <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                    <span>Dispositivo Seguro & Criptografia</span>
                  </div>
                  <p className="truncate font-mono text-[10px] text-slate-500">
                    ID: {deviceId}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {loginLoading ? (
                    'Verificando credenciais...'
                  ) : (
                    <>
                      <span>Avançar para Biometria Facial</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Solicitar Cadastro Link */}
              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600 mb-2">Não possui conta de acesso ao sistema?</p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setLoginError(null);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <UserPlus className="w-4 h-4 text-amber-600" />
                  Solicitar Cadastro com Biometria
                </button>
              </div>
            </>
          )}

          {mode === 'register' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold text-slate-900">Novo Cadastro</h2>
                <div className="w-6"></div>
              </div>

              <p className="text-xs text-slate-500 mb-4 text-center">
                Preencha seus dados e registre seu rosto frontal para análise e aprovação pelo Administrador.
              </p>

              {regError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nome Completo *</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail Corporativo *</label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="email@empresa.com"
                        className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Setor / Departamento</label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={regDepartment}
                        onChange={(e) => setRegDepartment(e.target.value)}
                        placeholder="Ex: Manutenção / Usina"
                        className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Senha (min. 6 dígitos) *</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Confirmar Senha *</label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Facial Biometrics Capture Section */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-600" />
                      Biometria Facial Frontal *
                    </label>
                    {regPhotoUrl && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Foto Capturada
                      </span>
                    )}
                  </div>

                  {regPhotoUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={regPhotoUrl}
                        alt="Foto Biométrica"
                        className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                      />
                      <div className="flex-1">
                        <p className="text-[11px] text-slate-600">Rosto frontal registrado com sucesso.</p>
                        <button
                          type="button"
                          onClick={() => setRegPhotoModalOpen(true)}
                          className="text-[10px] text-amber-700 font-bold hover:underline mt-0.5"
                        >
                          Tirar outra foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] text-slate-600 mb-2 leading-tight">
                        A foto frontal é obrigatória para habilitar a validação facial de segurança em todos os logins.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRegPhotoModalOpen(true)}
                        className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <Camera className="w-4 h-4" />
                        Tirar Foto Frontal Agora
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 mt-2"
                >
                  {regLoading ? 'Enviando solicitação...' : 'Enviar Cadastro para Aprovação'}
                </button>
              </form>
            </>
          )}

          {mode === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">Solicitação Enviada com Sucesso!</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto mb-6">
                Seu cadastro e biometria facial foram recebidos pela administração. O Administrador irá avaliar suas
                informações e configurar seu perfil de acesso. Assim que for aprovado, seu login estará liberado!
              </p>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all"
              >
                Voltar para a Tela de Login
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Validação Facial no Login (compareFaces) */}
      {isBiometricModalOpen && preLoginData?.referencePhotoUrl && (
        <BiometricLoginModal
          isOpen={isBiometricModalOpen}
          userName={preLoginData.userName}
          referencePhotoUrl={preLoginData.referencePhotoUrl}
          onClose={() => setIsBiometricModalOpen(false)}
          onSuccess={handleBiometricSuccess}
          onFailure={(msg) => setLoginError(msg)}
        />
      )}

      {/* MODAL 2: Cadastro Facial no Primeiro Acesso (Admin / Contas antigas) */}
      {isEnrollModalOpen && (
        <FrontalCameraModal
          isOpen={isEnrollModalOpen}
          title="Cadastrar Biometria Facial Inicial"
          workerName={preLoginData?.userName}
          onClose={() => setIsEnrollModalOpen(false)}
          onCapture={handleEnrollFacialCapture}
        />
      )}

      {/* MODAL 3: Captura de Foto Frontal no Formulário de Cadastro */}
      {regPhotoModalOpen && (
        <FrontalCameraModal
          isOpen={regPhotoModalOpen}
          title="Captura de Foto Biométrica"
          workerName={regName || 'Novo Colaborador'}
          onClose={() => setRegPhotoModalOpen(false)}
          onCapture={(dataUrl) => {
            setRegPhotoUrl(dataUrl);
            setRegPhotoModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
