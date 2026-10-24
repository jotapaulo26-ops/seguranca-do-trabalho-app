import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ActiveIntrusionEvent } from '../types';
import { Phone, MessageSquare, BellRing, MapPin, Check, Volume2, VolumeX, ShieldAlert, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminIntrusionCallModal: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [intrusions, setIntrusions] = useState<ActiveIntrusionEvent[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [sirenSentMap, setSirenSentMap] = useState<Record<string, boolean>>({});
  const [editingPhoneMap, setEditingPhoneMap] = useState<Record<string, string>>({});

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // Check if current logged-in user is an administrator or safety technician
  const isSupervisor = Boolean(
    user &&
    (user.roleId === 'admin' ||
      user.roleId === 'role_admin' ||
      user.roleId === 'sst' ||
      user.roleId === 'role_sst' ||
      (user.roleName || '').toLowerCase().includes('admin') ||
      (user.roleName || '').toLowerCase().includes('técnico') ||
      (user.roleName || '').toLowerCase().includes('supervisor') ||
      (user.roleName || '').toLowerCase().includes('engenh'))
  );

  // Play repeating emergency beep on supervisor's PC
  const playAlertPulse = () => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(550, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  };

  // Poll for active intrusions every 3.5 seconds
  useEffect(() => {
    if (!isSupervisor) return;

    const fetchIntrusions = async () => {
      try {
        const data = await api.get<ActiveIntrusionEvent[]>('/tracking/active-intrusions');
        if (Array.isArray(data)) {
          setIntrusions(data);
        }
      } catch (err) {}
    };

    fetchIntrusions();
    const interval = setInterval(fetchIntrusions, 3500);

    return () => clearInterval(interval);
  }, [isSupervisor]);

  // Handle repeating audio alarm when intrusions are active
  useEffect(() => {
    if (intrusions.length > 0 && !isMuted) {
      playAlertPulse();
      if (!sirenIntervalRef.current) {
        sirenIntervalRef.current = setInterval(playAlertPulse, 2000);
      }
    } else {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
    }

    return () => {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
    };
  }, [intrusions.length, isMuted]);

  // Clean phone string to numeric digits for tel: and wa.me
  const cleanPhoneDigits = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  };

  // Trigger remote siren on worker's device
  const handleTriggerRemoteSiren = async (intrusion: ActiveIntrusionEvent) => {
    try {
      await api.post('/tracking/trigger-remote-alarm', {
        userId: intrusion.userId,
        riskName: intrusion.riskName
      });
      setSirenSentMap((prev) => ({ ...prev, [intrusion.id]: true }));
      setTimeout(() => {
        setSirenSentMap((prev) => ({ ...prev, [intrusion.id]: false }));
      }, 5000);
    } catch (e) {
      alert('Falha ao enviar alarme remoto.');
    }
  };

  // Resolve / dismiss intrusion event
  const handleResolve = async (intrusion: ActiveIntrusionEvent) => {
    try {
      await api.post('/tracking/resolve-intrusion', {
        intrusionId: intrusion.id,
        userId: intrusion.userId
      });
      setIntrusions((prev) => prev.filter((i) => i.id !== intrusion.id));
    } catch (e) {}
  };

  if (!isSupervisor || intrusions.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md w-[92vw] sm:w-[420px] pointer-events-auto animate-in slide-in-from-top-4 duration-300">
      {intrusions.map((intrusion) => {
        const rawPhone = editingPhoneMap[intrusion.id] ?? intrusion.userPhone ?? '';
        const digits = cleanPhoneDigits(rawPhone);
        const formattedTel = digits.length >= 10 && !digits.startsWith('55') ? `+55${digits}` : `+${digits}`;
        const waNumber = digits.length >= 10 && !digits.startsWith('55') ? `55${digits}` : digits;

        const whatsappMessage = `🚨 *ALERTA DE SEGURANÇA OPERACIONAL (SST)*\nOlá *${intrusion.userName}*,\nVocê foi detectado dentro da área de risco restrita *${intrusion.riskName}* sem Permissão de Trabalho (PT) ou autorização válida.\n\n⚠️ *AÇÃO OBRIGATÓRIA:* Saia imediatamente do perímetro da cerca virtual (${intrusion.radius}m) e contate a Supervisão de SST!`;

        const isSirenSent = Boolean(sirenSentMap[intrusion.id]);

        return (
          <div
            key={intrusion.id}
            className="bg-slate-900 border-2 border-red-500 rounded-3xl shadow-2xl p-4.5 text-white ring-4 ring-red-500/30 overflow-hidden relative"
          >
            {/* Flashing Top Banner */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-red-500/30">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-red-600/30 text-red-400 border border-red-500/40">
                  <ShieldAlert className="w-5 h-5 animate-bounce" />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    🚨 INVASÃO DE CERCA VIRTUAL
                  </h4>
                  <p className="text-[10px] text-slate-300 font-medium">
                    Colaborador não autorizado no perímetro
                  </p>
                </div>
              </div>

              {/* Mute Button */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Ativar som de alarme' : 'Silenciar som'}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-red-400 animate-pulse" />}
              </button>
            </div>

            {/* Offender Worker Information */}
            <div className="flex items-start gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 mb-3">
              {intrusion.photo_url ? (
                <img
                  src={intrusion.photo_url}
                  alt={intrusion.userName}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-red-500 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-red-950 text-red-300 font-black text-sm flex items-center justify-center border border-red-700/60 shrink-0">
                  {intrusion.userName.substring(0, 2).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-black text-white truncate">{intrusion.userName}</h5>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                    A {intrusion.distance}m
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {intrusion.userRole} • {intrusion.userDepartment}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-300 font-semibold truncate">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="truncate">Área: {intrusion.riskName} (Raio {intrusion.radius}m)</span>
                </div>
              </div>
            </div>

            {/* Direct Calling & Action Center */}
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {/* BUTTON 1: PC Direct Phone Call (tel:) */}
              <a
                href={digits ? `tel:${formattedTel}` : undefined}
                onClick={(e) => {
                  if (!digits) {
                    e.preventDefault();
                    const inputPhone = prompt('Colaborador sem telefone cadastrado. Digite o número com DDD para discar:');
                    if (inputPhone) {
                      setEditingPhoneMap((prev) => ({ ...prev, [intrusion.id]: inputPhone }));
                      window.open(`tel:${cleanPhoneDigits(inputPhone)}`, '_self');
                    }
                  }
                }}
                className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                  digits
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 active:scale-95'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
                title="Ligar diretamente pelo computador (Phone Link / Teams / Skype / VoIP)"
              >
                <Phone className="w-4 h-4 text-emerald-300 animate-bounce" />
                <span>Ligar no Celular</span>
              </a>

              {/* BUTTON 2: WhatsApp Web Emergency Message / Call */}
              <a
                href={digits ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}` : undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!digits) {
                    e.preventDefault();
                    const inputPhone = prompt('Colaborador sem telefone cadastrado. Digite o número com DDD para chamar no WhatsApp:');
                    if (inputPhone) {
                      const clean = cleanPhoneDigits(inputPhone);
                      const finalWa = clean.startsWith('55') ? clean : `55${clean}`;
                      setEditingPhoneMap((prev) => ({ ...prev, [intrusion.id]: inputPhone }));
                      window.open(`https://wa.me/${finalWa}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
                    }
                  }
                }}
                className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                  digits
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/30 active:scale-95'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
                title="Chamar no WhatsApp Web com mensagem de emergência SST pré-formatada"
              >
                <MessageSquare className="w-4 h-4 text-emerald-200" />
                <span>Chamar WhatsApp</span>
              </a>
            </div>

            {/* Secondary Controls (Remote Siren + Map + Resolve) */}
            <div className="flex items-center gap-1.5">
              {/* BUTTON 3: Trigger Remote Siren on Employee's Phone */}
              <button
                type="button"
                onClick={() => handleTriggerRemoteSiren(intrusion)}
                disabled={isSirenSent}
                className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                  isSirenSent
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-red-700 hover:bg-red-600 text-white shadow-md active:scale-95'
                }`}
                title="Faz o celular do colaborador vibrar e tocar sirene alta de alerta"
              >
                <BellRing className={`w-3.5 h-3.5 ${isSirenSent ? 'text-amber-400' : 'animate-pulse'}`} />
                <span>{isSirenSent ? 'Sirene Enviada!' : 'Tocar Sirene'}</span>
              </button>

              {/* BUTTON 4: View in Map */}
              <button
                type="button"
                onClick={() => navigate(`/mapa?spotId=${intrusion.riskId}&userId=${intrusion.userId}`)}
                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 border border-slate-700 transition-colors"
                title="Localizar a invasão no Mapa de Riscos"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>Ver Mapa</span>
              </button>

              {/* BUTTON 5: Resolve / Dismiss */}
              <button
                type="button"
                onClick={() => handleResolve(intrusion)}
                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] flex items-center gap-1 border border-slate-700 transition-colors"
                title="Marcar alerta como resolvido"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Concluir</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
