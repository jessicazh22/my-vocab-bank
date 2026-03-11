import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'square' | 'star';
}

const CELEBRATION_COLORS = [
  '#FFB347', // warm orange
  '#FF6B6B', // coral red
  '#FFE66D', // golden yellow
  '#FF8E72', // salmon
  '#FFA07A', // light salmon
  '#FFCC5C', // sunflower
];

function createParticle(id: number, originX: number, originY: number): Particle {
  const angle = (Math.random() * Math.PI * 2);
  const velocity = 4 + Math.random() * 6;
  const shapes: Particle['shape'][] = ['circle', 'square', 'star'];

  return {
    id,
    x: originX,
    y: originY,
    color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
    size: 4 + Math.random() * 6,
    velocityX: Math.cos(angle) * velocity,
    velocityY: Math.sin(angle) * velocity - 3,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 20,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  };
}

interface ConfettiProps {
  active: boolean;
  originX?: number;
  originY?: number;
  particleCount?: number;
  onComplete?: () => void;
}

export default function Confetti({
  active,
  originX = window.innerWidth / 2,
  originY = window.innerHeight / 2,
  particleCount = 24,
  onComplete
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    const newParticles = Array.from({ length: particleCount }, (_, i) =>
      createParticle(i, originX, originY)
    );
    setParticles(newParticles);

    let frame: number;
    let elapsed = 0;
    const duration = 1200;

    const animate = () => {
      elapsed += 16;

      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.velocityX,
        y: p.y + p.velocityY,
        velocityY: p.velocityY + 0.15,
        velocityX: p.velocityX * 0.99,
        rotation: p.rotation + p.rotationSpeed,
      })));

      if (elapsed < duration) {
        frame = requestAnimationFrame(animate);
      } else {
        setParticles([]);
        onComplete?.();
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, originX, originY, particleCount, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <svg className="w-full h-full">
        {particles.map((p) => {
          const opacity = Math.max(0, 1 - (p.y - originY) / 300);

          if (p.shape === 'circle') {
            return (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r={p.size / 2}
                fill={p.color}
                opacity={opacity}
              />
            );
          }

          if (p.shape === 'square') {
            return (
              <rect
                key={p.id}
                x={p.x - p.size / 2}
                y={p.y - p.size / 2}
                width={p.size}
                height={p.size}
                fill={p.color}
                opacity={opacity}
                transform={`rotate(${p.rotation} ${p.x} ${p.y})`}
              />
            );
          }

          const starPoints = Array.from({ length: 5 }, (_, i) => {
            const angle = (i * 72 - 90) * (Math.PI / 180);
            const outerX = p.x + Math.cos(angle) * p.size;
            const outerY = p.y + Math.sin(angle) * p.size;
            const innerAngle = angle + 36 * (Math.PI / 180);
            const innerX = p.x + Math.cos(innerAngle) * (p.size * 0.4);
            const innerY = p.y + Math.sin(innerAngle) * (p.size * 0.4);
            return `${outerX},${outerY} ${innerX},${innerY}`;
          }).join(' ');

          return (
            <polygon
              key={p.id}
              points={starPoints}
              fill={p.color}
              opacity={opacity}
              transform={`rotate(${p.rotation} ${p.x} ${p.y})`}
            />
          );
        })}
      </svg>
    </div>
  );
}
