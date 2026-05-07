import { useEffect, useRef, useState } from 'react';

export default function MicLevelBar({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!stream) { setLevel(0); return; }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      setLevel(Math.min(Math.sqrt(sum / buf.length) / 128 * 5, 1));
    };
    tick();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ctx.close();
    };
  }, [stream]);

  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-amber-500 rounded-full"
        style={{ width: `${level * 100}%`, transition: 'width 50ms linear' }}
      />
    </div>
  );
}
