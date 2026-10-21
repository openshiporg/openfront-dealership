import Link from 'next/link'
import { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const variantClass: Record<Variant, string> = {
  primary: 'sf-btn-primary',
  secondary: 'sf-btn-secondary',
  ghost: 'sf-btn-ghost',
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  href,
  type = 'button',
  disabled,
  onClick,
}: {
  children: ReactNode
  variant?: Variant
  className?: string
  href?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  onClick?: () => void
}) {
  const classes = `sf-btn ${variantClass[variant]} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
