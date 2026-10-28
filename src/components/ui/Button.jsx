/**
 * Button — the one button for the admin app.
 *
 * Variants: primary (filled forest green), secondary (white, 1px neutral border),
 * ghost (no border, muted text), danger (red, for destructive actions only).
 * Corners are 8px. Sizes: sm 36px, md 44px (default), lg 48px, xl 56px minimum height.
 *
 * Renders a real <button>, or a real <a> when `href` is given. Icon-only buttons
 * (`iconOnly`) must pass `label`, which becomes the aria-label.
 * Pass `as={Link} to="..."` to render a react-router link with button styling.
 * `icon` is 'download' | 'external' | 'copy' | 'plus', shown before the label (after it with `iconAfter`).
 *
 * `ActionButton` is the same component defaulting to the secondary variant; it is what
 * rows and cards on the Event Admin page use.
 *
 * Colors come only from existing Tailwind tokens (fairway, surface, ink), plus the
 * existing red already used for errors and destructive actions.
 */

export function DownloadIcon({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
}

export function ExternalIcon({ className = '' }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </svg>
  )
}

export function CopyIcon({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 012-2h9" />
    </svg>
  )
}

export function PlusIcon({ className = '' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

const ICONS = { download: DownloadIcon, external: ExternalIcon, copy: CopyIcon, plus: PlusIcon }

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-sm border text-sm font-semibold ' +
  'whitespace-nowrap select-none transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed'

const VARIANTS = {
  primary:
    'bg-fairway-700 border-fairway-700 text-white hover:bg-fairway-800 hover:border-fairway-800 ' +
    'disabled:opacity-50',
  secondary:
    'bg-white border-surface-highest text-ink hover:bg-surface-dim ' +
    'disabled:bg-surface-container disabled:text-ink-muted disabled:hover:bg-surface-container',
  ghost:
    'bg-transparent border-transparent text-ink-muted hover:text-ink hover:bg-surface-dim ' +
    'disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink-muted',
  danger:
    'bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700 disabled:opacity-50',
}

const SIZES = {
  sm: 'min-h-[36px]',
  md: 'min-h-[44px]',
  lg: 'min-h-[48px]',
  xl: 'min-h-[56px] text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon = null,
  iconAfter = false,
  iconOnly = false,
  label,
  loading = false,
  href,
  as: Component,          // e.g. a react-router <Link>; renders it instead of <button>/<a>
  className = '',
  children,
  ...rest
}) {
  const Icon = icon ? ICONS[icon] : null
  const sizing = iconOnly
    ? { sm: 'w-9', md: 'w-11', lg: 'w-12', xl: 'w-14' }[size] ?? 'w-11'
    : size === 'sm' ? 'px-3' : 'px-4'
  const classes =
    `${BASE} ${VARIANTS[variant] ?? VARIANTS.secondary} ${SIZES[size] ?? SIZES.md} ${sizing} ${iconOnly ? 'px-0' : ''} ${className}`
      .replace(/\s+/g, ' ').trim()

  const content = (
    <>
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && Icon && !iconAfter && <Icon />}
      {!iconOnly && children}
      {!loading && Icon && iconAfter && <Icon />}
    </>
  )

  if (Component) {
    return (
      <Component className={classes} aria-label={iconOnly ? label : undefined} {...rest}>
        {content}
      </Component>
    )
  }

  if (href) {
    const rel = rest.rel ?? (rest.target === '_blank' ? 'noopener noreferrer' : undefined)
    return (
      <a href={href} className={classes} aria-label={iconOnly ? label : undefined} {...rest} rel={rel}>
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      aria-label={iconOnly ? label : undefined}
      aria-busy={loading || undefined}
      {...rest}
      disabled={loading || rest.disabled}
    >
      {content}
    </button>
  )
}

export function ActionButton({ variant = 'secondary', ...props }) {
  return <Button variant={variant} {...props} />
}
