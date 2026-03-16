import { Link } from 'react-router-dom'
import { Download, ShieldCheck, Star } from 'lucide-react'
import clsx from 'clsx'
import type { Game } from '../types'
import { downloadGame } from '../api/client'

interface Props {
  game: Game
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function GameCard({ game }: Props) {
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    downloadGame(game.id)
  }

  const releaseYear = game.release_date
    ? new Date(game.release_date * 1000).getFullYear()
    : null

  const rating = game.rating ? Math.round(game.rating) : null

  return (
    <Link to={`/game/${game.id}`} className="group block">
      <div className="bg-steam-card border border-steam-border rounded-xl overflow-hidden
                      transition-all duration-200 hover:border-steam-accent/50 hover:shadow-card
                      hover:-translate-y-1 hover:bg-steam-card-hover animate-fade-in">
        {/* Cover art */}
        <div className="relative aspect-[3/4] bg-steam-surface overflow-hidden">
          {game.cover_url ? (
            <img
              src={game.cover_url}
              alt={game.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
              <div className="text-5xl opacity-30">🎮</div>
              <p className="text-steam-muted text-xs text-center line-clamp-2 font-medium">
                {game.title}
              </p>
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0
                          group-hover:opacity-100 transition-opacity duration-200" />

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {game.dat_verified && (
              <div className="bg-steam-verified/90 backdrop-blur-sm rounded-md px-1.5 py-0.5
                              flex items-center gap-1" title="DAT Verified">
                <ShieldCheck size={10} className="text-white" />
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            )}
          </div>

          {/* Rating badge */}
          {rating && (
            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded-md
                            px-1.5 py-0.5 flex items-center gap-1">
              <Star size={10} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-medium">{Math.round(rating / 10)}</span>
            </div>
          )}

          {/* Download button on hover */}
          <div className="absolute bottom-0 inset-x-0 p-3 opacity-0 group-hover:opacity-100
                          transition-all duration-200 translate-y-2 group-hover:translate-y-0">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 bg-steam-accent
                         text-steam-bg py-2 rounded-lg text-sm font-semibold
                         hover:bg-steam-accent/90 active:scale-95 transition-transform shadow-glow"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-steam-text text-sm font-semibold truncate leading-tight mb-1">
            {game.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-steam-muted text-xs">
              {releaseYear || game.platform?.name || '—'}
            </span>
            <span className="text-steam-muted text-xs">{formatBytes(game.file_size)}</span>
          </div>
          {game.region && (
            <span className="mt-1 inline-block text-xs text-steam-muted/70 bg-steam-border/50
                             px-1.5 py-0.5 rounded-md">
              {game.region}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
