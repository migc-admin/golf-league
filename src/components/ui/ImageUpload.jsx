import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
export default function ImageUpload({ bucket = 'media', path, currentUrl, onUploaded, shape = 'rect', label }) {
  const [uploading, setUploading] = useState(false)
  const [preview,   setPreview]   = useState(currentUrl ?? null)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
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
        className={`relative cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 hover:border-fairway-500 transition-colors bg-gray-50 flex items-center justify-center ${
          isCircle ? 'w-24 h-24 rounded-full' : 'w-full h-32 rounded-xl'
        }`}
      >
        {preview ? (
          <img src={preview} alt="upload preview" className={`w-full h-full object-cover ${isCircle ? 'rounded-full' : ''}`} />
        ) : (
          <div className="text-center text-gray-400 text-xs px-2">
            <div className="text-2xl mb-1">📷</div>
            <div>{uploading ? 'Uploading…' : 'Click or drop'}</div>
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
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
    </div>
  )
}
