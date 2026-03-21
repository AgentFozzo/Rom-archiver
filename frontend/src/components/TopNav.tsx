import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { startScan, getScanStatus, getStats } from '../api/client'
import { Gamepad2, RefreshCw, Settings, Loader2, Menu, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'

interface TopNavProps {
  onMenuToggle: () => void
}

export default function TopNav({ onMenuToggle }: TopNavProps) {
  const location = useLocation()
  const qc = useQueryClient()
  const { signOut } = useAuth()

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
    { path: '/system-files', label: 'SYSTEM FILES' },
  ]

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="bg-steam-bg-deep flex-shrink-0">
      <div className="flex items-center h-10 px-3 gap-1">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded
                     text-steam-muted hover:text-white hover:bg-white/5 transition-colors mr-1"
          aria-label="Toggle library"
        >
          <Menu size={16} />
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-4 group">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-steam-blue to-blue-700
                          flex items-center justify-center flex-shrink-0">
            <Gamepad2 size={14} className="text-white" />
          </div>
          <span className="hidden sm:block text-steam-text text-sm font-bold tracking-wide
                           group-hover:text-white transition-colors">
            ROM ARCHIVER
          </span>
        </Link>

        {/* Main nav — hidden on mobile, visible md+ */}
        <nav className="hidden md:flex items-center gap-0.5 h-full">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'h-full flex items-center px-2.5 lg:px-3 text-xs font-bold tracking-wider transition-colors relative',
                isActivePath(item.path)
                  ? 'text-white'
                  : 'text-steam-muted hover:text-steam-text'
              )}
            >
              {/* Shorten labels on tablet */}
              <span className="lg:hidden">
                {item.label === 'COLLECTIONS' ? 'COLLECT.' :
                 item.label === 'SYSTEM FILES' ? 'SYS FILES' :
                 item.label}
              </span>
              <span className="hidden lg:block">{item.label}</span>
              {isActivePath(item.path) && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-steam-blue" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Scan status */}
          {isScanning && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-steam-blue">
              <Loader2 size={12} className="animate-spin" />
              <span className="hidden md:block">
                Scanning {scanStatus?.progress}/{scanStatus?.total}
              </span>
            </div>
          )}

          {/* Game count — desktop only */}
          {stats && (
            <span className="hidden lg:block text-steam-dim text-xs">
              {stats.total_games} games
            </span>
          )}

          {/* Scan button */}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all',
              isScanning
                ? 'text-steam-dim cursor-not-allowed'
                : 'text-steam-muted hover:text-white hover:bg-white/5'
            )}
            title="Scan ROM library"
          >
            <RefreshCw size={12} className={clsx(isScanning && 'animate-spin')} />
            <span className="hidden lg:block">Scan</span>
          </button>

          {/* Settings */}
          <Link
            to="/settings"
            className="text-steam-muted hover:text-white transition-colors p-1"
            title="Settings"
          >
            <Settings size={14} />
          </Link>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="text-steam-muted hover:text-white transition-colors p-1"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Mobile nav row — shown below header on small screens */}
      <nav className="md:hidden flex items-center border-t border-steam-border/50 overflow-x-auto no-scrollbar">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(
              'flex-shrink-0 flex items-center px-4 py-2 text-[11px] font-bold tracking-wider relative',
              isActivePath(item.path)
                ? 'text-white'
                : 'text-steam-muted'
            )}
          >
            {item.label}
            {isActivePath(item.path) && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-steam-blue" />
            )}
          </Link>
        ))}
      </nav>
    </header>
  )
}
