'use client'

import React from 'react'
import { clsx } from 'clsx'
import type { StatusIndicatorProps } from '@/lib/types'

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className = ''
}) => {
  const getStatusText = () => {
    if (label) return label
    
    switch (status) {
      case 'online':
        return 'Connected'
      case 'offline':
        return 'Disconnected'
      case 'pending':
        return 'Connecting...'
      default:
        return 'Unknown'
    }
  }

  const getStatusClass = () => {
    switch (status) {
      case 'online':
        return 'vr-status-online'
      case 'offline':
        return 'vr-status-offline'
      case 'pending':
        return 'vr-status-pending'
      default:
        return 'vr-status-offline'
    }
  }

  return (
    <div className={clsx('vr-status-indicator', className)}>
      <div className={clsx('vr-status-dot', getStatusClass())} />
      <span className="vr-body font-medium">
        {getStatusText()}
      </span>
    </div>
  )
}