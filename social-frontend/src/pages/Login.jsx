import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import logoSvg from '../assets/logo/icon-white.svg'

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
    <div className="min-h-screen bg-black text-[#e7e9ea] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[450px] space-y-8 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="w-16 h-16 flex items-center justify-center">
          <img src={logoSvg} alt="ArkNet Logo" className="h-16 w-16 object-contain rounded-xl" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black font-display text-white tracking-tight">Sign in to ArkNet</h1>
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

        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div className="space-y-4">
            {/* Input Email/Username */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-2 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="identifier" className="block text-xs text-[#71767b] font-semibold">
                Email or Username
              </label>
              <input
                type="text"
                id="identifier"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="Phone, email, or username"
                className="w-full bg-transparent border-none text-white text-base outline-none pt-1 placeholder-[#71767b]"
                required
              />
            </div>

            {/* Input Password */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-2 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="password" className="block text-xs text-[#71767b] font-semibold">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                className="w-full bg-transparent border-none text-white text-base outline-none pt-1 placeholder-[#71767b]"
                required
              />
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-[#1d9bf0] hover:underline font-bold"
            >
              Forgot password?
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white hover:bg-[#e6e6e6] text-black font-bold py-3 px-4 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed font-display text-sm tracking-wide shadow-md"
          >
            {loading ? 'Signing In...' : 'Log in'}
          </button>
        </form>

        <div className="w-full text-center text-sm text-[#71767b] pt-4">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="text-[#1d9bf0] hover:underline font-bold ml-1"
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
