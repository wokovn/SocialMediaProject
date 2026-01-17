import authService from './authService'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'


class ApiClient {
  async request(endpoint, options = {}) {
    const token = authService.getToken()

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add Authorization header if token exists
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
        // Token might be expired or blacklisted
        authService.removeToken()
        window.location.href = '/login'
        throw new Error('Unauthorized')
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Request failed')
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message }
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

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export default new ApiClient()
