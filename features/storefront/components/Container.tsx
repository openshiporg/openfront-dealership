import { CSSProperties, ReactNode } from 'react'

export function Container({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`sf-container ${className}`} style={style}>
      {children}
    </div>
  )
}
