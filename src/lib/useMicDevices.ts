import { useState, useEffect, useRef, useCallback } from 'react';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export function useMicDevices(enabled = true) {
  const [devices, setDevices]           = useState<AudioInputDevice[]>([]);
  const [selectedId, setSelectedId]     = useState('');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [deviceError, setDeviceError]   = useState<string | null>(null);
  const previewRef = useRef<MediaStream | null>(null);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      // Null out onended before stopping so programmatic stop doesn't fire the
      // disconnect error handler.
      previewRef.current.getAudioTracks().forEach(t => { t.onended = null; t.stop(); });
      previewRef.current = null;
    }
    setPreviewStream(null);
  }, []);

  const startPreview = useCallback((deviceId: string) => {
    if (previewRef.current) {
      previewRef.current.getAudioTracks().forEach(t => { t.onended = null; t.stop(); });
      previewRef.current = null;
    }
    setPreviewStream(null);

    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: deviceId } } })
      .then(stream => {
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.onended = () => {
            // Only fire if this stream is still the active preview (not stopped intentionally)
            if (previewRef.current === stream) {
              setDeviceError('Microphone disconnected — select another input');
              previewRef.current = null;
              setPreviewStream(null);
            }
          };
        }
        previewRef.current = stream;
        setPreviewStream(stream);
        setDeviceError(null);
      })
      .catch(() => setDeviceError('Could not open selected microphone'));
  }, []);

  const enumerate = useCallback(async () => {
    try {
      // getUserMedia needed on first call to unlock device labels in the browser
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach(t => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioInputDevice[] = all
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(0, 8)})`,
        }));

      setDevices(inputs);
      setSelectedId(prev => prev || inputs[0]?.deviceId || '');
    } catch {
      setDeviceError('Microphone permission denied');
    }
  }, []);

  useEffect(() => {
    if (!enabled || !navigator.mediaDevices) return;
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', enumerate);
      stopPreview();
    };
  }, [enabled, enumerate, stopPreview]);

  // Start preview whenever selection changes (only when enabled)
  useEffect(() => {
    if (enabled && selectedId) startPreview(selectedId);
  }, [enabled, selectedId, startPreview]);

  return { devices, selectedId, setSelectedId, previewStream, deviceError, stopPreview, startPreview };
}
