import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import logoSvg from '../assets/logo/icon-white.svg'

const hasRecoveryParamsInHash = () => {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(rawHash)

  return params.get('type') === 'recovery' && Boolean(params.get('access_token'))
}

function ResetPassword() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [checkingLink, setCheckingLink] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    let active = true

    const validateRecoverySession = async () => {
      if (hasRecoveryParamsInHash()) {
        if (active) {
          setCanReset(true)
          setCheckingLink(false)
        }
        return
      }

      const { session, error } = await authService.getSession()
      if (!active) {
        return
      }

      if (error || !session) {
        setCanReset(false)
        setMessage({
          type: 'error',
          text: 'Reset link is invalid or expired. Please request a new one.',
        })
        setCheckingLink(false)
        return
      }

      setCanReset(true)
      setCheckingLink(false)
    }

    validateRecoverySession()

    return () => {
      active = false
    }
  }, [])

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (formData.password.length < 6) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 6 characters long.',
      })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match.',
      })
      return
    }

    setLoading(true)
    const { error } = await authService.updatePassword(formData.password)

    if (error) {
      setMessage({ type: 'error', text: error })
      setLoading(false)
      return
    }

    setMessage({
      type: 'success',
      text: 'Password updated successfully. Redirecting to login...',
    })
    setLoading(false)

    setTimeout(() => {
      navigate('/login', { replace: true })
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[450px] space-y-8 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="w-16 h-16 flex items-center justify-center">
          <img src={logoSvg} alt="ArkNet Logo" className="h-16 w-16 object-contain rounded-xl" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black font-display text-white tracking-tight">Reset your password</h1>
          <p className="text-sm text-[#71767b] mt-2">Choose a strong, secure new password.</p>
        </div>

        {message.text && (
          <div className={`w-full p-4 rounded-2xl text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}

        {checkingLink ? (
          <div className="w-full text-center text-[#71767b] py-6">
            Validating reset link...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-5">
            <div className="space-y-4">
              {/* Input New Password */}
              <div className="relative border border-[#2f3336] rounded-lg px-3 py-2 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
                <label htmlFor="password" className="block text-xs text-[#71767b] font-semibold">
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-none text-white text-base outline-none pt-1 placeholder-[#71767b]"
                  minLength={6}
                  required
                  disabled={!canReset || loading}
                />
              </div>

              {/* Confirm Password */}
              <div className="relative border border-[#2f3336] rounded-lg px-3 py-2 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
                <label htmlFor="confirmPassword" className="block text-xs text-[#71767b] font-semibold">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-none text-white text-base outline-none pt-1 placeholder-[#71767b]"
                  minLength={6}
                  required
                  disabled={!canReset || loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canReset || loading}
              className="w-full bg-white hover:bg-[#e6e6e6] text-black font-bold py-3 px-4 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed font-display text-sm tracking-wide shadow-md"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        <div className="w-full text-center text-sm text-[#71767b] pt-4">
          Back to{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-[#1d9bf0] hover:underline font-bold ml-1"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
