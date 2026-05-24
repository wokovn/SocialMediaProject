import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import logoSvg from '../assets/logo/icon-white.svg'

function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await authService.requestPasswordReset(email)

    if (error) {
      setMessage({
        type: 'error',
        text: error,
      })
      setLoading(false)
      return
    }

    setMessage({
      type: 'success',
      text: 'Password reset email sent. Please check your inbox.',
    })
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[450px] space-y-8 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="w-16 h-16 flex items-center justify-center">
          <img src={logoSvg} alt="ArkNet Logo" className="h-16 w-16 object-contain rounded-xl" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black font-display text-white tracking-tight">Find your ArkNet account</h1>
          <p className="text-sm text-[#71767b] mt-2">Enter your email and we'll send a password reset link.</p>
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

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="relative border border-[#2f3336] rounded-lg px-3 py-2 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
            <label htmlFor="email" className="block text-xs text-[#71767b] font-semibold">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent border-none text-white text-base outline-none pt-1 placeholder-[#71767b]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-[#e6e6e6] text-black font-bold py-3 px-4 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed font-display text-sm tracking-wide shadow-md"
          >
            {loading ? 'Sending...' : 'Next'}
          </button>
        </form>

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

export default ForgotPassword
