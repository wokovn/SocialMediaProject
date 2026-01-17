import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'

function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { user, error } = await authService.getCurrentUser()
    
    if (error || !user) {
      navigate('/login')
      return
    }
    
    setUser(user)
    setLoading(false)
  }

  const handleSignOut = async () => {
    await authService.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">Social App</h1>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome, {user?.user_metadata?.full_name || user?.email}!
          </h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-gray-900 font-medium">{user?.email}</p>
            </div>
            
            {user?.user_metadata?.username && (
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Username</p>
                <p className="text-gray-900 font-medium">@{user.user_metadata.username}</p>
              </div>
            )}
            
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">Account Status</p>
              <p className="text-gray-900 font-medium">
                {user?.email_confirmed_at ? 'Verified' : 'Pending Verification'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Home
