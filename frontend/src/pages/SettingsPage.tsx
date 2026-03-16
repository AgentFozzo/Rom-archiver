import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings, getDats, importDats, deleteDat, startScan, getScanStatus } from '../api/client'
import type { Settings } from '../types'
import {
  Save, Upload, Trash2, RefreshCw, CheckCircle, AlertCircle,
  Eye, EyeOff, Loader2, ExternalLink, Database, ArrowLeft, FileCheck
} from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Settings | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [importState, setImportState] = useState<{
    active: boolean
    total: number
    current: number
    currentFile: string
    completed: string[]
    failed: string[]
  }>({ active: false, total: 0, current: 0, currentFile: '', completed: [], failed: [] })

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
      setSaveMsg('Saved!')
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
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    setImportState({
      active: true,
      total: files.length,
      current: 0,
      currentFile: files[0].name,
      completed: [],
      failed: [],
    })

    const completed: string[] = []
    const failed: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setImportState(prev => ({
        ...prev,
        current: i,
        currentFile: file.name,
      }))

      try {
        await importDats([file])
        completed.push(file.name)
      } catch {
        failed.push(file.name)
      }

      setImportState(prev => ({
        ...prev,
        current: i + 1,
        completed: [...completed],
        failed: [...failed],
      }))
    }

    qc.invalidateQueries({ queryKey: ['dats'] })

    // Keep the results visible for a few seconds, then clear
    setTimeout(() => {
      setImportState({ active: false, total: 0, current: 0, currentFile: '', completed: [], failed: [] })
    }, 4000)

    e.target.value = ''
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-steam-blue" />
      </div>
    )
  }

  const isScanning = scanStatus?.running ?? false

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-steam-muted hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-steam-text uppercase tracking-wider">Settings</h1>
      </div>

      {/* IGDB */}
      <Section title="IGDB API">
        <p className="text-steam-dim text-xs mb-3">
          Free keys from{' '}
          <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer"
             className="text-steam-blue hover:underline inline-flex items-center gap-1">
            dev.twitch.tv <ExternalLink size={10} />
          </a>
        </p>
        <Field label="Client ID">
          <input
            type="text"
            value={form.igdb_client_id}
            onChange={e => setForm({ ...form, igdb_client_id: e.target.value })}
            placeholder="your-client-id"
            className="input-field font-mono"
          />
        </Field>
        <Field label="Client Secret">
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={form.igdb_client_secret}
              onChange={e => setForm({ ...form, igdb_client_secret: e.target.value })}
              placeholder="your-client-secret"
              className="input-field font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steam-dim hover:text-steam-text"
            >
              {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Field>
      </Section>

      {/* Library */}
      <Section title="Library">
        <Field label="ROM Directory Path">
          <input
            type="text"
            value={form.rom_path}
            onChange={e => setForm({ ...form, rom_path: e.target.value })}
            className="input-field font-mono"
          />
          <p className="text-steam-dim text-[10px] mt-1">Container path (set via Docker volume).</p>
        </Field>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-steam-text text-xs font-medium">Auto-scan on startup</p>
            <p className="text-steam-dim text-[10px]">Scan when container starts.</p>
          </div>
          <Toggle checked={form.auto_scan_on_start} onChange={v => setForm({ ...form, auto_scan_on_start: v })} />
        </div>
      </Section>

      {/* Scanner */}
      <Section title="Scanner">
        <div className="flex items-center gap-3">
          <button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-all',
              isScanning
                ? 'bg-steam-card text-steam-dim cursor-not-allowed'
                : 'bg-steam-blue text-white hover:bg-blue-500'
            )}
          >
            <RefreshCw size={12} className={clsx(isScanning && 'animate-spin')} />
            {isScanning ? 'Scanning...' : 'Start Scan'}
          </button>
          {isScanning && scanStatus && (
            <div className="flex-1 text-xs text-steam-dim">
              {scanStatus.progress}/{scanStatus.total} — {scanStatus.current_file}
            </div>
          )}
          {!isScanning && scanStatus && scanStatus.total > 0 && (
            <span className="text-xs text-steam-dim flex items-center gap-1">
              <CheckCircle size={11} className="text-steam-verified" />
              {scanStatus.found} found, {scanStatus.updated} updated
            </span>
          )}
        </div>
      </Section>

      {/* DAT Files */}
      <Section title="No-Intro / Redump DATs">
        {/* Upload area */}
        <label className={clsx(
          'flex items-center justify-center gap-2 border border-dashed rounded-lg p-4 cursor-pointer transition-colors',
          importState.active
            ? 'border-steam-blue/30 opacity-50 pointer-events-none'
            : 'border-steam-border hover:border-steam-blue/30'
        )}>
          <Upload size={14} className="text-steam-dim" />
          <span className="text-steam-dim text-xs">Upload .dat files (select multiple)</span>
          <input type="file" accept=".dat" multiple onChange={handleDatUpload} className="hidden" disabled={importState.active} />
        </label>

        {/* Import progress */}
        {(importState.active || importState.completed.length > 0 || importState.failed.length > 0) && importState.total > 0 && (
          <div className="mt-3 bg-steam-bg-deep border border-steam-border rounded-lg p-3 space-y-2.5 animate-fade-in">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-steam-text font-medium flex items-center gap-1.5">
                  {importState.current < importState.total ? (
                    <><Loader2 size={11} className="animate-spin text-steam-blue" /> Importing...</>
                  ) : importState.failed.length === 0 ? (
                    <><CheckCircle size={11} className="text-steam-verified" /> All done!</>
                  ) : (
                    <><AlertCircle size={11} className="text-steam-warning" /> Completed with errors</>
                  )}
                </span>
                <span className="text-steam-muted">
                  {importState.current} / {importState.total}
                </span>
              </div>
              <div className="h-1.5 bg-steam-border rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    importState.current >= importState.total
                      ? importState.failed.length > 0 ? 'bg-steam-warning' : 'bg-steam-verified'
                      : 'bg-steam-blue'
                  )}
                  style={{ width: `${Math.round((importState.current / importState.total) * 100)}%` }}
                />
              </div>
            </div>

            {/* Current file being processed */}
            {importState.active && importState.current < importState.total && (
              <p className="text-steam-dim text-[10px] truncate">
                Processing: {importState.currentFile}
              </p>
            )}

            {/* Results list */}
            {(importState.completed.length > 0 || importState.failed.length > 0) && (
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {importState.completed.map(name => (
                  <div key={name} className="flex items-center gap-1.5 text-[10px]">
                    <FileCheck size={10} className="text-steam-verified flex-shrink-0" />
                    <span className="text-steam-muted truncate">{name}</span>
                  </div>
                ))}
                {importState.failed.map(name => (
                  <div key={name} className="flex items-center gap-1.5 text-[10px]">
                    <AlertCircle size={10} className="text-steam-danger flex-shrink-0" />
                    <span className="text-steam-danger/70 truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {dats.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {dats.map(dat => (
              <div key={dat.id} className="flex items-center gap-2 bg-steam-bg-deep border border-steam-border rounded-lg p-2.5">
                <Database size={13} className="text-steam-dim flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-steam-text text-xs font-medium truncate">{dat.name}</p>
                  <p className="text-steam-dim text-[10px]">{dat.entry_count.toLocaleString()} entries</p>
                </div>
                <button
                  onClick={() => { if (confirm(`Remove "${dat.name}"?`)) deleteDatMutation.mutate(dat.id) }}
                  className="text-steam-dim hover:text-steam-danger transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Save */}
      <div className="flex items-center justify-between pt-2 pb-4">
        {saveMsg && (
          <span className="text-steam-verified text-xs flex items-center gap-1">
            <CheckCircle size={12} /> {saveMsg}
          </span>
        )}
        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="ml-auto flex items-center gap-2 bg-steam-blue text-white px-5 py-2
                     rounded text-sm font-medium hover:bg-blue-500 active:scale-95
                     disabled:opacity-50 transition-all"
        >
          <Save size={13} />
          Save Settings
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-steam-card border border-steam-border rounded-lg p-4 mb-4 space-y-3">
      <h2 className="text-steam-text text-xs font-bold uppercase tracking-wider pb-2 border-b border-steam-border">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-steam-dim text-[10px] font-medium uppercase tracking-wider">{label}</label>
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
        'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
        checked ? 'bg-steam-blue' : 'bg-steam-border'
      )}
    >
      <span className={clsx(
        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  )
}
