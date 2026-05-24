import { supabase } from '../lib/supabase'

// Mặc định dùng relative URL (Nginx proxy /api/ → backend).
// Override bằng VITE_BACKEND_URL nếu cần gọi trực tiếp (dev không có proxy).
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''


class ApiClient {
  async request(endpoint, options = {}) {
    // Always use the live Supabase session token so refreshes are picked up automatically
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const config = {
      ...options,
      headers,
    }

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, config)

      // Handle unauthorized responses
      if (response.status === 401) {
        await supabase.auth.signOut()
        window.location.href = '/login'
        throw new Error('Unauthorized')
      }

      let data = null
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('[ApiClient] JSON parsing failed:', parseError)
      }

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error('Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.')
        }
        throw new Error(data?.message || data?.error || 'Yêu cầu không thành công.')
      }

      return { data, error: null }
    } catch (error) {
      console.error('[ApiClient] Request error details:', error)
      
      // Generic secure fallback message for low-level or technical failures
      const genericMsg = 'Đã xảy ra sự cố kết nối. Vui lòng thử lại sau.'
      
      // If it is already a masked friendly message or an explicit validation message, keep it
      const isFriendly = error.message && 
                         !/fetch|network|failed to|unexpected|token|parse|json|undefined|null|object|cors/i.test(error.message)
      
      return { data: null, error: isFriendly ? error.message : genericMsg }
    }
  }

  // Convenience methods
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' })
  }

  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export default new ApiClient()
