import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBiosFiles, getBiosPlatforms, uploadBiosFiles, downloadBiosFile, deleteBiosFile
} from '../api/client'
import type { BiosFile, BiosPlatformInfo } from '../types'
import {
  Upload, Download, Trash2, ShieldCheck, AlertCircle, CheckCircle,
  Loader2, Cpu, FileCheck, HardDrive, ChevronDown, ChevronRight
} from 'lucide-react'
import clsx from 'clsx'

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const CATEGORY_LABELS: Record<string, string> = {
  bios: 'BIOS',
  firmware: 'Firmware',
  keys: 'Keys',
  other: 'Other',
}

export default function SystemFilesPage() {
  const qc = useQueryClient()
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())
  const [uploadState, setUploadState] = useState<{
    active: boolean; total: number; current: number; currentFile: string;
    completed: string[]; failed: string[]
  }>({ active: false, total: 0, current: 0, currentFile: '', completed: [], failed: [] })

  const { data: platforms = [] } = useQuery({
    queryKey: ['bios-platforms'],
    queryFn: getBiosPlatforms,
  })

  const { data: allFiles = [] } = useQuery({
    queryKey: ['bios-files'],
    queryFn: () => getBiosFiles(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBiosFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bios-files'] })
      qc.invalidateQueries({ queryKey: ['bios-platforms'] })
    },
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    setUploadState({
      active: true, total: files.length, current: 0,
      currentFile: files[0].name, completed: [], failed: [],
    })

    const completed: string[] = []
    const failed: string[] = []

    // Upload one at a time for progress tracking
    for (let i = 0; i < files.length; i++) {
      setUploadState(prev => ({ ...prev, current: i, currentFile: files[i].name }))
      try {
        await uploadBiosFiles([files[i]], selectedPlatform || undefined)
        completed.push(files[i].name)
      } catch {
        failed.push(files[i].name)
      }
      setUploadState(prev => ({
        ...prev, current: i + 1, completed: [...completed], failed: [...failed],
      }))
    }

    qc.invalidateQueries({ queryKey: ['bios-files'] })
    qc.invalidateQueries({ queryKey: ['bios-platforms'] })

    setTimeout(() => {
      setUploadState({ active: false, total: 0, current: 0, currentFile: '', completed: [], failed: [] })
    }, 4000)

    e.target.value = ''
  }

  const togglePlatform = (slug: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  // Group uploaded files by platform
  const filesByPlatform = new Map<string, BiosFile[]>()
  for (const f of allFiles) {
    const list = filesByPlatform.get(f.platform_slug) || []
    list.push(f)
    filesByPlatform.set(f.platform_slug, list)
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-4xl animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <Cpu size={18} className="text-steam-blue" />
        <h1 className="text-sm font-bold text-steam-text uppercase tracking-wider">
          System Files
        </h1>
      </div>
      <p className="text-steam-dim text-xs mb-6">
        Upload BIOS, firmware, and key files that emulators need. Files are auto-identified by hash.
      </p>

      {/* Upload area */}
      <div className="bg-steam-card border border-steam-border rounded-lg p-5 mb-6">
        <h2 className="text-steam-text text-sm font-semibold mb-3 flex items-center gap-2">
          <Upload size={14} className="text-steam-blue" />
          Upload System Files
        </h2>

        <div className="flex gap-2 mb-3">
          <select
            value={selectedPlatform}
            onChange={e => setSelectedPlatform(e.target.value)}
            className="bg-steam-bg-deep border border-steam-border text-steam-muted rounded
                       px-3 py-2 text-xs focus:outline-none focus:border-steam-blue/50 w-48"
          >
            <option value="">Auto-detect platform</option>
            {platforms.map(p => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>

        <label className={clsx(
          'flex flex-col items-center justify-center gap-2 border border-dashed rounded-lg p-6 cursor-pointer transition-colors',
          uploadState.active
            ? 'border-steam-blue/30 opacity-50 pointer-events-none'
            : 'border-steam-border hover:border-steam-blue/40'
        )}>
          <HardDrive size={24} className="text-steam-dim" />
          <span className="text-steam-muted text-xs">
            Drop files or click to upload — BIOS, firmware, keys, etc.
          </span>
          <span className="text-steam-dim text-[10px]">
            Supports any file type. Known hashes are auto-verified.
          </span>
          <input
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploadState.active}
          />
        </label>

        {/* Upload progress */}
        {(uploadState.active || uploadState.completed.length > 0 || uploadState.failed.length > 0) && uploadState.total > 0 && (
          <div className="mt-3 bg-steam-bg-deep border border-steam-border rounded-lg p-3 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-steam-text font-medium flex items-center gap-1.5">
                {uploadState.current < uploadState.total ? (
                  <><Loader2 size={11} className="animate-spin text-steam-blue" /> Uploading &amp; hashing...</>
                ) : uploadState.failed.length === 0 ? (
                  <><CheckCircle size={11} className="text-steam-verified" /> All uploaded!</>
                ) : (
                  <><AlertCircle size={11} className="text-steam-warning" /> Done with errors</>
                )}
              </span>
              <span className="text-steam-muted">{uploadState.current} / {uploadState.total}</span>
            </div>
            <div className="h-1.5 bg-steam-border rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-300',
                  uploadState.current >= uploadState.total
                    ? uploadState.failed.length > 0 ? 'bg-steam-warning' : 'bg-steam-verified'
                    : 'bg-steam-blue'
                )}
                style={{ width: `${Math.round((uploadState.current / uploadState.total) * 100)}%` }}
              />
            </div>
            {uploadState.active && uploadState.current < uploadState.total && (
              <p className="text-steam-dim text-[10px] truncate">
                {uploadState.currentFile}
              </p>
            )}
            {(uploadState.completed.length > 0 || uploadState.failed.length > 0) && (
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {uploadState.completed.map(name => (
                  <div key={name} className="flex items-center gap-1.5 text-[10px]">
                    <FileCheck size={10} className="text-steam-verified flex-shrink-0" />
                    <span className="text-steam-muted truncate">{name}</span>
                  </div>
                ))}
                {uploadState.failed.map(name => (
                  <div key={name} className="flex items-center gap-1.5 text-[10px]">
                    <AlertCircle size={10} className="text-steam-danger flex-shrink-0" />
                    <span className="text-steam-danger/70 truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Platform cards - what's needed */}
      <h2 className="text-xs font-bold text-steam-muted uppercase tracking-wider mb-3">
        Required Files by Platform
      </h2>

      <div className="space-y-1.5 mb-8">
        {platforms.map(platform => {
          const files = filesByPlatform.get(platform.slug) || []
          const isExpanded = expandedPlatforms.has(platform.slug)
          const hasAll = platform.needs.length > 0 && files.length >= platform.needs.length
          const hasNone = files.length === 0

          return (
            <div
              key={platform.slug}
              className="bg-steam-card border border-steam-border rounded-lg overflow-hidden"
            >
              {/* Platform header */}
              <button
                onClick={() => togglePlatform(platform.slug)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                {isExpanded
                  ? <ChevronDown size={12} className="text-steam-dim flex-shrink-0" />
                  : <ChevronRight size={12} className="text-steam-dim flex-shrink-0" />
                }

                {/* Status indicator */}
                <div className={clsx(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  hasAll ? 'bg-steam-verified' : hasNone ? 'bg-steam-dim' : 'bg-steam-warning'
                )} />

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-steam-text text-sm font-medium">{platform.name}</span>
                    {files.length > 0 && (
                      <span className="text-steam-verified text-[10px] flex items-center gap-0.5">
                        <CheckCircle size={9} /> {files.length} file{files.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-steam-dim text-[10px] mt-0.5 truncate">
                    {platform.emulators.join(', ')}
                  </p>
                </div>

                {hasNone && (
                  <span className="text-steam-dim text-[10px] flex-shrink-0">Missing</span>
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-steam-border px-4 py-3 space-y-3 animate-fade-in">
                  {/* What's needed */}
                  <div>
                    <p className="text-steam-dim text-[10px] uppercase tracking-wider mb-1.5">Required</p>
                    <div className="space-y-1">
                      {platform.needs.map((need, i) => (
                        <p key={i} className="text-steam-muted text-xs flex items-center gap-1.5">
                          <span className="text-steam-dim">•</span> {need}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Uploaded files */}
                  {files.length > 0 && (
                    <div>
                      <p className="text-steam-dim text-[10px] uppercase tracking-wider mb-1.5">Uploaded</p>
                      <div className="space-y-1">
                        {files.map(f => (
                          <div
                            key={f.id}
                            className="flex items-center gap-2 bg-steam-bg-deep rounded-lg px-3 py-2 group"
                          >
                            {f.verified ? (
                              <ShieldCheck size={12} className="text-steam-verified flex-shrink-0" />
                            ) : (
                              <HardDrive size={12} className="text-steam-dim flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-steam-text text-xs font-medium truncate">
                                {f.filename}
                              </p>
                              <p className="text-steam-dim text-[10px]">
                                {f.description || CATEGORY_LABELS[f.category] || f.category}
                                {' · '}{formatBytes(f.file_size)}
                                {f.verified && (
                                  <span className="text-steam-verified ml-1">✓ Verified</span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => downloadBiosFile(f.id)}
                              className="text-steam-muted hover:text-steam-blue transition-colors p-1"
                              title="Download"
                            >
                              <Download size={12} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${f.filename}?`)) deleteMutation.mutate(f.id)
                              }}
                              className="text-steam-dim hover:text-steam-danger transition-colors p-1
                                         opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
