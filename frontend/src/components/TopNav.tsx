import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { startScan, getScanStatus, getStats } from '../api/client'
import { Gamepad2, RefreshCw, Settings, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export default function TopNav() {
  const location = useLocation()
  const qc = useQueryClient()

  const { data: scanStatus } = useQuery({
    queryKey: ['scan-status'],
    queryFn: getScanStatus,
    refetchInterval: (q) => q.state.data?.running ? 1000 : false,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 30_000,
  })

  const scanMutation = useMutation({
    mutationFn: startScan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-status'] }),
  })

  const isScanning = scanStatus?.running ?? false

  const navItems = [
    { path: '/', label: 'HOME' },
    { path: '/collections', label: 'COLLECTIONS' },
    { path: '/downloads', label: 'DOWNLOADS' },
  ]

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="bg-steam-bg-deep flex-shrink-0">
      {/* Primary nav row */}
      <div className="flex items-center h-9 px-4 gap-1">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-6 group">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-steam-blue to-blue-700
                          flex items-center justify-center">
            <Gamepad2 size={14} className="text-white" />
          </div>
          <span className="text-steam-text text-sm font-bold tracking-wide group-hover:text-white
                           transition-colors">
            ROM ARCHIVER
          </span>
        </Link>

        {/* Main nav */}
        <nav className="flex items-center gap-0.5 h-full">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'h-full flex items-center px-3 text-xs font-bold tracking-wider transition-colors relative',
                isActivePath(item.path)
                  ? 'text-white'
                  : 'text-steam-muted hover:text-steam-text'
              )}
            >
              {item.label}
              {isActivePath(item.path) && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-steam-blue" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {/* Scan status */}
          {isScanning && (
            <div className="flex items-center gap-2 text-xs text-steam-blue">
              <Loader2 size={12} className="animate-spin" />
              <span>
                Scanning {scanStatus?.progress}/{scanStatus?.total}
              </span>
            </div>
          )}

          {/* Game count */}
          {stats && (
            <span className="text-steam-dim text-xs">
              {stats.total_games} games
            </span>
          )}

          {/* Scan button */}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all',
              isScanning
                ? 'text-steam-dim cursor-not-allowed'
                : 'text-steam-muted hover:text-white hover:bg-white/5'
            )}
            title="Scan ROM library"
          >
            <RefreshCw size={12} className={clsx(isScanning && 'animate-spin')} />
          </button>

          {/* Settings */}
          <Link
            to="/settings"
            className="text-steam-muted hover:text-white transition-colors p-1"
            title="Settings"
          >
            <Settings size={14} />
          </Link>
        </div>
      </div>
    </header>
  )
}
