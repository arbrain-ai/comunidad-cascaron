'use client';

import { useRef, useEffect, useState } from 'react';
import { useMediaDeviceSelect } from '@livekit/components-react';
import { Mic, Video, Volume2, X, Check } from 'lucide-react';

interface InCallSettingsProps {
  onClose: () => void;
}

function DeviceList({
  kind,
  icon: Icon,
  label,
}: {
  kind: MediaDeviceKind;
  icon: React.ElementType;
  label: string;
}) {
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind,
    requestPermissions: false,
  });

  if (devices.length === 0) return <p className="text-xs text-white/60">Activa {label.toLowerCase()} desde los controles de la llamada para autorizar el dispositivo.</p>;

  return (
    <div>
      <label className="text-xs text-white/50 mb-1.5 block font-medium uppercase tracking-wider">
        {label}
      </label>
      {deviceError && <p role="alert" className="text-xs text-amber-200">{deviceError}</p>}
      <div className="space-y-0.5">
        {devices.map((device) => (
          <button
            key={device.deviceId}
            onClick={async () => { setDeviceError(null); try { await setActiveMediaDevice(device.deviceId); } catch { setDeviceError('No se pudo seleccionar el dispositivo. Revisa sus permisos o conecta otro.'); } }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
              device.deviceId === activeDeviceId
                ? 'bg-[#8ab4f8]/10 text-[#8ab4f8]'
                : 'text-white/70 hover:bg-white/5'
            }`}
          >
            {device.deviceId === activeDeviceId ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0 text-[#8ab4f8]" />
            ) : (
              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-white/30" />
            )}
            <span className="truncate">
              {device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function InCallSettings({
  onClose,
}: InCallSettingsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-3 right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 w-[calc(100vw-1rem)] md:w-80 bg-[#2d2e30] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-medium text-white">Configuracion</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-4 max-h-[60vh] md:max-h-80 overflow-y-auto">
        <DeviceList kind="audioinput" icon={Mic} label="Microfono" />
        <DeviceList kind="audiooutput" icon={Volume2} label="Bocina" />
        <DeviceList kind="videoinput" icon={Video} label="Camara" />
      </div>
    </div>
  );
}
