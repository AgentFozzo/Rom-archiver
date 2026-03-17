import { Link } from 'react-router-dom'
import { Download, ShieldCheck, Star } from 'lucide-react'
import { downloadGameFile, toggleFavorite } from '../api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import type { Game } from '../types'

interface Props {
  game: Game
  selectMode?: boolean
  selected?: boolean
  onSelect?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function GameCard({ game, selectMode, selected, onSelect }: Props) {
  const qc = useQueryClient()

  const favMutation = useMutation({
    mutationFn: () => toggleFavorite(game.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['game', game.id] })
    },
  })

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    downloadGameFile(game.id)
  }

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    favMutation.mutate()
  }

  const handleClick = selectMode
    ? (e: React.MouseEvent) => { e.preventDefault(); onSelect?.() }
    : undefined

  const releaseYear = game.release_date
    ? new Date(game.release_date * 1000).getFullYear()
    : null

  const card = (
    <div
      onClick={handleClick}
      className={clsx(
        'rounded-lg overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover',
        selectMode && 'cursor-pointer',
        selectMode && selected && 'ring-2 ring-steam-blue ring-offset-1 ring-offset-steam-surface',
      )}
    >
      {/* Cover art */}
      <div className="relative aspect-[3/4] bg-steam-card overflow-hidden">
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-steam-surface to-steam-card
                          flex flex-col items-center justify-center gap-3 p-4">
            <div className="text-4xl opacity-20">🎮</div>
            <p className="text-steam-dim text-[10px] text-center line-clamp-2">{game.title}</p>
          </div>
        )}

        {/* Gradient overlay on hover */}
        {!selectMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent
                          opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        )}

        {/* Select checkbox overlay */}
        {selectMode && (
          <div className={clsx(
            'absolute inset-0 flex items-center justify-center transition-colors',
            selected ? 'bg-steam-blue/20' : 'bg-black/10 hover:bg-black/20'
          )}>
            <div className={clsx(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              selected
                ? 'bg-steam-blue border-steam-blue'
                : 'bg-black/40 border-white/60'
            )}>
              {selected && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
          </div>
        )}

        {/* Badges */}
        {game.dat_verified && (
          <div className="absolute top-1.5 right-1.5 bg-steam-verified/90 rounded p-0.5">
            <ShieldCheck size={10} className="text-white" />
          </div>
        )}

        {/* Rating */}
        {game.rating && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm rounded
                          px-1 py-0.5 flex items-center gap-0.5">
            <Star size={8} className="text-yellow-400 fill-yellow-400" />
            <span className="text-white text-[9px] font-medium">
              {(game.rating / 10).toFixed(0)}
            </span>
          </div>
        )}

        {/* Favorite star — always visible when starred, visible on hover when not */}
        {!selectMode && (
          <button
            onClick={handleFav}
            className={clsx(
              'absolute bottom-8 right-1.5 p-1 rounded transition-all',
              game.is_favorite
                ? 'opacity-100 text-yellow-400'
                : 'opacity-0 group-hover:opacity-100 text-white/70 hover:text-yellow-400'
            )}
            title={game.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={14} className={clsx(game.is_favorite && 'fill-yellow-400')} />
          </button>
        )}

        {/* Download button on hover */}
        {!selectMode && (
          <div className="absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100
                          translate-y-1 group-hover:translate-y-0 transition-all duration-200">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-1.5 bg-steam-blue
                         text-white py-1.5 rounded text-xs font-semibold
                         hover:bg-blue-500 active:scale-95 transition-all shadow-glow"
            >
              <Download size={12} />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="py-2 px-0.5">
        <h3 className="text-steam-text text-xs font-medium truncate group-hover:text-white transition-colors">
          {game.title}
        </h3>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-steam-dim text-[10px]">{releaseYear || '—'}</span>
          <span className="text-steam-dim text-[10px]">{formatBytes(game.file_size)}</span>
        </div>
      </div>
    </div>
  )

  if (selectMode) return <div className="group">{card}</div>
  return <Link to={`/game/${game.id}`} className="group block">{card}</Link>
}
