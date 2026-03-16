import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGame, downloadGame, refreshGameMetadata, deleteGame, igdbSearch
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
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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
    setShowMatchModal(false)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-steam-card rounded w-48" />
        <div className="flex gap-8">
          <div className="w-64 aspect-[3/4] bg-steam-card rounded-xl" />
          <div className="flex-1 space-y-4">
            <div className="h-8 bg-steam-card rounded w-2/3" />
            <div className="h-4 bg-steam-card rounded w-1/3" />
            <div className="h-24 bg-steam-card rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="text-center py-20">
        <p className="text-steam-danger text-lg">Game not found</p>
        <Link to="/" className="text-steam-accent text-sm mt-2 inline-block hover:underline">
          ← Back to library
        </Link>
      </div>
    )
  }

  const screenshots = game.screenshots || []
  const genres = game.genres || []

  return (
    <div className="animate-slide-up max-w-6xl mx-auto">
      {/* Back nav */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-steam-muted hover:text-steam-text text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column */}
        <div className="flex-shrink-0 w-full lg:w-64">
          {/* Cover */}
          <div className="relative rounded-xl overflow-hidden bg-steam-card border border-steam-border shadow-card mb-4">
            {game.cover_url ? (
              <img
                src={game.cover_url}
                alt={game.title}
                className="w-full object-cover"
              />
            ) : (
              <div className="aspect-[3/4] flex flex-col items-center justify-center gap-3 p-6">
                <div className="text-6xl opacity-30">🎮</div>
                <p className="text-steam-muted text-sm text-center">{game.title}</p>
              </div>
            )}

            {/* Verified badge */}
            {game.dat_verified && (
              <div className="absolute top-3 right-3 bg-steam-verified/90 backdrop-blur-sm
                              rounded-lg px-2 py-1 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-white" />
                <span className="text-white text-xs font-bold">DAT Verified</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => downloadGame(game.id)}
              className="w-full flex items-center justify-center gap-2 bg-steam-accent text-steam-bg
                         py-3 rounded-xl font-semibold hover:bg-steam-accent/90 active:scale-95
                         transition-all shadow-glow"
            >
              <Download size={18} />
              Download ROM
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMatchSearch(game.dat_title || game.title)
                  setShowMatchModal(true)
                }}
                className="flex items-center justify-center gap-1.5 bg-steam-card border border-steam-border
                           text-steam-muted hover:text-steam-text hover:border-steam-accent/50
                           py-2 rounded-xl text-sm transition-colors"
              >
                <Edit3 size={14} />
                Match
              </button>

              <button
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="flex items-center justify-center gap-1.5 bg-steam-card border border-steam-border
                           text-steam-muted hover:text-steam-text hover:border-steam-accent/50
                           py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={clsx(refreshMutation.isPending && 'animate-spin')} />
                Refresh
              </button>
            </div>

            <button
              onClick={() => {
                if (confirm(`Remove "${game.title}" from library? The ROM file will not be deleted.`)) {
                  deleteMutation.mutate()
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-steam-card border border-steam-border
                         text-steam-danger/70 hover:text-steam-danger hover:border-steam-danger/30
                         py-2 rounded-xl text-sm transition-colors"
            >
              <Trash2 size={14} />
              Remove from Library
            </button>
          </div>

          {/* File info */}
          <div className="mt-4 bg-steam-card border border-steam-border rounded-xl p-4 space-y-3">
            <h4 className="text-steam-text text-xs font-semibold uppercase tracking-wider">File Info</h4>
            <InfoRow label="Filename" value={game.file_name} mono />
            <InfoRow label="Size" value={formatBytes(game.file_size)} />
            {game.region && <InfoRow label="Region" value={game.region} />}
            {game.revision && <InfoRow label="Revision" value={game.revision} />}
            {game.crc32 && <InfoRow label="CRC32" value={game.crc32} mono />}
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 min-w-0">
          {/* Title and meta */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-steam-text mb-2">{game.title}</h1>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              {game.platform && (
                <Link
                  to={`/platform/${game.platform.id}`}
                  className="bg-steam-accent/20 text-steam-accent border border-steam-accent/30
                             px-3 py-1 rounded-full hover:bg-steam-accent/30 transition-colors"
                >
                  {game.platform.name}
                </Link>
              )}
              {game.release_date && (
                <div className="flex items-center gap-1.5 text-steam-muted">
                  <Calendar size={14} />
                  {formatDate(game.release_date)}
                </div>
              )}
              {game.rating && (
                <div className="flex items-center gap-1.5">
                  <Star size={14} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-steam-text font-medium">
                    {(game.rating / 10).toFixed(1)}
                    <span className="text-steam-muted font-normal text-xs">/10</span>
                  </span>
                </div>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {genres.map((g) => (
                  <span key={g} className="text-xs bg-steam-surface border border-steam-border
                                          text-steam-muted px-2.5 py-1 rounded-full">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {game.summary && (
            <div className="mb-6">
              <h3 className="text-steam-text font-semibold mb-2">About</h3>
              <p className="text-steam-muted text-sm leading-relaxed">{game.summary}</p>
            </div>
          )}

          {/* Developer / Publisher */}
          {(game.developer || game.publisher) && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {game.developer && (
                <div className="bg-steam-card border border-steam-border rounded-xl p-4">
                  <p className="text-steam-muted text-xs mb-1">Developer</p>
                  <p className="text-steam-text font-medium text-sm">{game.developer}</p>
                </div>
              )}
              {game.publisher && (
                <div className="bg-steam-card border border-steam-border rounded-xl p-4">
                  <p className="text-steam-muted text-xs mb-1">Publisher</p>
                  <p className="text-steam-text font-medium text-sm">{game.publisher}</p>
                </div>
              )}
            </div>
          )}

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div>
              <h3 className="text-steam-text font-semibold mb-3">Screenshots</h3>
              <div className="relative rounded-xl overflow-hidden bg-steam-card border border-steam-border mb-3">
                <img
                  src={screenshots[screenshotIdx]}
                  alt={`Screenshot ${screenshotIdx + 1}`}
                  className="w-full object-cover"
                />
                {screenshots.length > 1 && (
                  <>
                    <button
                      onClick={() => setScreenshotIdx(i => (i - 1 + screenshots.length) % screenshots.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80
                                 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() => setScreenshotIdx(i => (i + 1) % screenshots.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80
                                 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                      {screenshots.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setScreenshotIdx(i)}
                          className={clsx(
                            'w-2 h-2 rounded-full transition-colors',
                            i === screenshotIdx ? 'bg-white' : 'bg-white/40'
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {screenshots.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {screenshots.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setScreenshotIdx(i)}
                      className={clsx(
                        'flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden border-2 transition-colors',
                        i === screenshotIdx ? 'border-steam-accent' : 'border-steam-border hover:border-steam-accent/50'
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

      {/* IGDB Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setShowMatchModal(false)}>
          <div className="bg-steam-surface border border-steam-border rounded-2xl w-full max-w-xl shadow-card
                          animate-slide-up"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-steam-border">
              <h3 className="text-steam-text font-semibold">Match Game to IGDB</h3>
              <button onClick={() => setShowMatchModal(false)} className="text-steam-muted hover:text-steam-text">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={matchSearch}
                  onChange={e => setMatchSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleIGDBSearch()}
                  placeholder="Search IGDB..."
                  className="flex-1 bg-steam-card border border-steam-border text-steam-text rounded-lg
                             px-4 py-2.5 text-sm focus:outline-none focus:border-steam-accent"
                  autoFocus
                />
                <button
                  onClick={handleIGDBSearch}
                  disabled={matchLoading}
                  className="bg-steam-accent text-steam-bg px-4 py-2.5 rounded-lg text-sm font-medium
                             hover:bg-steam-accent/90 disabled:opacity-50 transition-colors"
                >
                  {matchLoading ? '…' : 'Search'}
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {matchResults.map(r => (
                  <button
                    key={r.igdb_id}
                    onClick={() => handleMatchSelect(r)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-steam-card
                               border border-transparent hover:border-steam-border text-left transition-colors"
                  >
                    {r.cover_url ? (
                      <img src={r.cover_url} alt={r.title} className="w-10 aspect-[3/4] object-cover rounded-lg" />
                    ) : (
                      <div className="w-10 aspect-[3/4] bg-steam-card rounded-lg flex items-center justify-center text-lg">🎮</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-steam-text text-sm font-medium">{r.title}</p>
                      <p className="text-steam-muted text-xs">
                        {r.release_date ? new Date(r.release_date * 1000).getFullYear() : ''}
                        {r.rating ? ` · ${(r.rating / 10).toFixed(1)}/10` : ''}
                      </p>
                    </div>
                  </button>
                ))}
                {matchResults.length === 0 && matchSearch && !matchLoading && (
                  <p className="text-steam-muted text-sm text-center py-6">
                    No results. Try a different search term.
                  </p>
                )}
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
      <p className="text-steam-muted text-xs mb-0.5">{label}</p>
      <p className={clsx('text-steam-text text-xs break-all', mono && 'font-mono')}>{value}</p>
    </div>
  )
}
