import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600 mt-2">Choose a new password for your account</p>
        </div>

        {message.text && (
          <div
            className={`mb-4 p-3 rounded text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {checkingLink ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center text-gray-600">
            Validating reset link...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  minLength={6}
                  required
                  disabled={!canReset || loading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  minLength={6}
                  required
                  disabled={!canReset || loading}
                />
              </div>

              <button
                type="submit"
                disabled={!canReset || loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>

              <p className="text-center text-sm text-gray-600 mt-4">
                Back to{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
