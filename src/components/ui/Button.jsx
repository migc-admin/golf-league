export default function Button({
  children,
  variant = 'primary',
  size    = 'md',
  className = '',
  loading = false,
  ...props
}) {
  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'btn-danger',
    ghost:     'btn border-transparent text-gray-600 hover:bg-gray-100',
  }
  const sizes = {
    sm:  'btn-sm',
    md:  'btn-md',
    lg:  'btn-lg',
    xl:  'px-8 py-4 text-lg',
  }

  return (
    <button
      className={`${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
