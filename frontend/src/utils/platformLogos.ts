/**
 * Maps platform slugs to SimpleIcons brand identifiers and accent colors.
 * Icon URLs: https://cdn.simpleicons.org/{icon}/ffffff  (white variant)
 *
 * SimpleIcons is open-source (CC0 / MIT) - https://simpleicons.org
 */

export interface PlatformLogo {
  /** SimpleIcons slug  */
  icon: string
  /** Tailwind accent color class for the card glow / tint */
  accent: string
}

const LOGOS: Record<string, PlatformLogo> = {
  // ── Nintendo handhelds & consoles ───────────────────────────────────────────
  nes:         { icon: 'nintendo',         accent: 'text-red-400' },
  snes:        { icon: 'nintendo',         accent: 'text-purple-400' },
  n64:         { icon: 'nintendo',         accent: 'text-blue-400' },
  gamecube:    { icon: 'nintendogamecube', accent: 'text-violet-400' },
  wii:         { icon: 'nintendo',         accent: 'text-gray-300' },
  wiiu:        { icon: 'nintendo',         accent: 'text-sky-400' },
  switch:      { icon: 'nintendoswitch',   accent: 'text-red-400' },
  gb:          { icon: 'nintendo',         accent: 'text-green-400' },
  gbc:         { icon: 'nintendo',         accent: 'text-yellow-400' },
  gba:         { icon: 'nintendo',         accent: 'text-indigo-400' },
  nds:         { icon: 'nintendods',       accent: 'text-red-400' },
  '3ds':       { icon: 'nintendo3ds',      accent: 'text-red-400' },
  virtualboy:  { icon: 'nintendo',         accent: 'text-red-600' },

  // ── PlayStation family ───────────────────────────────────────────────────────
  ps1:         { icon: 'playstation',      accent: 'text-blue-400' },
  ps2:         { icon: 'playstation',      accent: 'text-blue-500' },
  ps3:         { icon: 'playstation',      accent: 'text-slate-400' },
  ps4:         { icon: 'playstation',      accent: 'text-blue-600' },
  ps5:         { icon: 'playstation',      accent: 'text-blue-400' },
  psp:         { icon: 'playstation',      accent: 'text-slate-400' },
  psvita:      { icon: 'playstation',      accent: 'text-indigo-400' },

  // ── Xbox family ─────────────────────────────────────────────────────────────
  xbox:        { icon: 'xbox',             accent: 'text-green-400' },
  xbox360:     { icon: 'xbox',             accent: 'text-green-500' },
  xboxone:     { icon: 'xbox',             accent: 'text-green-400' },
  xboxseries:  { icon: 'xbox',             accent: 'text-green-400' },

  // ── Sega family ─────────────────────────────────────────────────────────────
  mastersystem:{ icon: 'sega',             accent: 'text-blue-400' },
  genesis:     { icon: 'sega',             accent: 'text-gray-300' },
  segacd:      { icon: 'sega',             accent: 'text-zinc-400' },
  sega32x:     { icon: 'sega',             accent: 'text-zinc-300' },
  saturn:      { icon: 'sega',             accent: 'text-gray-400' },
  dreamcast:   { icon: 'sega',             accent: 'text-orange-400' },
  gamegear:    { icon: 'sega',             accent: 'text-blue-300' },

  // ── Atari ───────────────────────────────────────────────────────────────────
  atari2600:   { icon: 'atari',            accent: 'text-amber-400' },
  atari7800:   { icon: 'atari',            accent: 'text-amber-500' },
  atarilynx:   { icon: 'atari',            accent: 'text-amber-400' },
  jaguar:      { icon: 'atari',            accent: 'text-orange-400' },

  // ── SNK / Neo Geo ───────────────────────────────────────────────────────────
  ngp:         { icon: 'snk',              accent: 'text-teal-400' },
  ngpc:        { icon: 'snk',              accent: 'text-teal-400' },
  neogeo:      { icon: 'snk',              accent: 'text-teal-400' },

  // ── Bandai WonderSwan ───────────────────────────────────────────────────────
  ws:          { icon: 'bandai',           accent: 'text-stone-400' },
  wsc:         { icon: 'bandai',           accent: 'text-stone-400' },

  // ── Arcade ──────────────────────────────────────────────────────────────────
  arcade:      { icon: 'arcade',           accent: 'text-amber-400' },

  // ── PC / Other ──────────────────────────────────────────────────────────────
  pc:          { icon: 'steam',            accent: 'text-steam-blue' },
  dos:         { icon: 'windows',          accent: 'text-sky-400' },
}

/**
 * Returns the SimpleIcons CDN URL for a platform slug.
 * Always renders white so it shows on dark backgrounds.
 */
export function getPlatformLogoUrl(slug: string): string | null {
  const entry = LOGOS[slug]
  if (!entry) return null
  return `https://cdn.simpleicons.org/${entry.icon}/ffffff`
}

export function getPlatformAccent(slug: string): string {
  return LOGOS[slug]?.accent ?? 'text-steam-dim'
}
