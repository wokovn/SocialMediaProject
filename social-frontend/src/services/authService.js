import { supabase } from '../lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const PASSWORD_RESET_REDIRECT_URL =
  import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL ||
  `${window.location.origin}/reset-password`

class AuthService {
  // Store token in localStorage
  setToken(token) {
    localStorage.setItem('access_token', token)
  }

  // Get token from localStorage
  getToken() {
    return localStorage.getItem('access_token')
  }

  // Remove token from localStorage
  removeToken() {
    localStorage.removeItem('access_token')
  }

  async signUp(email, password, username, fullName) {
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            full_name: fullName
          }
        }
      })

      if (error) throw error

      // Store access token
      if (data.session?.access_token) {
        this.setToken(data.session.access_token)
      }

      // Print JWT token
      console.log('=== SIGN UP SUCCESS ===')
      console.log('Access Token:', data.session?.access_token)
      console.log('Refresh Token:', data.session?.refresh_token)
      console.log('User:', data.user)
      console.log('=====================')

      // The trigger will automatically insert into public.users table
      // with username and full_name from raw_user_meta_data
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async signIn(identifier, password) {
    try {
      // Call backend to handle login (supports email or username)
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identifier, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // Store access token
      if (data.session?.access_token) {
        this.setToken(data.session.access_token)
      }

      // Sync Supabase client state (optional but good for consistency)
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      })

      if (sessionError) console.error('Failed to sync session:', sessionError)

      console.log('=== SIGN IN SUCCESS (via Backend) ===')
      console.log('Access Token:', data.session?.access_token)
      console.log('User:', data.user)
      console.log('=====================')

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async signOut() {
    try {
      const token = this.getToken()

      if (token) {
        // Call backend to blacklist the token
        try {
          const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) {
            console.error('Backend logout failed:', response.statusText)
          } else {
            console.log('Token blacklisted successfully')
          }
        } catch (backendError) {
          console.error('Failed to reach backend:', backendError)
          // Continue with Supabase logout even if backend fails
        }
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      // Remove token from localStorage
      this.removeToken()

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error.message }
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return { user, error: null }
    } catch (error) {
      return { user: null, error: error.message }
    }
  }

  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      console.log('Current session:', session);
      return { session, error: null }
    } catch (error) {
      return { session: null, error: error.message }
    }
  }

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }

  async requestPasswordReset(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: PASSWORD_RESET_REDIRECT_URL,
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async updatePassword(newPassword) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }

  async checkUsernameAvailability(username) {
    try {
      const normalizedUsername = String(username || '').trim().toLowerCase()

      if (!normalizedUsername) {
        return {
          data: {
            available: false,
            normalizedUsername,
            reason: 'Username is required.',
          },
          error: null,
        }
      }

      const response = await fetch(
        `${BACKEND_URL}/api/users/check-username?username=${encodeURIComponent(normalizedUsername)}`,
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to verify username')
      }

      return { data: payload, error: null }
    } catch (error) {
      return { data: null, error: error.message }
    }
  }
}

export default new AuthService()
