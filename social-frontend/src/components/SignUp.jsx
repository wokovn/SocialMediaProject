import { useSignUp } from '../hooks/useSignUp'
import logoSvg from '../assets/logo/icon-white.svg'

function SignUp() {
  const {
    formData,
    loading,
    message,
    usernameStatus,
    verifyUsername,
    handleChange,
    handleSignUp,
    navigate
  } = useSignUp()

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[450px] space-y-6 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="w-16 h-16 flex items-center justify-center">
          <img src={logoSvg} alt="ArkNet Logo" className="h-16 w-16 object-contain rounded-xl" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black font-display text-white tracking-tight">Create your account</h1>
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

        <form onSubmit={handleSignUp} className="w-full space-y-4">
          <div className="space-y-4">
            {/* Input Username */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-1.5 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="username" className="block text-xs text-[#71767b] font-semibold">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                onBlur={() => {
                  if (formData.username.trim()) {
                    verifyUsername(formData.username)
                  }
                }}
                placeholder="Username"
                className="w-full bg-transparent border-none text-white text-base outline-none pt-0.5 placeholder-[#71767b]"
                required
              />
              {usernameStatus.text && (
                <p className={`text-xs mt-1 font-semibold ${
                  usernameStatus.available
                    ? 'text-emerald-400'
                    : usernameStatus.checking
                      ? 'text-[#71767b]'
                      : 'text-[#f4212e]'
                }`}>
                  {usernameStatus.text}
                </p>
              )}
            </div>

            {/* Input Full Name */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-1.5 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="fullName" className="block text-xs text-[#71767b] font-semibold">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Name"
                className="w-full bg-transparent border-none text-white text-base outline-none pt-0.5 placeholder-[#71767b]"
                required
              />
            </div>

            {/* Input Email */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-1.5 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="email" className="block text-xs text-[#71767b] font-semibold">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email address"
                className="w-full bg-transparent border-none text-white text-base outline-none pt-0.5 placeholder-[#71767b]"
                required
              />
            </div>

            {/* Input Password */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-1.5 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="password" className="block text-xs text-[#71767b] font-semibold">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password (min 6 characters)"
                minLength={6}
                className="w-full bg-transparent border-none text-white text-base outline-none pt-0.5 placeholder-[#71767b]"
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="relative border border-[#2f3336] rounded-lg px-3 py-1.5 focus-within:border-[#1d9bf0] transition focus-within:ring-1 focus-within:ring-[#1d9bf0]">
              <label htmlFor="confirmPassword" className="block text-xs text-[#71767b] font-semibold">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                minLength={6}
                className="w-full bg-transparent border-none text-white text-base outline-none pt-0.5 placeholder-[#71767b]"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || usernameStatus.checking}
            className="w-full bg-white hover:bg-[#e6e6e6] text-black font-bold py-3 px-4 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed font-display text-sm tracking-wide shadow-md mt-4"
          >
            {loading ? 'Creating Account...' : 'Sign up'}
          </button>
        </form>

        <div className="w-full text-center text-sm text-[#71767b] pt-4">
          Already have an account?{' '}
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

export default SignUp
