'use client'

import React from 'react'
import { clsx } from 'clsx'
import type { VRButtonProps } from '@/lib/types'

export const VRButton: React.FC<VRButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = ''
}) => {
  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={clsx(
        // Base VR button styles
        'vr-btn',
        
        // Size variants
        {
          'vr-btn-sm': size === 'sm',
          'vr-btn-md': size === 'md',
          'vr-btn-lg': size === 'lg',
          'vr-btn-xl': size === 'xl'
        },
        
        // Color variants
        {
          'vr-btn-primary': variant === 'primary',
          'vr-btn-secondary': variant === 'secondary',
          'vr-btn-danger': variant === 'danger',
          'vr-btn-outline': variant === 'outline'
        },
        
        // State modifiers
        {
          'opacity-50 cursor-not-allowed': disabled || loading,
          'hover:scale-105': !disabled && !loading
        },
        
        className
      )}
    >
      {loading ? (
        <div className="flex items-center space-x-3">
          <div className="vr-spinner" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  )
}