import { useId } from 'react'

export default function Input({ label, error, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <input
        id={inputId}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`input ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : ''}`}
        {...props}
      />
      {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Select({ label, error, className = '', id, children, ...props }) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={className}>
      {label && <label htmlFor={selectId} className="label">{label}</label>}
      <select
        id={selectId}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={`input bg-white ${error ? 'border-red-400' : ''}`}
        {...props}
      >
        {children}
      </select>
      {error && <p id={`${selectId}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
