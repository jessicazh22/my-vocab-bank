// Curated thematic colours for known books — matched case-insensitively on any substring
const CURATED_TAG_COLORS: { match: string; bg: string; text: string; border: string }[] = [
  // Fathoms: The World in a Whale — deep ocean blue
  { match: 'fathom', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  // A Swim in a Pond in the Rain — George Saunders — muted slate-green (rain, grey Russian skies)
  { match: 'swim', bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  { match: 'saunders', bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  { match: 'pond', bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
];

const FALLBACK_TAG_COLORS = [
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30' },
  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' },
];

export function getTagColor(tag: string) {
  const lower = tag.toLowerCase();
  const curated = CURATED_TAG_COLORS.find(c => lower.includes(c.match));
  if (curated) return { bg: curated.bg, text: curated.text, border: curated.border };

  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_TAG_COLORS[Math.abs(hash) % FALLBACK_TAG_COLORS.length];
}
