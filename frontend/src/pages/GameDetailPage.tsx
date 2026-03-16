import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGame, downloadGameFile, refreshGameMetadata, deleteGame, igdbSearch
} from '../api/client'
import {
  Download, RefreshCw, Trash2, Star, Calendar, HardDrive,
  ShieldCheck, ArrowLeft, ChevronLeft, ChevronRight, X, Edit3
} from 'lucide-react'
import clsx from 'clsx'
import type { IGDBSearchResult } from '../types'

function formatBytes(bytes: number): string {
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const id = Number(gameId)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [screenshotIdx, setScreenshotIdx] = useState(0)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchSearch, setMatchSearch] = useState('')
  const [matchResults, setMatchResults] = useState<IGDBSearchResult[]>([])
  const [matchLoading, setMatchLoading] = useState(false)

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: () => getGame(id),
    enabled: !!id,
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshGameMetadata(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game', id] })
      qc.invalidateQueries({ queryKey: ['games'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteGame(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['platforms'] })
      navigate('/')
    },
  })

  const handleIGDBSearch = async () => {
    if (!matchSearch.trim()) return
    setMatchLoading(true)
    try {
      const results = await igdbSearch(matchSearch, game?.platform?.igdb_id)
      setMatchResults(results)
    } finally {
      setMatchLoading(false)
    }
  }

  const handleMatchSelect = async (result: IGDBSearchResult) => {
    const { updateGame } = await import('../api/client')
    await updateGame(id, {
      igdb_id: result.igdb_id,
      title: result.title,
      cover_url: result.cover_url || undefined,
      summary: result.summary || undefined,
      rating: result.rating || undefined,
      release_date: result.release_date || undefined,
      genres: result.genres || [],
    })
    qc.invalidateQueries({ queryKey: ['game', id] })
    qc.invalidateQueries({ queryKey: ['games'] })
    setShowMatchModal(false)
  }

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-6 bg-steam-card rounded w-32" />
        <div className="flex gap-6">
          <div className="w-56 aspect-[3/4] bg-steam-card rounded-lg" />
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-steam-card rounded w-2/3" />
            <div className="h-4 bg-steam-card rounded w-1/3" />
            <div className="h-20 bg-steam-card rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="text-center py-16">
        <p className="text-steam-danger text-sm">Game not found</p>
        <Link to="/" className="text-steam-blue text-xs mt-2 inline-block hover:underline">
          Back to library
        </Link>
      </div>
    )
  }

  const screenshots = game.screenshots || []
  const genres = game.genres || []

  return (
    <div className="animate-slide-up">
      {/* Hero area with background */}
      <div className="relative">
        {/* Blurred background from screenshot or cover */}
        {(screenshots[0] || game.cover_url) && (
          <div className="absolute inset-0 h-64 overflow-hidden">
            <img
              src={screenshots[0] || game.cover_url}
              className="w-full h-full object-cover blur-2xl opacity-20 scale-110"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-steam-surface" />
          </div>
        )}

        <div className="relative px-6 pt-4 pb-6 max-w-5xl">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-steam-muted hover:text-white text-xs
                       transition-colors mb-4"
          >
            <ArrowLeft size={13} />
            Back
          </button>

          <div className="flex gap-6">
            {/* Cover */}
            <div className="flex-shrink-0 w-56">
              <div className="relative rounded-lg overflow-hidden shadow-card">
                {game.cover_url ? (
                  <img src={game.cover_url} alt={game.title} className="w-full" />
                ) : (
                  <div className="aspect-[3/4] bg-steam-card flex items-center justify-center">
                    <span className="text-5xl opacity-20">🎮</span>
                  </div>
                )}
                {game.dat_verified && (
                  <div className="absolute top-2 right-2 bg-steam-verified/90 rounded px-1.5 py-0.5
                                  flex items-center gap-1">
                    <ShieldCheck size={10} className="text-white" />
                    <span className="text-white text-[9px] font-bold">Verified</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-3 space-y-1.5">
                <button
                  onClick={() => downloadGameFile(game.id)}
                  className="w-full flex items-center justify-center gap-2 bg-steam-green
                             hover:bg-steam-green-light/20 border border-steam-green-light/30
                             text-steam-green-light py-2.5 rounded text-sm font-bold
                             active:scale-95 transition-all"
                >
                  <Download size={15} />
                  Download ROM
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      setMatchSearch(game.dat_title || game.title)
                      setShowMatchModal(true)
                    }}
                    className="flex items-center justify-center gap-1 bg-steam-bg-deep border
                               border-steam-border text-steam-muted hover:text-white
                               py-1.5 rounded text-xs transition-colors"
                  >
                    <Edit3 size={11} /> Match
                  </button>
                  <button
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="flex items-center justify-center gap-1 bg-steam-bg-deep border
                               border-steam-border text-steam-muted hover:text-white
                               py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={clsx(refreshMutation.isPending && 'animate-spin')} />
                    Refresh
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Remove "${game.title}" from library?`)) deleteMutation.mutate()
                  }}
                  className="w-full flex items-center justify-center gap-1 text-steam-dim
                             hover:text-steam-danger py-1.5 rounded text-xs transition-colors"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </div>

              {/* File info */}
              <div className="mt-3 bg-steam-bg-deep border border-steam-border rounded-lg p-3 space-y-2">
                <InfoRow label="File" value={game.file_name} mono />
                <InfoRow label="Size" value={formatBytes(game.file_size)} />
                {game.region && <InfoRow label="Region" value={game.region} />}
                {game.crc32 && <InfoRow label="CRC32" value={game.crc32} mono />}
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white mb-2">{game.title}</h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
                {game.platform && (
                  <Link
                    to={`/platform/${game.platform.id}`}
                    className="text-steam-blue hover:text-blue-300 transition-colors"
                  >
                    {game.platform.name}
                  </Link>
                )}
                {game.release_date && (
                  <span className="text-steam-muted flex items-center gap-1">
                    <Calendar size={11} /> {formatDate(game.release_date)}
                  </span>
                )}
                {game.rating && (
                  <span className="flex items-center gap-1">
                    <Star size={11} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-medium">
                      {(game.rating / 10).toFixed(1)}/10
                    </span>
                  </span>
                )}
              </div>

              {/* Genres */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {genres.map((g) => (
                    <span key={g} className="text-[10px] bg-steam-blue/10 text-steam-blue border
                                             border-steam-blue/20 px-2 py-0.5 rounded-full">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Summary */}
              {game.summary && (
                <div className="mb-5">
                  <p className="text-steam-muted text-sm leading-relaxed">{game.summary}</p>
                </div>
              )}

              {/* Dev/Publisher */}
              {(game.developer || game.publisher) && (
                <div className="flex gap-6 mb-5 text-xs">
                  {game.developer && (
                    <div>
                      <span className="text-steam-dim uppercase tracking-wider block mb-0.5">Developer</span>
                      <span className="text-steam-text">{game.developer}</span>
                    </div>
                  )}
                  {game.publisher && (
                    <div>
                      <span className="text-steam-dim uppercase tracking-wider block mb-0.5">Publisher</span>
                      <span className="text-steam-text">{game.publisher}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Screenshots */}
              {screenshots.length > 0 && (
                <div>
                  <div className="relative rounded-lg overflow-hidden bg-black mb-2">
                    <img
                      src={screenshots[screenshotIdx]}
                      alt={`Screenshot ${screenshotIdx + 1}`}
                      className="w-full object-cover"
                    />
                    {screenshots.length > 1 && (
                      <>
                        <button
                          onClick={() => setScreenshotIdx(i => (i - 1 + screenshots.length) % screenshots.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80
                                     text-white p-1.5 rounded-full transition-colors"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => setScreenshotIdx(i => (i + 1) % screenshots.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80
                                     text-white p-1.5 rounded-full transition-colors"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  {screenshots.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                      {screenshots.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setScreenshotIdx(i)}
                          className={clsx(
                            'flex-shrink-0 w-20 aspect-video rounded overflow-hidden border transition-colors',
                            i === screenshotIdx ? 'border-steam-blue' : 'border-transparent opacity-50 hover:opacity-100'
                          )}
                        >
                          <img src={s} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* IGDB Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setShowMatchModal(false)}>
          <div className="bg-steam-surface border border-steam-border rounded-xl w-full max-w-xl shadow-card
                          animate-slide-up"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-steam-border">
              <h3 className="text-white text-sm font-semibold">Match to IGDB</h3>
              <button onClick={() => setShowMatchModal(false)} className="text-steam-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={matchSearch}
                  onChange={e => setMatchSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleIGDBSearch()}
                  placeholder="Search IGDB..."
                  className="flex-1 bg-steam-bg-deep border border-steam-border text-steam-text
                             rounded px-3 py-2 text-sm focus:outline-none focus:border-steam-blue/50"
                  autoFocus
                />
                <button
                  onClick={handleIGDBSearch}
                  disabled={matchLoading}
                  className="bg-steam-blue text-white px-4 py-2 rounded text-sm font-medium
                             hover:bg-blue-500 disabled:opacity-50"
                >
                  {matchLoading ? '...' : 'Search'}
                </button>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {matchResults.map(r => (
                  <button
                    key={r.igdb_id}
                    onClick={() => handleMatchSelect(r)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5
                               text-left transition-colors"
                  >
                    {r.cover_url ? (
                      <img src={r.cover_url} alt="" className="w-8 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-8 h-10 bg-steam-card rounded flex items-center justify-center text-xs">🎮</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{r.title}</p>
                      <p className="text-steam-dim text-xs">
                        {r.release_date ? new Date(r.release_date * 1000).getFullYear() : ''}
                        {r.rating ? ` · ${(r.rating / 10).toFixed(1)}/10` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-steam-dim text-[10px] uppercase tracking-wider">{label}</span>
      <p className={clsx('text-steam-text text-xs break-all mt-0.5', mono && 'font-mono')}>{value}</p>
    </div>
  )
}
