'use client'

import React, { useState, useRef, useEffect } from 'react'

interface CommandResult {
  success: boolean
  message: string
  description?: string
  mode?: string
  interface?: string
  actions?: string[]
  commands?: string[]
  count?: number
  error?: string
  suggestion?: string
}

export function CommandSimulator() {
  const [isOpen, setIsOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<Array<{ command: string; result: CommandResult }>>([])
  const [currentMode, setCurrentMode] = useState<'web' | 'mobile'>('web')
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])

  const executeCommand = async () => {
    if (!command.trim()) return

    try {
      const response = await fetch('/api/wallet/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim() })
      })

      const result = await response.json()
      
      setHistory(prev => [...prev, { command: command.trim(), result }])
      
      // Update current mode if command was successful
      if (result.success && result.mode) {
        setCurrentMode(result.mode)
      }
      
      setCommand('')
    } catch (error) {
      setHistory(prev => [...prev, { 
        command: command.trim(), 
        result: { 
          success: false, 
          message: 'Error executing command',
          error: 'Network or server error'
        }
      }])
      setCommand('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const clearHistory = () => {
    setHistory([])
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-accent text-primary px-4 py-2 rounded-lg shadow-lg hover:bg-accent-hover transition-colors z-50"
      >
        🎮 Minecraft Commands
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-vr-bg-primary border border-subtle rounded-xl w-full max-w-4xl h-96 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-subtle">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🎮</span>
            <div>
              <h3 className="vr-subtitle">Minecraft Command Simulator</h3>
              <p className="vr-caption text-tertiary">
                Current Mode: <span className={`px-2 py-1 rounded text-xs ${
                  currentMode === 'web' ? 'bg-blue-500 bg-opacity-20 text-blue-400' : 'bg-green-500 bg-opacity-20 text-green-400'
                }`}>
                  {currentMode.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={clearHistory}
              className="px-3 py-1 bg-surface border border-subtle rounded text-sm hover:bg-opacity-80 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center bg-surface border border-subtle rounded hover:bg-opacity-80 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Command History */}
        <div 
          ref={historyRef}
          className="flex-1 p-4 overflow-y-auto space-y-3 bg-black bg-opacity-20 font-mono text-sm"
        >
          {history.length === 0 ? (
            <div className="text-center text-tertiary py-8">
              <p className="mb-2">🎯 Try these commands:</p>
              <div className="space-y-1 text-xs">
                <p><code>/wallet web</code> - Switch to web mode</p>
                <p><code>/wallet mobile</code> - Switch to mobile mode</p>
                <p><code>/wallet status</code> - Show wallet status</p>
                <p><code>/wallet help</code> - Show all commands</p>
              </div>
            </div>
          ) : (
            history.map((entry, index) => (
              <div key={index} className="space-y-2">
                <div className="text-accent">
                  <span className="text-muted">Player&gt;</span> {entry.command}
                </div>
                <div className={`pl-4 ${entry.result.success ? 'text-green-400' : 'text-red-400'}`}>
                  <div className="font-medium">{entry.result.message}</div>
                  {entry.result.description && (
                    <div className="text-xs text-tertiary mt-1">{entry.result.description}</div>
                  )}
                  {entry.result.actions && (
                    <div className="mt-2 space-y-1">
                      {entry.result.actions.map((action, i) => (
                        <div key={i} className="text-xs text-blue-400">→ {action}</div>
                      ))}
                    </div>
                  )}
                  {entry.result.commands && (
                    <div className="mt-2 space-y-1">
                      {entry.result.commands.map((cmd, i) => (
                        <div key={i} className="text-xs text-muted">{cmd}</div>
                      ))}
                    </div>
                  )}
                  {entry.result.error && (
                    <div className="text-xs text-red-400 mt-1">Error: {entry.result.error}</div>
                  )}
                  {entry.result.suggestion && (
                    <div className="text-xs text-yellow-400 mt-1">💡 {entry.result.suggestion}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Command Input */}
        <div className="p-4 border-t border-subtle">
          <div className="flex items-center space-x-2">
            <span className="text-muted font-mono text-sm">Player&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a command (e.g., /wallet web)"
              className="flex-1 bg-surface border border-subtle rounded px-3 py-2 focus:border-accent focus:outline-none font-mono text-sm"
            />
            <button
              onClick={executeCommand}
              disabled={!command.trim()}
              className="px-4 py-2 bg-accent text-primary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
            >
              Execute
            </button>
          </div>
          <p className="text-xs text-tertiary mt-2">
            Press Enter to execute • Press Escape to close • Try <code>/wallet help</code> for commands
          </p>
        </div>
      </div>
    </div>
  )
}