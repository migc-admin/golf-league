import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const STORAGE_KEY = 'scorify_cookie_consent'

/**
 * Load GA4 script dynamically — only called after user accepts analytics.
 */
function loadGA(measurementId) {
  if (!measurementId || window.__ga_loaded) return
  window.__ga_loaded = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', measurementId, { anonymize_ip: true })
}

/**
 * Read stored consent from localStorage.
 * Returns null if not yet set, or { necessary, analytics } object.
 */
function getStoredConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveConsent(consent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  } catch { /* storage unavailable */ }
}

export default function CookieBanner() {
  const [visible,   setVisible]   = useState(false)
  const [analytics, setAnalytics] = useState(true)

  useEffect(() => {
    const stored = getStoredConsent()
    if (!stored) {
      // First visit — show banner
      setVisible(true)
    } else if (stored.analytics) {
      // Returning visitor who already accepted analytics
      loadGA(import.meta.env.VITE_GA_ID)
    }
  }, [])

  function handleAcceptAll() {
    const consent = { necessary: true, analytics: true, ts: Date.now() }
    saveConsent(consent)
    loadGA(import.meta.env.VITE_GA_ID)
    setVisible(false)
  }

  function handleSavePreferences() {
    const consent = { necessary: true, analytics, ts: Date.now() }
    saveConsent(consent)
    if (analytics) loadGA(import.meta.env.VITE_GA_ID)
    setVisible(false)
  }

  function handleNecessaryOnly() {
    const consent = { necessary: true, analytics: false, ts: Date.now() }
    saveConsent(consent)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ border: `1.5px solid #ebe9e4` }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#ebe9e4' }}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-gray-900 text-base">Cookie Preferences</h2>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            We use cookies to keep you logged in and to understand how the app is used — helping us improve it.
            You can choose what you allow. See our{' '}
            <Link to="/privacy" className="underline" style={{ color: GREEN }}>Privacy Policy</Link> for details.
          </p>
        </div>

        {/* Toggles */}
        <div className="px-6 py-4 space-y-3">
          {/* Necessary — always on */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Necessary</p>
              <p className="text-xs text-gray-400">Login sessions, security. Cannot be disabled.</p>
            </div>
            <div
              className="w-10 h-6 rounded-full flex items-center px-1"
              style={{ background: GREEN }}
            >
              <div className="w-4 h-4 rounded-full bg-white ml-auto" />
            </div>
          </div>

          {/* Analytics — toggleable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Analytics</p>
              <p className="text-xs text-gray-400">Page views and usage patterns via Google Analytics. No personal data sold.</p>
            </div>
            <button
              onClick={() => setAnalytics(a => !a)}
              aria-pressed={analytics}
              className="w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200"
              style={{ background: analytics ? GREEN : '#d1d5db' }}
            >
              <div
                className="w-4 h-4 rounded-full bg-white transition-transform duration-200"
                style={{ transform: analytics ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={handleNecessaryOnly}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: '#d1d5db', color: '#6b7280' }}
          >
            Necessary Only
          </button>
          <button
            onClick={handleSavePreferences}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            Save Preferences
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: GREEN }}
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  )
}
