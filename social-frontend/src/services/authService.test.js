import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import authService from './authService'
import { supabase } from '../lib/supabase'

// Mock Supabase
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getUser: vi.fn(),
        getSession: vi.fn(),
        setSession: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
      },
    },
  }
})

describe('authService', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    fetchMock = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchMock.mockRestore()
  })

  describe('token storage', () => {
    it('sets, gets and removes token in localStorage', () => {
      authService.setToken('mock-jwt-token')
      expect(authService.getToken()).toBe('mock-jwt-token')

      authService.removeToken()
      expect(authService.getToken()).toBeNull()
    })
  })

  describe('signUp', () => {
    it('calls supabase.auth.signUp and sets token on success', async () => {
      const mockSession = { access_token: 'signup-token', refresh_token: 'refresh-token' }
      supabase.auth.signUp.mockResolvedValue({
        data: { session: mockSession, user: { id: 'u1' } },
        error: null,
      })

      const res = await authService.signUp('test@test.com', 'password123', 'testuser', 'Test User')

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
        options: {
          data: {
            username: 'testuser',
            full_name: 'Test User',
          },
        },
      })
      expect(authService.getToken()).toBe('signup-token')
      expect(res.error).toBeNull()
    })

    it('returns error message if supabase signup fails', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: null,
        error: new Error('User already exists'),
      })

      const res = await authService.signUp('test@test.com', 'password123', 'testuser', 'Test User')
      expect(res.data).toBeNull()
      expect(res.error).toBe('User already exists')
    })
  })

  describe('signIn', () => {
    it('calls fetch to backend /api/auth/login and sets token/session on success', async () => {
      const mockResponse = {
        session: { access_token: 'login-token', refresh_token: 'refresh-token' },
        user: { id: 'u1' }
      }
      
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      supabase.auth.setSession.mockResolvedValue({ error: null })

      const res = await authService.signIn('testuser', 'password123')

      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ identifier: 'testuser', password: 'password123' })
      }))
      expect(authService.getToken()).toBe('login-token')
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'login-token',
        refresh_token: 'refresh-token'
      })
      expect(res.data).toEqual(mockResponse)
    })

    it('returns error if backend returns unauthorized response status', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      })

      const res = await authService.signIn('testuser', 'wrong')
      expect(res.data).toBeNull()
      expect(res.error).toBe('Invalid credentials')
    })
  })

  describe('getCurrentUser', () => {
    it('queries Supabase auth.getUser', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1', email: 'test@test.com' } },
        error: null,
      })

      const res = await authService.getCurrentUser()
      expect(supabase.auth.getUser).toHaveBeenCalled()
      expect(res.user.id).toBe('u1')
    })
  })

  describe('checkUsernameAvailability', () => {
    it('calls backend username verification api', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ available: true }),
      })

      const res = await authService.checkUsernameAvailability('newuser')
      expect(fetchMock).toHaveBeenCalledWith('/api/users/check-username?username=newuser')
      expect(res.data.available).toBe(true)
    })
  })
})
