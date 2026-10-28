import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from './Button'

/**
 * ImageUpload — click or drag to upload an image to Supabase Storage.
 * Props:
 *   bucket      — storage bucket name (default: 'media')
 *   path        — storage path prefix e.g. 'orgs/migc/logo'
 *   currentUrl  — existing image URL to preview
 *   onUploaded  — callback(url: string) called after successful upload
 *   shape       — 'circle' | 'rect' (default 'rect')
 *   label       — optional label text shown below
 */
export default function ImageUpload({ bucket = 'media', path, currentUrl, onUploaded, onRemoved, shape = 'rect', label }) {
  const [uploading, setUploading] = useState(false)
  const [preview,   setPreview]   = useState(currentUrl ?? null)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return

    const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    const MAX_BYTES    = 5 * 1024 * 1024 // 5 MB

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTS.includes(ext)) {
      alert(`Invalid file type ".${ext}". Allowed: ${ALLOWED_EXTS.join(', ')}`)
      return
    }
    if (file.size > MAX_BYTES) {
      alert('File too large. Maximum size is 5 MB.')
      return
    }

    setUploading(true)
    const filePath = `${path}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true })
    if (error) { alert(error.message); setUploading(false); return }
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
    setPreview(data.publicUrl)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  const isCircle = shape === 'circle'

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
        className={`relative cursor-pointer overflow-hidden border-2 border-dashed border-surface-highest hover:border-fairway-500 transition-colors bg-surface-container flex items-center justify-center ${
          isCircle ? 'w-24 h-24 rounded-full' : 'w-full h-32 rounded-sm'
        }`}
      >
        {preview ? (
          <img src={preview} alt="upload preview" className={`w-full h-full object-cover ${isCircle ? 'rounded-full' : ''}`} />
        ) : (
          <div className="text-center text-ink-muted text-xs px-2">
            <svg className="mx-auto mb-1.5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10.5" r="1.5" />
              <path d="M21 16l-5-5-8 8" />
            </svg>
            <div>{uploading ? 'Uploading…' : 'Click or drop an image'}</div>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-fairway-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        )}
      </div>
      {label && <span className="text-xs text-ink-muted">{label}</span>}
      {preview && onRemoved && (
        <Button
          variant="ghost"
          size="sm"
          className="!text-red-600 hover:!text-red-700"
          onClick={() => { setPreview(null); onRemoved() }}
        >
          Remove image
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
    </div>
  )
}
