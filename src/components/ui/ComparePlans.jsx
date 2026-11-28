// "Compare plans" table: every feature, by plan. Rows come from
// src/lib/planComparison.js, which reads the app's real feature gates.
import { Link } from 'react-router-dom'
import { COMPARE_SECTIONS, PLAN_DETAILS } from '../../lib/planComparison'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const LINE  = '#ebe9e4'

function Value({ v }) {
  // Inline check plus real text, so the cell reads "Included" in reader mode, print, and screen readers too
  if (v === true) return (
    <span className="relative inline-flex items-center justify-center"><span className="sr-only">Included</span><svg className="mx-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
  )
  if (v === false || v == null) return <span style={{ color: '#cbd5e1' }} aria-label="Not included">—</span>
  return <span className="font-semibold" style={{ color: INK }}>{v}</span>
}

export default function ComparePlans() {
  const plans = PLAN_DETAILS.map(d => d.plan)
  return (
    <div className="overflow-x-auto rounded-2xl bg-white" style={{ border: `1px solid ${LINE}` }}>
      <table className="w-full text-[13px] sm:text-sm sm:min-w-[600px]">
        <thead>
          <tr style={{ borderBottom: `1px solid ${LINE}` }}>
            <th scope="col" className="text-left p-3 sm:p-4 align-bottom text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Feature</th>
            {plans.map(p => (
              <th key={p.name} scope="col" className="px-1 py-3 sm:p-4 text-center align-bottom w-[19%] sm:w-[18%]">
                <span className="block font-bold" style={{ color: INK }}>{p.name}</span>
                <span className="block text-xs font-normal mt-0.5" style={{ color: MUTED }}>{p.price ? `$${p.price}/mo` : 'Free'}</span>
              </th>
            ))}
          </tr>
        </thead>
        {COMPARE_SECTIONS.map(section => (
          <tbody key={section.title}>
            <tr>
              <th colSpan={plans.length + 1} scope="colgroup" className="text-left px-3 sm:px-4 pt-5 pb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: GREEN, background: '#fbfaf8' }}>
                {section.title}
              </th>
            </tr>
            {section.rows.map(r => (
              <tr key={r.label} style={{ borderTop: `1px solid ${LINE}` }}>
                <th scope="row" className="text-left font-normal px-3 sm:px-4 py-3" style={{ color: '#374151' }}>{r.label}</th>
                {r.values.map((v, i) => <td key={i} className="text-center px-1 sm:px-4 py-3"><Value v={v} /></td>)}
              </tr>
            ))}
          </tbody>
        ))}
        <tfoot className="hidden sm:table-footer-group">
          <tr style={{ borderTop: `1px solid ${LINE}` }}>
            <td className="p-4" />
            {plans.map(p => (
              <td key={p.name} className="p-4 text-center">
                <Link to={p.href} className="inline-flex min-h-[44px] items-center text-xs font-bold px-4 rounded-full transition-opacity hover:opacity-90"
                  style={p.isPopular ? { background: GREEN, color: '#fff' } : { border: `1.5px solid ${GREEN}`, color: GREEN }}>
                  {p.buttonText}
                </Link>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
