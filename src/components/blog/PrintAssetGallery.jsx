import { useState } from 'react'
import Modal from '../ui/Modal'

const ASSETS = [
  {
    key: 'tee_sheet',
    label: 'Tee Sheet',
    src: '/blog/print-assets/tee-sheet.png',
    caption: 'Groups, tee times, and starting holes — printed for the pro shop or starter.',
  },
  {
    key: 'cart_sign',
    label: 'Cart Sign',
    src: '/blog/print-assets/cart-sign.png',
    caption: 'One per cart — group number and player names, ready to slide into the holder.',
  },
  {
    key: 'ctp_sign',
    label: 'Closest to the Pin Sign',
    src: '/blog/print-assets/ctp-sign.png',
    caption: 'Posted at the tee box — hole number and a sign-in sheet for the side game.',
  },
]

export default function PrintAssetGallery() {
  const [open, setOpen] = useState(null)

  return (
    <div className="my-6">
      <div className="grid grid-cols-3 gap-3">
        {ASSETS.map(a => (
          <button
            key={a.key}
            onClick={() => setOpen(a.key)}
            className="text-left rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
            style={{ border: '1px solid #ebe9e4', aspectRatio: '3 / 4' }}
          >
            <img src={a.src} alt={a.label} className="w-full h-full object-cover object-top" />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-2">
        {ASSETS.map(a => (
          <p key={a.key} className="text-xs font-semibold text-center" style={{ color: '#6b7280' }}>{a.label}</p>
        ))}
      </div>

      {ASSETS.map(a => (
        <Modal key={a.key} open={open === a.key} onClose={() => setOpen(null)} title={a.label} maxWidth="max-w-md">
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #ebe9e4' }}>
            <img src={a.src} alt={a.label} className="w-full h-auto" />
          </div>
          <p className="text-sm mt-3" style={{ color: '#6b7280' }}>{a.caption}</p>
          <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>Sample layout for illustration — not a real event.</p>
        </Modal>
      ))}
    </div>
  )
}
