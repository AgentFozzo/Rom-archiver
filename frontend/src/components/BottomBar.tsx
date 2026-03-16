import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDownloads } from '../api/client'
import { Download, ArrowDown, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

function formatSpeed(bps: number): string {
  if (bps === 0) return ''
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

export default function BottomBar() {
  const { data: downloads = [] } = useQuery({
    queryKey: ['downloads'],
    queryFn: getDownloads,
    refetchInterval: (q) => {
      const dl = q.state.data ?? []
      return dl.some(d => d.status === 'downloading' || d.status === 'hashing' || d.status === 'moving' || d.status === 'pending')
        ? 1000 : false
    },
  })

  const active = downloads.filter(d =>
    d.status === 'downloading' || d.status === 'hashing' || d.status === 'moving' || d.status === 'pending'
  )
  const completed = downloads.filter(d => d.status === 'complete')
  const errors = downloads.filter(d => d.status === 'error')
  const current = active[0]

  return (
    <div className="h-7 bg-steam-bg-deep border-t border-steam-border flex items-center px-4 gap-4
                    flex-shrink-0 text-xs">
      {/* Active download */}
      {current && (
        <Link to="/downloads" className="flex items-center gap-2 text-steam-text hover:text-white transition-colors min-w-0 flex-1">
          {current.status === 'downloading' ? (
            <ArrowDown size={12} className="text-steam-blue flex-shrink-0 animate-pulse" />
          ) : (
            <Loader2 size={12} className="text-steam-blue flex-shrink-0 animate-spin" />
          )}
          <span className="truncate text-steam-muted">
            {current.status === 'downloading'
              ? `Downloading: ${current.filename || 'ROM'}`
              : current.status === 'hashing'
                ? `Hashing: ${current.filename || 'ROM'}`
                : current.status === 'moving'
                  ? `Organizing: ${current.filename || 'ROM'}`
                  : `Queued: ${current.filename || 'ROM'}`
            }
          </span>

          {current.status === 'downloading' && (
            <>
              <div className="w-32 h-1 bg-steam-border rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full bg-steam-blue rounded-full transition-all duration-300"
                  style={{ width: `${current.progress}%` }}
                />
              </div>
              <span className="text-steam-blue flex-shrink-0">
                {Math.round(current.progress)}%
              </span>
              {current.speed_bps > 0 && (
                <span className="text-steam-dim flex-shrink-0">{formatSpeed(current.speed_bps)}</span>
              )}
            </>
          )}
        </Link>
      )}

      {/* No active download - show summary */}
      {!current && (
        <div className="flex items-center gap-2 text-steam-dim flex-1">
          <Download size={12} />
          <span>No active downloads</span>
        </div>
      )}

      {/* Queue count */}
      {active.length > 1 && (
        <span className="text-steam-dim flex-shrink-0">{active.length} in queue</span>
      )}

      {/* Completed count */}
      {completed.length > 0 && (
        <Link to="/downloads" className="flex items-center gap-1 text-steam-verified hover:text-green-400 transition-colors flex-shrink-0">
          <CheckCircle size={11} />
          <span>{completed.length} done</span>
        </Link>
      )}

      {/* Error count */}
      {errors.length > 0 && (
        <Link to="/downloads" className="flex items-center gap-1 text-steam-danger hover:text-red-400 transition-colors flex-shrink-0">
          <AlertCircle size={11} />
          <span>{errors.length} failed</span>
        </Link>
      )}
    </div>
  )
}
