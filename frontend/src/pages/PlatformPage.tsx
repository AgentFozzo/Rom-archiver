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
      <GameGrid platformId={id} title={platform?.name} />
    </div>
  )
}
