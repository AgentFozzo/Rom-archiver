import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPlatform } from '../api/client'
import GameGrid from '../components/GameGrid'

export default function PlatformPage() {
  const { platformId } = useParams<{ platformId: string }>()
  const id = Number(platformId)

  const { data: platform } = useQuery({
    queryKey: ['platform', id],
    queryFn: () => getPlatform(id),
    enabled: !!id,
  })

  return (
    <div className="animate-fade-in">
      {/* Platform header */}
      {platform && (
        <div className="flex items-center gap-4 mb-8">
          {platform.cover_url ? (
            <img
              src={platform.cover_url}
              alt={platform.name}
              className="w-16 h-16 object-contain rounded-xl bg-steam-card border border-steam-border p-2"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-steam-card border border-steam-border flex items-center justify-center text-3xl">
              🎮
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-steam-text">{platform.name}</h1>
            <p className="text-steam-muted text-sm mt-0.5">
              {platform.game_count.toLocaleString()} game{platform.game_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      <GameGrid platformId={id} title={platform?.name} />
    </div>
  )
}
