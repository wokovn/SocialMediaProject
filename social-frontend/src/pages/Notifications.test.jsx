import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Notifications from './Notifications'
import authService from '../services/authService'
import { useNotifications } from '../hooks/useNotifications'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/notifications' }),
}))

// Mock useNotifications hook
const mockMarkGroupAsRead = vi.fn()
const mockMarkAllAsRead = vi.fn()
const mockFetchNotifications = vi.fn()
const mockMarkAsRead = vi.fn()
const mockFetchMoreNotifications = vi.fn()

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: mockUnreadCount,
    markGroupAsRead: mockMarkGroupAsRead,
    markAllAsRead: mockMarkAllAsRead,
    fetchNotifications: mockFetchNotifications,
    markAsRead: mockMarkAsRead,
    fetchMoreNotifications: mockFetchMoreNotifications,
    fetchingMore: false,
    hasMore: false,
  }),
}))

// Mock authService
vi.mock('../services/authService', () => ({
  default: {
    getCurrentUser: vi.fn(),
  },
}))

let mockNotifications = []
let mockUnreadCount = 0

describe('Notifications page', () => {
  const mockUser = { id: 'u1', email: 'user@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotifications = []
    mockUnreadCount = 0
    authService.getCurrentUser.mockResolvedValue({ user: mockUser, error: null })
  })

  it('redirects to login if user session is invalid', async () => {
    authService.getCurrentUser.mockResolvedValue({ user: null, error: 'Unauthorized' })
    render(<Notifications />)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  it('renders empty notifications state when there are none', async () => {
    render(<Notifications />)
    await waitFor(() => {
      expect(screen.getByText('Nothing to see here — yet')).toBeInTheDocument()
    })
  })

  it('renders notifications list when populated', async () => {
    mockNotifications = [
      {
        id: 'n1',
        type: 'INTERACTION',
        action: 'LIKE',
        createdAt: new Date().toISOString(),
        isRead: false,
        isGroup: false,
        data: {
          metadata: {
            actor_name: 'Alice',
            actor_avatar: 'avatar1.jpg',
            postTitle: 'Hello World',
          },
        },
      },
    ]
    mockUnreadCount = 1

    render(<Notifications />)
    await waitFor(() => {
      expect(screen.getByText('Alice liked your post')).toBeInTheDocument()
    })
    expect(screen.getByText('"Hello World"')).toBeInTheDocument()
    expect(screen.getByText('Mark all as read')).toBeInTheDocument()
  })

  it('calls markAllAsRead when Mark all as read button is clicked', async () => {
    mockNotifications = [
      {
        id: 'n1',
        type: 'INTERACTION',
        action: 'LIKE',
        createdAt: new Date().toISOString(),
        isRead: false,
        isGroup: false,
        data: {
          metadata: {
            actor_name: 'Alice',
          },
        },
      },
    ]
    mockUnreadCount = 1

    render(<Notifications />)
    await waitFor(() => {
      expect(screen.getByText('Mark all as read')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Mark all as read'))
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1)
  })

  it('marks individual notification as read and navigates when clicked', async () => {
    const notif = {
      id: 'n1',
      type: 'INTERACTION',
      action: 'LIKE',
      createdAt: new Date().toISOString(),
      isRead: false,
      isGroup: false,
      targetUrl: '/post/post123',
      data: {
        metadata: {
          actor_name: 'Alice',
        },
      },
    }
    mockNotifications = [notif]

    render(<Notifications />)
    await waitFor(() => {
      expect(screen.getByText('Alice liked your post')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Alice liked your post'))
    expect(mockMarkAsRead).toHaveBeenCalledWith('n1')
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('?postId=post123')
    })
  })
})
