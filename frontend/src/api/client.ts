import type {
  Platform, Game, GamesResponse, ScanStatus, DatFile,
  Settings, Stats, IGDBSearchResult, Download, PlatformOption,
  BiosFile, BiosPlatformInfo
} from '../types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json()
}

// Platforms
export const getPlatforms = () => request<Platform[]>('/platforms')
export const getPlatform = (id: number) => request<Platform>(`/platforms/${id}`)

// Games
export const getGames = (params: {
  platform_id?: number
  search?: string
  sort?: string
  order?: string
  page?: number
  limit?: number
}) => {
  const qs = new URLSearchParams()
  if (params.platform_id) qs.set('platform_id', String(params.platform_id))
  if (params.search) qs.set('search', params.search)
  if (params.sort) qs.set('sort', params.sort)
  if (params.order) qs.set('order', params.order)
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  return request<GamesResponse>(`/games?${qs}`)
}

export const getGame = (id: number) => request<Game>(`/games/${id}`)

export const updateGame = (id: number, data: Partial<Game>) =>
  request<Game>(`/games/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deleteGame = (id: number) =>
  request<{ ok: boolean }>(`/games/${id}`, { method: 'DELETE' })

export const refreshGameMetadata = (id: number) =>
  request<Game>(`/games/${id}/refresh`, { method: 'POST' })

export const downloadGameFile = (id: number) => {
  window.location.href = `/api/games/${id}/download`
}

// Scanner
export const startScan = () =>
  request<{ message: string }>('/scan', { method: 'POST' })

export const getScanStatus = () => request<ScanStatus>('/scan/status')

// DATs
export const getDats = () => request<DatFile[]>('/dats')

export const importDats = (files: File[]) => {
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }
  return request<DatFile[]>('/dats/import', { method: 'POST', body: form })
}

export const deleteDat = (id: number) =>
  request<{ ok: boolean }>(`/dats/${id}`, { method: 'DELETE' })

// Settings
export const getSettings = () => request<Settings>('/settings')
export const updateSettings = (data: Settings) =>
  request<{ ok: boolean }>('/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

// Stats
export const getStats = () => request<Stats>('/stats')

// IGDB
export const igdbSearch = (q: string, platform_igdb_id?: number) => {
  const qs = new URLSearchParams({ q })
  if (platform_igdb_id) qs.set('platform_igdb_id', String(platform_igdb_id))
  return request<IGDBSearchResult[]>(`/igdb/search?${qs}`)
}

// Downloads (ROM Download Manager)
export const getDownloads = () => request<Download[]>('/downloads')

export const createDownload = (url: string, platform_slug?: string) =>
  request<Download>('/downloads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, platform_slug }),
  })

export const deleteDownload = (id: number) =>
  request<{ ok: boolean }>(`/downloads/${id}`, { method: 'DELETE' })

export const getPlatformOptions = () => request<PlatformOption[]>('/downloads/platforms')

// BIOS / System Files
export const getBiosFiles = (platform_slug?: string) => {
  const qs = platform_slug ? `?platform_slug=${platform_slug}` : ''
  return request<BiosFile[]>(`/bios${qs}`)
}

export const getBiosPlatforms = () => request<BiosPlatformInfo[]>('/bios/platforms')

export const uploadBiosFiles = (files: File[], platform_slug?: string) => {
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }
  const qs = platform_slug ? `?platform_slug=${platform_slug}` : ''
  return request<BiosFile[]>(`/bios/upload${qs}`, { method: 'POST', body: form })
}

export const downloadBiosFile = (id: number) => {
  window.location.href = `/api/bios/${id}/download`
}

export const deleteBiosFile = (id: number) =>
  request<{ ok: boolean }>(`/bios/${id}`, { method: 'DELETE' })
