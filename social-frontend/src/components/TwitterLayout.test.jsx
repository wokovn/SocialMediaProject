import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TwitterLayout from './TwitterLayout'
import authService from '../services/authService'

// Mock react-router-dom
const mockNavigate = vi.fn()
const mockLocation = { pathname: '/home' }
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

// Mock useNotifications hook
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: 5,
  }),
}))

// Mock authService
vi.mock('../services/authService', () => ({
  default: {
    getCurrentUser: vi.fn(),
    signOut: vi.fn(),
  },
}))

describe('TwitterLayout component', () => {
  const mockUser = {
    id: 'user123',
    email: 'john@example.com',
    user_metadata: {
      full_name: 'John Doe',
      username: 'johndoe',
      avatar: 'avatar.jpg',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    authService.getCurrentUser.mockResolvedValue({ user: mockUser, error: null })
  })

  it('renders logo, main content, and sidebar structure', async () => {
    render(
      <TwitterLayout>
        <div data-testid="child-content">Main Page Content</div>
      </TwitterLayout>
    )

    // Wait for user fetch to complete
    await waitFor(() => {
      expect(authService.getCurrentUser).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByAltText('ArkNet Logo')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
    expect(screen.getByText('© 2026 ArkNet. Built with Gemini')).toBeInTheDocument()
  })

  it('renders standard navigation links and does not render Admin link', async () => {
    render(
      <TwitterLayout>
        <div>Content</div>
      </TwitterLayout>
    )

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    expect(screen.getByText('Bookmarks')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('navigates to correct route when clicking navigation buttons', async () => {
    render(
      <TwitterLayout>
        <div>Content</div>
      </TwitterLayout>
    )

    await waitFor(() => {
      expect(screen.getByText('Bookmarks')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Bookmarks'))
    expect(mockNavigate).toHaveBeenCalledWith('/saved')

    fireEvent.click(screen.getByText('Notifications'))
    expect(mockNavigate).toHaveBeenCalledWith('/notifications')
  })

  it('renders user details and toggles popup menu on click', async () => {
    render(
      <TwitterLayout>
        <div>Content</div>
      </TwitterLayout>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click profile card at the bottom
    const profileCardBtn = screen.getByRole('button', { name: /john doe/i })
    
    // Popup menu is initially closed, so only 1 Profile button exists (sidebar navigation)
    expect(screen.getAllByRole('button', { name: /^profile$/i }).length).toBe(1)

    // Click card to open popup
    fireEvent.click(profileCardBtn)
    expect(screen.getAllByRole('button', { name: /^profile$/i }).length).toBe(2)
    expect(screen.getByRole('button', { name: /log out @johndoe/i })).toBeInTheDocument()

    // Click card to close popup
    fireEvent.click(profileCardBtn)
    expect(screen.getAllByRole('button', { name: /^profile$/i }).length).toBe(1)
  })

  it('navigates to profile from the popup menu profile button', async () => {
    render(
      <TwitterLayout>
        <div>Content</div>
      </TwitterLayout>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const profileCardBtn = screen.getByRole('button', { name: /john doe/i })
    fireEvent.click(profileCardBtn)

    const profileBtn = screen.getAllByRole('button', { name: /^profile$/i })[1]
    fireEvent.click(profileBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('signs out user and navigates to login when clicking Logout button', async () => {
    authService.signOut.mockResolvedValue({ error: null })
    
    render(
      <TwitterLayout>
        <div>Content</div>
      </TwitterLayout>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const profileCardBtn = screen.getByRole('button', { name: /john doe/i })
    fireEvent.click(profileCardBtn)

    const logoutBtn = screen.getByRole('button', { name: /log out @johndoe/i })
    fireEvent.click(logoutBtn)

    expect(authService.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })
})
