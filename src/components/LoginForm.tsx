'use client'

import React, { useState } from 'react'

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<boolean>
  onRegister: (username: string, password: string) => Promise<boolean>
  loading?: boolean
}

export function LoginForm({ onLogin, onRegister, loading = false }: LoginFormProps) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password) {
      setError('Please enter both username and password')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    try {
      let result
      if (isRegisterMode) {
        result = await onRegister(formData.username, formData.password)
        if (result) {
          setSuccess('Account created successfully! You can now login.')
          setIsRegisterMode(false)
          setFormData({ username: formData.username, password: '' })
        } else {
          setError('Registration failed. Username might already exist.')
        }
      } else {
        result = await onLogin(formData.username, formData.password)
        if (!result) {
          setError('Invalid username or password')
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode)
    setError(null)
    setSuccess(null)
    setFormData({ username: '', password: '' })
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)'
    }}>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes neonPulse {
            0% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          @keyframes neonFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          
          .neon-input:focus {
            outline: none;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
            border-color: #00ff88;
          }
          
          .neon-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 255, 136, 0.3);
          }
        `
      }} />
      
      {/* Animated Background */}
      <div style={{
        position: 'absolute',
        inset: '0',
        opacity: 0.6,
        background: `
          radial-gradient(circle at 20% 50%, rgba(0, 255, 136, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(0, 153, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(255, 0, 128, 0.1) 0%, transparent 50%)
        `,
        animation: 'neonPulse 4s ease-in-out infinite alternate'
      }} />
      
      {/* Floating Orbs */}
      <div style={{
        position: 'absolute',
        width: '100px',
        height: '100px',
        top: '20%',
        left: '10%',
        borderRadius: '50%',
        opacity: 0.2,
        background: 'linear-gradient(45deg, rgba(0, 255, 136, 0.2), rgba(0, 153, 255, 0.2))',
        animation: 'neonFloat 6s ease-in-out infinite'
      }} />
      
      <div style={{
        position: 'absolute',
        width: '150px',
        height: '150px',
        top: '60%',
        right: '15%',
        borderRadius: '50%',
        opacity: 0.2,
        background: 'linear-gradient(45deg, rgba(0, 255, 136, 0.1), rgba(0, 153, 255, 0.1))',
        animation: 'neonFloat 6s ease-in-out infinite 2s'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '28rem',
        position: 'relative',
        zIndex: 10
      }}>
        
        {/* Main Card */}
        <div style={{
          borderRadius: '1rem',
          padding: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '4rem',
              height: '4rem',
              borderRadius: '1rem',
              marginBottom: '1.5rem',
              background: 'linear-gradient(to bottom right, #4ade80, #3b82f6)',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
              <svg style={{ width: '2rem', height: '2rem', color: 'black' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '0.5rem'
            }}>
              {isRegisterMode ? 'Sign Up' : 'Sign In'}
            </h1>
            <p style={{ color: '#9ca3af' }}>
              {isRegisterMode ? 'Create your Web Wallet account' : 'Access your Web Wallet'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Success Message */}
            {success && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.5)',
                color: '#4ade80',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                backdropFilter: 'blur(4px)'
              }}>
                ✓ {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#f87171',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                backdropFilter: 'blur(4px)'
              }}>
                ✗ {error}
              </div>
            )}

            {/* Email Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="username" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#d1d5db'
              }}>
                Email
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="neon-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            {/* Password Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#d1d5db'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="neon-input"
                  style={{
                    width: '100%',
                    padding: '0.75rem 3rem 0.75rem 1rem',
                    borderRadius: '0.5rem',
                    color: 'white',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.color = 'white'}
                  onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
                >
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.979 6.98m2.899 2.898L12 12m0 0l2.121 2.121M12 12l2.121-2.121m-2.121 2.121L9.879 14.121" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            {!isRegisterMode && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                  color: '#d1d5db'
                }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      width: '1rem',
                      height: '1rem',
                      marginRight: '0.5rem',
                      accentColor: '#4ade80'
                    }}
                  />
                  Remember me
                </label>
                <button 
                  type="button" 
                  style={{
                    fontSize: '0.875rem',
                    color: '#00ff88',
                    textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="neon-button"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                background: 'linear-gradient(45deg, #00ff88, #0099ff)',
                border: 'none',
                color: '#000',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {loading 
                ? (isRegisterMode ? 'Creating Account...' : 'Signing in...') 
                : (isRegisterMode ? 'SIGN UP' : 'SIGN IN')
              }
            </button>

            {/* Divider */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                inset: '0',
                display: 'flex',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '100%',
                  borderTop: '1px solid #4b5563'
                }}></div>
              </div>
              <div style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                fontSize: '0.875rem'
              }}>
                <span style={{
                  padding: '0 0.5rem',
                  background: 'transparent',
                  color: '#9ca3af'
                }}>OR</span>
              </div>
            </div>

            {/* Toggle Register/Login */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: '#9ca3af' }}>
                {isRegisterMode ? 'Already have an account?' : "Don't have an account?"} 
              </span>
              <button
                type="button"
                onClick={toggleMode}
                disabled={loading}
                style={{
                  marginLeft: '0.5rem',
                  color: '#00ff88',
                  textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
                  background: 'none',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  textDecoration: 'none',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.textDecoration = 'underline')}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                {isRegisterMode ? 'Sign in' : 'Create account'}
              </button>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            Secure • Decentralized • Self-sovereign
          </p>
        </div>

      </div>
    </div>
  )
}