import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStats } from '../api/client'
import GameGrid from '../components/GameGrid'
import { Database, Gamepad2, ShieldCheck, HardDrive } from 'lucide-react'

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

  return (
    <div className="animate-fade-in">
      {/* Stats bar - only show when not searching */}
      {!search && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Gamepad2 size={20} className="text-steam-accent" />}
            label="Total Games"
            value={stats.total_games.toLocaleString()}
          />
          <StatCard
            icon={<Database size={20} className="text-purple-400" />}
            label="Platforms"
            value={stats.total_platforms.toLocaleString()}
          />
          <StatCard
            icon={<ShieldCheck size={20} className="text-steam-verified" />}
            label="DAT Verified"
            value={stats.verified_games.toLocaleString()}
          />
          <StatCard
            icon={<HardDrive size={20} className="text-orange-400" />}
            label="Total Size"
            value={formatBytes(stats.total_size_bytes)}
          />
        </div>
      )}

      <GameGrid
        search={search}
        title={search ? `Search: "${search}"` : 'All Games'}
      />
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-steam-card border border-steam-border rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-steam-surface flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-steam-muted text-xs font-medium">{label}</p>
        <p className="text-steam-text text-xl font-bold">{value}</p>
      </div>
    </div>
  )
}
