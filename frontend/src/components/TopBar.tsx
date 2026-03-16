import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { startScan, getScanStatus } from '../api/client'
import clsx from 'clsx'

export default function TopBar() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: scanStatus } = useQuery({
    queryKey: ['scan-status'],
    queryFn: getScanStatus,
    refetchInterval: (q) => q.state.data?.running ? 1000 : false,
  })

  const scanMutation = useMutation({
    mutationFn: startScan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-status'] }),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/?search=${encodeURIComponent(search.trim())}`)
    } else {
      navigate('/')
    }
  }

  const isScanning = scanStatus?.running ?? false
  const pct = scanStatus && scanStatus.total > 0
    ? Math.round((scanStatus.progress / scanStatus.total) * 100)
    : 0

  return (
    <header className="bg-steam-surface border-b border-steam-border px-6 py-3 flex items-center gap-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-lg">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games..."
            className="w-full bg-steam-card border border-steam-border rounded-lg pl-9 pr-4 py-2 text-sm
                       text-steam-text placeholder-steam-muted focus:outline-none focus:border-steam-accent
                       focus:ring-1 focus:ring-steam-accent transition-colors"
          />
        </div>
      </form>

      {/* Scan status */}
      {isScanning && (
        <div className="flex items-center gap-3 bg-steam-card border border-steam-border rounded-lg px-4 py-2 min-w-64">
          <Loader2 size={16} className="text-steam-accent animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-steam-text font-medium truncate max-w-32">
                {scanStatus?.current_file || 'Scanning…'}
              </span>
              <span className="text-steam-accent ml-2 flex-shrink-0">{pct}%</span>
            </div>
            <div className="h-1 bg-steam-border rounded-full overflow-hidden">
              <div
                className="h-full bg-steam-accent rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {!isScanning && scanStatus && scanStatus.total > 0 && (
        <div className="flex items-center gap-2 text-xs text-steam-muted">
          <CheckCircle size={14} className="text-steam-verified" />
          <span>
            Last scan: {scanStatus.found} found, {scanStatus.errors > 0 && (
              <span className="text-steam-danger">{scanStatus.errors} errors</span>
            )}
          </span>
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={() => scanMutation.mutate()}
        disabled={isScanning || scanMutation.isPending}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
          isScanning || scanMutation.isPending
            ? 'bg-steam-card text-steam-muted cursor-not-allowed'
            : 'bg-steam-accent text-steam-bg hover:bg-steam-accent/90 active:scale-95 shadow-glow'
        )}
      >
        <RefreshCw size={15} className={clsx(isScanning && 'animate-spin')} />
        {isScanning ? 'Scanning…' : 'Scan Library'}
      </button>
    </header>
  )
}
