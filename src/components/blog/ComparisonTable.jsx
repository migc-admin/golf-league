const GREEN = '#1B4332'
const INK = '#1d1d1f'

export default function ComparisonTable({ headers = [], rows = [] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl" style={{ border: '1px solid #ebe9e4' }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ background: '#f5f3ee' }}>
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-4 py-3 font-bold whitespace-nowrap"
                style={{ color: i === 1 ? GREEN : INK, borderBottom: '1px solid #ebe9e4' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: i > 0 ? '1px solid #ebe9e4' : undefined }}>
              <td className="px-4 py-3 font-semibold align-top" style={{ color: INK }}>{row.label}</td>
              <td className="px-4 py-3 align-top" style={{ background: 'rgba(27,67,50,0.05)', color: INK }}>{row.a}</td>
              <td className="px-4 py-3 align-top" style={{ color: '#4b5563' }}>{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
