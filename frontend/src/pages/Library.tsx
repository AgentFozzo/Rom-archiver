import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { getGames, getStats, getPlatforms } from '../api/client'
import GameShelf from '../components/GameShelf'
import GameGrid from '../components/GameGrid'
import { Gamepad2, Database, ShieldCheck, HardDrive, Star } from 'lucide-react'
import type { Game } from '../types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function Library() {
  const [searchParams] = useSearchParams()
  const search = searchParams.get('search') || undefined

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 30_000,
  })

  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms'],
    queryFn: getPlatforms,
    staleTime: 60_000,
  })

  // Recent games (sorted by created_at)
  const { data: recentData } = useQuery({
    queryKey: ['games', 'recent'],
    queryFn: () => getGames({ sort: 'title', order: 'desc', limit: 20 }),
    staleTime: 30_000,
  })

  // Top rated games
  const { data: topRatedData } = useQuery({
    queryKey: ['games', 'top-rated'],
    queryFn: () => getGames({ sort: 'rating', order: 'desc', limit: 20 }),
    staleTime: 30_000,
  })

  // Favorites
  const { data: favData } = useQuery({
    queryKey: ['games', 'favorites'],
    queryFn: () => getGames({ favorites_only: true, sort: 'title', limit: 20 }),
    staleTime: 30_000,
  })

  // Per-platform shelves (top 3 platforms with games)
  const topPlatforms = platforms.filter(p => p.game_count > 0).slice(0, 4)

  const platformQueries = useQueries({
    queries: topPlatforms.map(p => ({
      queryKey: ['games', 'platform-shelf', p.id],
      queryFn: () => getGames({ platform_id: p.id, sort: 'rating', order: 'desc', limit: 15 }),
      staleTime: 60_000,
    })),
  })

  // If searching, show grid
  if (search) {
    return <GameGrid search={search} title={`Search: "${search}"`} />
  }

  const recentGames = recentData?.games ?? []
  const topRated = topRatedData?.games ?? []
  const favorites = favData?.games ?? []

  return (
    <div className="animate-fade-in pb-8">
      {/* Hero stats bar */}
      {stats && stats.total_games > 0 && (
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <StatPill icon={<Gamepad2 size={13} />} value={stats.total_games} label="Games" color="text-steam-blue" />
            <StatPill icon={<Database size={13} />} value={stats.total_platforms} label="Platforms" color="text-purple-400" />
            <StatPill icon={<ShieldCheck size={13} />} value={stats.verified_games} label="Verified" color="text-steam-verified" />
            <StatPill icon={<HardDrive size={13} />} value={formatBytes(stats.total_size_bytes)} label="Total" color="text-orange-400" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats && stats.total_games === 0 && (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-steam-card flex items-center justify-center">
            <Gamepad2 size={32} className="text-steam-dim" />
          </div>
          <div className="text-center">
            <h2 className="text-steam-text text-lg font-semibold mb-1">Welcome to ROM Archiver</h2>
            <p className="text-steam-muted text-sm">
              Click the scan button in the top-right to scan your ROM library,<br />
              or go to Downloads to add ROMs by URL.
            </p>
          </div>
        </div>
      )}

      {/* Favorites shelf */}
      {favorites.length > 0 && (
        <GameShelf
          title="Favorites"
          games={favorites}
          headerExtra={
            <Link
              to="/favorites"
              className="text-steam-dim hover:text-steam-blue text-[10px] transition-colors flex items-center gap-1"
            >
              <Star size={10} className="text-yellow-400 fill-yellow-400" />
              View all
            </Link>
          }
        />
      )}

      {/* Recent Games shelf */}
      <GameShelf title="Recent Games" games={recentGames} large />

      {/* Top Rated shelf */}
      {topRated.filter(g => g.rating).length > 0 && (
        <GameShelf title="Top Rated" games={topRated.filter(g => g.rating)} />
      )}

      {/* Platform shelves */}
      {topPlatforms.map((p, i) => {
        const games = platformQueries[i]?.data?.games ?? []
        return <GameShelf key={p.id} title={p.name} games={games} />
      })}
    </div>
  )
}

function StatPill({ icon, value, label, color }: {
  icon: React.ReactNode
  value: number | string
  label: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={color}>{icon}</span>
      <span className="text-steam-text text-sm font-bold">{value}</span>
      <span className="text-steam-dim text-xs">{label}</span>
    </div>
  )
}
