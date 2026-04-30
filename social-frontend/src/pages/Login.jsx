import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { data, error } = await authService.signIn(
      formData.identifier,
      formData.password
    )

    if (error) {
      setMessage({
        type: 'error',
        text: error
      })
      setLoading(false)
      return
    }

    navigate('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
          <p className="text-gray-600 mt-2">Welcome back</p>
        </div>

        {message.text && (
          <div className={`mb-4 p-3 rounded text-sm ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                Email or Username
              </label>
              <input
                type="text"
                id="identifier"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="you@example.com or username"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign Up
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
