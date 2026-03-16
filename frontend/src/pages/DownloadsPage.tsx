import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDownloads, createDownload, deleteDownload, getPlatformOptions } from '../api/client'
import { Link } from 'react-router-dom'
import {
  Download, ArrowDown, CheckCircle, AlertCircle, Trash2,
  Loader2, Link as LinkIcon, ExternalLink
} from 'lucide-react'
import clsx from 'clsx'
import type { Download as DownloadType } from '../types'

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatSpeed(bps: number): string {
  if (bps === 0) return '—'
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

export default function DownloadsPage() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [platformSlug, setPlatformSlug] = useState('')

  const { data: downloads = [] } = useQuery({
    queryKey: ['downloads'],
    queryFn: getDownloads,
    refetchInterval: (q) => {
      const dl = q.state.data ?? []
      return dl.some(d => ['downloading', 'hashing', 'moving', 'pending'].includes(d.status))
        ? 1000 : false
    },
  })

  const { data: platformOptions = [] } = useQuery({
    queryKey: ['platform-options'],
    queryFn: getPlatformOptions,
  })

  const createMutation = useMutation({
    mutationFn: () => createDownload(url, platformSlug || undefined),
    onSuccess: () => {
      setUrl('')
      qc.invalidateQueries({ queryKey: ['downloads'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDownload,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['downloads'] })
      qc.invalidateQueries({ queryKey: ['games'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    createMutation.mutate()
  }

  const active = downloads.filter(d => ['downloading', 'hashing', 'moving', 'pending'].includes(d.status))
  const completed = downloads.filter(d => d.status === 'complete')
  const errored = downloads.filter(d => d.status === 'error')

  return (
    <div className="px-6 py-6 max-w-4xl animate-fade-in">
      <h1 className="text-sm font-bold text-steam-text uppercase tracking-wider mb-6">
        ROM Download Manager
      </h1>

      {/* Add ROM form */}
      <div className="bg-steam-card border border-steam-border rounded-lg p-5 mb-6">
        <h2 className="text-steam-text text-sm font-semibold mb-3 flex items-center gap-2">
          <LinkIcon size={14} className="text-steam-blue" />
          Add ROM by URL
        </h2>
        <p className="text-steam-dim text-xs mb-4">
          Paste a direct download link. The ROM will be downloaded, hashed, identified, and auto-organized.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/rom-file.zip"
              required
              className="flex-1 bg-steam-bg-deep border border-steam-border text-steam-text rounded
                         px-3 py-2 text-sm placeholder-steam-dim focus:outline-none focus:border-steam-blue/50
                         transition-colors font-mono"
            />
            <select
              value={platformSlug}
              onChange={e => setPlatformSlug(e.target.value)}
              className="bg-steam-bg-deep border border-steam-border text-steam-muted rounded
                         px-3 py-2 text-xs focus:outline-none focus:border-steam-blue/50 w-44"
            >
              <option value="">Auto-detect platform</option>
              {platformOptions.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending || !url.trim()}
            className="flex items-center gap-2 bg-steam-blue hover:bg-blue-500 text-white
                       px-5 py-2 rounded text-sm font-medium disabled:opacity-50
                       active:scale-95 transition-all"
          >
            {createMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Start Download
          </button>

          {createMutation.isError && (
            <p className="text-steam-danger text-xs">
              Failed: {createMutation.error?.message}
            </p>
          )}
        </form>
      </div>

      {/* Active downloads */}
      {active.length > 0 && (
        <Section title="Active" count={active.length}>
          {active.map(dl => <DownloadRow key={dl.id} dl={dl} onDelete={deleteMutation.mutate} />)}
        </Section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <Section title="Completed" count={completed.length}>
          {completed.map(dl => <DownloadRow key={dl.id} dl={dl} onDelete={deleteMutation.mutate} />)}
        </Section>
      )}

      {/* Errors */}
      {errored.length > 0 && (
        <Section title="Failed" count={errored.length}>
          {errored.map(dl => <DownloadRow key={dl.id} dl={dl} onDelete={deleteMutation.mutate} />)}
        </Section>
      )}

      {/* Empty */}
      {downloads.length === 0 && (
        <div className="text-center py-12">
          <ArrowDown size={28} className="mx-auto text-steam-dim mb-3" />
          <p className="text-steam-muted text-sm">No downloads yet</p>
          <p className="text-steam-dim text-xs mt-1">
            Paste a ROM download URL above to get started
          </p>
        </div>
      )}
    </div>
  )
}

function Section({ title, count, children }: {
  title: string; count: number; children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-steam-muted uppercase tracking-wider mb-2 flex items-center gap-2">
        {title}
        <span className="text-steam-dim font-normal">({count})</span>
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function DownloadRow({ dl, onDelete }: { dl: DownloadType; onDelete: (id: number) => void }) {
  const statusColors: Record<string, string> = {
    pending: 'text-steam-muted',
    downloading: 'text-steam-blue',
    hashing: 'text-yellow-400',
    moving: 'text-purple-400',
    complete: 'text-steam-verified',
    error: 'text-steam-danger',
  }

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Loader2 size={13} className="animate-spin" />,
    downloading: <ArrowDown size={13} className="animate-pulse" />,
    hashing: <Loader2 size={13} className="animate-spin" />,
    moving: <Loader2 size={13} className="animate-spin" />,
    complete: <CheckCircle size={13} />,
    error: <AlertCircle size={13} />,
  }

  return (
    <div className="flex items-center gap-3 bg-steam-bg-deep border border-steam-border rounded-lg
                    px-4 py-3 group">
      {/* Status icon */}
      <span className={clsx('flex-shrink-0', statusColors[dl.status])}>
        {statusIcons[dl.status]}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-steam-text text-sm font-medium truncate">
            {dl.filename || new URL(dl.url).pathname.split('/').pop() || 'Unknown'}
          </p>
          {dl.platform_slug && (
            <span className="text-[10px] text-steam-dim bg-steam-card px-1.5 py-0.5 rounded flex-shrink-0">
              {dl.platform_slug}
            </span>
          )}
        </div>

        {/* Progress bar for downloading */}
        {dl.status === 'downloading' && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-steam-border rounded-full overflow-hidden">
              <div
                className="h-full bg-steam-blue rounded-full transition-all duration-300"
                style={{ width: `${dl.progress}%` }}
              />
            </div>
            <span className="text-steam-blue text-[10px] font-medium flex-shrink-0">
              {Math.round(dl.progress)}%
            </span>
          </div>
        )}

        {/* Status text */}
        <div className="flex items-center gap-3 mt-0.5">
          <span className={clsx('text-[10px] capitalize', statusColors[dl.status])}>
            {dl.status === 'downloading' ? `${formatSpeed(dl.speed_bps)}` : dl.status}
          </span>
          {dl.total_bytes && (
            <span className="text-steam-dim text-[10px]">{formatBytes(dl.total_bytes)}</span>
          )}
          {dl.error && (
            <span className="text-steam-danger text-[10px] truncate">{dl.error}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {dl.game_id && (
          <Link
            to={`/game/${dl.game_id}`}
            className="text-steam-muted hover:text-steam-blue transition-colors"
            title="View game"
          >
            <ExternalLink size={13} />
          </Link>
        )}
        <button
          onClick={() => onDelete(dl.id)}
          className="text-steam-dim hover:text-steam-danger transition-colors
                     opacity-0 group-hover:opacity-100"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
