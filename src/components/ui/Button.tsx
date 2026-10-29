import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  asChildLink?: string
  showArrow?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ink text-paper border border-ink hover:bg-paper hover:text-ink active:scale-[0.98] disabled:bg-mist disabled:text-muted disabled:border-line',
  secondary:
    'bg-paper text-ink border border-ink hover:bg-ink hover:text-paper active:scale-[0.98] disabled:bg-mist disabled:text-muted disabled:border-line',
  ghost:
    'bg-transparent text-ink border border-transparent hover:bg-mist active:scale-[0.98] disabled:text-muted',
  danger:
    'bg-paper text-ink border border-ink hover:bg-ink hover:text-paper',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-6 text-sm gap-2',
  lg: 'h-13 px-8 text-[15px] gap-2.5 py-3.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  asChildLink,
  showArrow,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-[3px] whitespace-nowrap',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )
  const content = (
    <>
      {children}
      {showArrow && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />}
    </>
  )
  if (asChildLink && !disabled) {
    return (
      <Link to={asChildLink} className={cn(classes, 'group')}>
        {content}
      </Link>
    )
  }
  return (
    <button className={cn(classes, 'group')} disabled={disabled} {...rest}>
      {content}
    </button>
  )
}
