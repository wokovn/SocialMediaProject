import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NotificationBell from './NotificationBell'
import { useNotifications } from '../hooks/useNotifications'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock useNotifications hook
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}))

describe('NotificationBell component', () => {
  const mockMarkAsRead = vi.fn()
  const mockMarkGroupAsRead = vi.fn()
  const mockMarkAllAsRead = vi.fn()
  const mockFetchNotifications = vi.fn()
  const mockFetchMoreNotifications = vi.fn()

  const defaultHookValue = {
    notifications: [],
    unreadCount: 0,
    loading: false,
    fetchingMore: false,
    hasMore: false,
    markAsRead: mockMarkAsRead,
    markGroupAsRead: mockMarkGroupAsRead,
    markAllAsRead: mockMarkAllAsRead,
    fetchNotifications: mockFetchNotifications,
    fetchMoreNotifications: mockFetchMoreNotifications,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useNotifications.mockReturnValue(defaultHookValue)
  })

  it('renders the bell button with icon and unified Notifications label', () => {
    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    expect(button).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays the unread count when unreadCount > 0', () => {
    useNotifications.mockReturnValue({
      ...defaultHookValue,
      unreadCount: 5,
    })
    render(<NotificationBell />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does not display unread badge when unreadCount is 0', () => {
    render(<NotificationBell />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('displays 99+ when unreadCount is greater than 99', () => {
    useNotifications.mockReturnValue({
      ...defaultHookValue,
      unreadCount: 150,
    })
    render(<NotificationBell />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('toggles dropdown and calls fetchNotifications when clicked', () => {
    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    
    // Dropdown initially closed
    expect(screen.queryByRole('heading', { name: /notifications/i })).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(button)
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: /notifications/i })).toBeInTheDocument()

    // Click again to close
    fireEvent.click(button)
    expect(screen.queryByRole('heading', { name: /notifications/i })).not.toBeInTheDocument()
  })

  it('displays empty state message when there are no notifications', () => {
    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(button)

    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
  })

  it('renders notifications list when present', () => {
    const mockNotifications = [
      {
        id: 'n1',
        type: 'INTERACTION',
        action: 'LIKE',
        isRead: false,
        createdAt: new Date().toISOString(),
        isGroup: false,
        data: {
          metadata: {
            actor_name: 'Alice',
            actor_avatar: 'alice.jpg',
            postTitle: 'Hello World',
          },
        },
      },
      {
        id: 'n2',
        type: 'SOCIAL',
        action: 'FOLLOW',
        isRead: true,
        createdAt: new Date().toISOString(),
        isGroup: false,
        data: {
          metadata: {
            actor_name: 'Bob',
          },
        },
      },
    ]

    useNotifications.mockReturnValue({
      ...defaultHookValue,
      notifications: mockNotifications,
      unreadCount: 1,
    })

    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(button)

    expect(screen.getByText(/Alice liked your post/i)).toBeInTheDocument()
    expect(screen.getByText(/"Hello World"/i)).toBeInTheDocument()
    expect(screen.getByText(/Bob followed you/i)).toBeInTheDocument()
  })

  it('calls markAllAsRead when Mark all as read button is clicked', () => {
    useNotifications.mockReturnValue({
      ...defaultHookValue,
      notifications: [
        {
          id: 'n1',
          type: 'INTERACTION',
          action: 'LIKE',
          isRead: false,
          createdAt: new Date().toISOString(),
          isGroup: false,
          data: { metadata: { actor_name: 'Alice' } },
        },
      ],
      unreadCount: 1,
    })

    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(button)

    const markAllBtn = screen.getByRole('button', { name: /mark all as read/i })
    fireEvent.click(markAllBtn)
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1)
  })

  it('calls markAsRead and navigates on notification item click', async () => {
    const mockNotif = {
      id: 'n1',
      type: 'INTERACTION',
      action: 'LIKE',
      isRead: false,
      createdAt: new Date().toISOString(),
      isGroup: false,
      targetUrl: '/post/p123',
      data: { metadata: { actor_name: 'Alice' } },
    }

    useNotifications.mockReturnValue({
      ...defaultHookValue,
      notifications: [mockNotif],
      unreadCount: 1,
    })

    render(<NotificationBell />)
    const button = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(button)

    const item = screen.getByText(/Alice liked your post/i).closest('div[class*="cursor-pointer"]')
    expect(item).toBeInTheDocument()
    
    fireEvent.click(item)
    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('n1')
    })
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('?postId=p123')
    })
  })
})
