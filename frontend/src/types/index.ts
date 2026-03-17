export interface Platform {
  id: number
  name: string
  slug: string
  igdb_id?: number
  cover_url?: string
  game_count: number
}

export interface Game {
  id: number
  title: string
  file_name: string
  file_path: string
  file_size: number
  platform_id: number
  platform?: Platform
  igdb_id?: number
  cover_url?: string
  summary?: string
  rating?: number
  release_date?: number
  genres?: string[]
  developer?: string
  publisher?: string
  screenshots?: string[]
  region?: string
  revision?: string
  crc32?: string
  md5?: string
  sha1?: string
  dat_verified: boolean
  dat_title?: string
  created_at?: string
}

export interface GamesResponse {
  total: number
  page: number
  limit: number
  games: Game[]
}

export interface ScanStatus {
  running: boolean
  progress: number
  total: number
  current_file: string
  found: number
  updated: number
  errors: number
}

export interface DatFile {
  id: number
  name: string
  platform_id?: number
  entry_count: number
  imported_at?: string
}

export interface Settings {
  igdb_client_id: string
  igdb_client_secret: string
  rom_path: string
  auto_scan_on_start: boolean
  download_images: boolean
}

export interface Stats {
  total_games: number
  total_platforms: number
  verified_games: number
  total_size_bytes: number
}

export interface IGDBSearchResult {
  igdb_id: number
  title: string
  cover_url?: string
  summary?: string
  rating?: number
  release_date?: number
  genres?: string[]
}

export type ExtraType = 'mod' | 'update' | 'dlc' | 'cheat' | 'other'

export interface GameExtra {
  id: number
  game_id: number
  filename: string
  file_size: number
  extra_type: ExtraType
  description?: string
  uploaded_at?: string
}

export interface Download {
  id: number
  url: string
  filename?: string
  status: 'pending' | 'downloading' | 'hashing' | 'moving' | 'complete' | 'error'
  progress: number
  total_bytes?: number
  downloaded_bytes: number
  speed_bps: number
  platform_slug?: string
  game_id?: number
  extra_type?: ExtraType
  target_game_id?: number
  error?: string
  created_at?: string
  completed_at?: string
}

export interface PlatformOption {
  slug: string
  name: string
}

export interface BiosFile {
  id: number
  filename: string
  platform_slug: string
  category: string
  file_size: number
  md5?: string
  sha1?: string
  description?: string
  verified: boolean
  uploaded_at?: string
}

export interface BiosPlatformInfo {
  slug: string
  name: string
  needs: string[]
  emulators: string[]
  uploaded_count: number
}
