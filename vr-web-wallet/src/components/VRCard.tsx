'use client'

import React from 'react'
import { clsx } from 'clsx'
import type { VRCardProps } from '@/lib/types'

export const VRCard: React.FC<VRCardProps> = ({
  children,
  title,
  subtitle,
  interactive = false,
  onClick,
  className = ''
}) => {
  return (
    <div
      onClick={interactive && onClick ? onClick : undefined}
      className={clsx(
        // Base card styles
        interactive ? 'vr-card-interactive' : 'vr-card',
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-vr-4">
          {title && (
            <h3 className="vr-subtitle text-vr-primary">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="vr-body text-vr-text-dim">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <div>
        {children}
      </div>
    </div>
  )
}