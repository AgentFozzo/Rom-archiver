import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, getDats, importDat, deleteDat, startScan, getScanStatus } from '../api/client'
import type { Settings } from '../types'
import {
  Save, Upload, Trash2, RefreshCw, CheckCircle, AlertCircle,
  Eye, EyeOff, Loader2, ExternalLink, Database
} from 'lucide-react'
import clsx from 'clsx'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Settings | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [importing, setImporting] = useState(false)

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data: dats = [] } = useQuery({ queryKey: ['dats'], queryFn: getDats })
  const { data: scanStatus } = useQuery({
    queryKey: ['scan-status'],
    queryFn: getScanStatus,
    refetchInterval: (q) => q.state.data?.running ? 1500 : false,
  })

  useEffect(() => {
    if (settings && !form) setForm(settings)
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (data: Settings) => updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaveMsg('Settings saved!')
      setTimeout(() => setSaveMsg(''), 3000)
    },
  })

  const deleteDatMutation = useMutation({
    mutationFn: deleteDat,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dats'] }),
  })

  const scanMutation = useMutation({
    mutationFn: startScan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-status'] }),
  })

  const handleDatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await importDat(file)
      qc.invalidateQueries({ queryKey: ['dats'] })
    } catch (err) {
      alert('Failed to import DAT file: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-steam-accent" />
      </div>
    )
  }

  const isScanning = scanStatus?.running ?? false

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-steam-text mb-8">Settings</h1>

      {/* IGDB Section */}
      <Section title="IGDB API" subtitle="Required for game metadata, cover art, and screenshots.">
        <div className="space-y-4">
          <p className="text-steam-muted text-sm">
            Get your free API keys from the{' '}
            <a
              href="https://api-docs.igdb.com/#getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="text-steam-accent hover:underline inline-flex items-center gap-1"
            >
              IGDB Developer Portal <ExternalLink size={12} />
            </a>
            . You'll need a Twitch account.
          </p>

          <div>
            <label className="block text-steam-muted text-xs font-medium mb-1.5">Twitch Client ID</label>
            <input
              type="text"
              value={form.igdb_client_id}
              onChange={e => setForm({ ...form, igdb_client_id: e.target.value })}
              placeholder="your-client-id"
              className="w-full bg-steam-card border border-steam-border text-steam-text rounded-lg
                         px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-steam-accent"
            />
          </div>

          <div>
            <label className="block text-steam-muted text-xs font-medium mb-1.5">Twitch Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.igdb_client_secret}
                onChange={e => setForm({ ...form, igdb_client_secret: e.target.value })}
                placeholder="your-client-secret"
                className="w-full bg-steam-card border border-steam-border text-steam-text rounded-lg
                           px-4 pr-11 py-2.5 text-sm font-mono focus:outline-none focus:border-steam-accent"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-steam-muted hover:text-steam-text"
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Library Section */}
      <Section title="Library" subtitle="Configure where your ROMs are stored.">
        <div>
          <label className="block text-steam-muted text-xs font-medium mb-1.5">ROM Directory Path</label>
          <input
            type="text"
            value={form.rom_path}
            onChange={e => setForm({ ...form, rom_path: e.target.value })}
            placeholder="/roms"
            className="w-full bg-steam-card border border-steam-border text-steam-text rounded-lg
                       px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-steam-accent"
          />
          <p className="text-steam-muted text-xs mt-1.5">
            Path inside the container (set via Docker volume mount).
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <label className="text-steam-text text-sm font-medium">Auto-scan on startup</label>
            <p className="text-steam-muted text-xs mt-0.5">Scan library automatically when the container starts.</p>
          </div>
          <Toggle
            checked={form.auto_scan_on_start}
            onChange={v => setForm({ ...form, auto_scan_on_start: v })}
          />
        </div>
      </Section>

      {/* Scanner Section */}
      <Section title="Scanner" subtitle="Scan your ROM directory for new or updated files.">
        <div className="flex items-center gap-4">
          <button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning || scanMutation.isPending}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
              isScanning
                ? 'bg-steam-card text-steam-muted cursor-not-allowed'
                : 'bg-steam-accent text-steam-bg hover:bg-steam-accent/90 shadow-glow'
            )}
          >
            <RefreshCw size={15} className={clsx(isScanning && 'animate-spin')} />
            {isScanning ? 'Scanning…' : 'Start Scan'}
          </button>

          {isScanning && scanStatus && (
            <div className="flex-1">
              <div className="flex justify-between text-xs text-steam-muted mb-1">
                <span className="truncate">{scanStatus.current_file}</span>
                <span className="ml-2 flex-shrink-0">
                  {scanStatus.progress}/{scanStatus.total}
                </span>
              </div>
              <div className="h-1.5 bg-steam-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-steam-accent rounded-full transition-all duration-300"
                  style={{ width: `${scanStatus.total > 0 ? Math.round(scanStatus.progress / scanStatus.total * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {!isScanning && scanStatus && scanStatus.total > 0 && (
            <div className="flex items-center gap-2 text-sm text-steam-muted">
              <CheckCircle size={15} className="text-steam-verified" />
              Found {scanStatus.found} · Updated {scanStatus.updated}
              {scanStatus.errors > 0 && (
                <span className="text-steam-danger">· {scanStatus.errors} errors</span>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* DAT Files Section */}
      <Section
        title="No-Intro / Redump DAT Files"
        subtitle="Import DAT files for precise ROM verification. Download them from no-intro.org or redump.org."
      >
        <div>
          <label
            className={clsx(
              'flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer',
              'border-steam-border hover:border-steam-accent/50 transition-colors',
              importing && 'opacity-50 pointer-events-none'
            )}
          >
            {importing ? (
              <Loader2 size={18} className="animate-spin text-steam-accent" />
            ) : (
              <Upload size={18} className="text-steam-muted" />
            )}
            <span className="text-steam-muted text-sm">
              {importing ? 'Importing…' : 'Click to upload a .dat file'}
            </span>
            <input
              type="file"
              accept=".dat"
              onChange={handleDatUpload}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>

        {dats.length > 0 && (
          <div className="space-y-2 mt-2">
            {dats.map(dat => (
              <div
                key={dat.id}
                className="flex items-center gap-3 bg-steam-card border border-steam-border rounded-xl p-3"
              >
                <Database size={16} className="text-steam-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-steam-text text-sm font-medium truncate">{dat.name}</p>
                  <p className="text-steam-muted text-xs">
                    {dat.entry_count.toLocaleString()} entries
                    {dat.imported_at && ` · ${new Date(dat.imported_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove "${dat.name}"?`)) deleteDatMutation.mutate(dat.id)
                  }}
                  className="text-steam-muted hover:text-steam-danger transition-colors p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Save */}
      <div className="flex items-center justify-between pt-2 pb-8">
        {saveMsg && (
          <div className="flex items-center gap-2 text-steam-verified text-sm">
            <CheckCircle size={16} />
            {saveMsg}
          </div>
        )}
        <div className="ml-auto">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-steam-accent text-steam-bg px-6 py-2.5 rounded-lg
                       text-sm font-semibold hover:bg-steam-accent/90 active:scale-95 transition-all
                       disabled:opacity-50 shadow-glow"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-steam-card border border-steam-border rounded-2xl p-6 mb-6 space-y-5">
      <div className="border-b border-steam-border pb-4">
        <h2 className="text-steam-text font-semibold">{title}</h2>
        {subtitle && <p className="text-steam-muted text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
        checked ? 'bg-steam-accent' : 'bg-steam-border'
      )}
    >
      <span
        className={clsx(
          'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}
