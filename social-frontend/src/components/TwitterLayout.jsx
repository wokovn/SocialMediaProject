import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  HomeIcon,
  BellIcon,
  BookmarkIcon,
  UserIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  EllipsisHorizontalIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import logoSvg from '../assets/logo/icon-white.svg'
import authService from '../services/authService'
import { useNotifications } from '../hooks/useNotifications'
import Modal from './Modal'
import CreatePost from './CreatePost'
import postsService from '../services/postsService'

export default function TwitterLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const { unreadCount } = useNotifications()
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleModalPostCreated = async ({ content, visibility, files }) => {
    const { data, error } = await postsService.createPost({
      content,
      visibility,
      files,
      userId: user?.id,
    })
    
    if (!error && data) {
      setIsPostModalOpen(false)
      // data = { message, postId, post } — dispatch only the post object
      const newPost = data.post || data
      window.dispatchEvent(new CustomEvent('post-created', { detail: newPost }))
    } else {
      throw new Error(error || 'Failed to create post')
    }
  }

  useEffect(() => {
    async function fetchUser() {
      const { user: currUser } = await authService.getCurrentUser()
      if (currUser) {
        setUser(currUser)
      }
      setLoading(false)
    }
    fetchUser()
  }, [])

  const handleSignOut = async () => {
    await authService.signOut()
    navigate('/login')
  }

  const navItems = [
    { name: 'Home', path: '/home', icon: HomeIcon },
    { name: 'Notifications', path: '/notifications', icon: BellIcon, count: unreadCount },
    { name: 'Bookmarks', path: '/saved', icon: BookmarkIcon },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ]

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userHandle = user?.user_metadata?.username || user?.email?.split('@')[0] || 'username'
  const userAvatar = user?.user_metadata?.avatar || user?.avatar || null

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] font-sans">
      <div className="max-w-[1250px] mx-auto flex">
        
        {/* Left Sidebar - Sticky Navigation */}
        <aside className="w-[80px] sm:w-[275px] h-screen sticky top-0 flex flex-col justify-between px-2 sm:px-4 py-4 border-r border-[#2f3336] flex-shrink-0 z-20">
          <div className="flex flex-col items-center sm:items-start">
            {/* Logo */}
            <div 
              onClick={() => navigate('/home')} 
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-[#16181c] cursor-pointer mb-4 transition"
            >
              <img src={logoSvg} alt="ArkNet Logo" className="h-10 w-10 object-contain rounded-lg" />
            </div>

            {/* Navigation links */}
            <nav className="space-y-2 w-full">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-4 py-3 px-4 rounded-full hover:bg-[#16181c] transition w-full text-left font-display group ${
                      isActive ? 'font-bold text-white' : 'text-[#e7e9ea]'
                    }`}
                  >
                    <div className="relative flex items-center">
                      <item.icon className={`h-7 w-7 transition group-hover:scale-105 ${isActive ? 'text-white stroke-2' : 'text-[#e7e9ea]'}`} />
                      {item.count !== undefined && item.count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-[#1d9bf0] rounded-full">
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:inline text-xl">{item.name}</span>
                  </button>
                )
              })}
            </nav>

            {/* Post button */}
            <button 
              onClick={() => setIsPostModalOpen(true)} 
              className="mt-6 w-12 h-12 sm:w-full sm:h-auto py-3 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full font-bold text-lg flex items-center justify-center transition shadow-md"
            >
              <span className="hidden sm:inline font-display">Post</span>
              <svg viewBox="0 0 24 24" className="h-6 w-6 sm:hidden text-white fill-current">
                <path d="M23 3c-6.62-.1-10.38 2.421-13.05 6.03C7.29 12.61 6 17.331 6 22h2c0-1.007.07-2.012.19-3H12c4.1 0 7.48-3.082 7.94-7.054C22.79.018 23 3 23 3zm-6.86 8.61c-.56 2.43-2.58 4.29-5.06 4.39l-.1.01h-2.18c.2-1.89 1.05-3.69 2.4-5.04 1.35-1.35 3.15-2.2 5.04-2.4v2.18l-.01.1c-.1 2.48-1.96 4.5-4.39 5.06zM1.5 15l2 2-2 2h2v2h2l2-2-2-2v-2h-2v-2h-2z" />
              </svg>
            </button>
          </div>

          {/* User profile dropdown trigger */}
          {user && (
            <div className="relative">
              {showLogoutMenu && (
                <div className="absolute bottom-16 left-0 w-64 bg-black border border-[#2f3336] rounded-2xl shadow-xl py-2 z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowLogoutMenu(false)
                      navigate('/profile')
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#16181c] transition text-[#e7e9ea]"
                  >
                    <UserIcon className="h-5 w-5 text-[#71767b]" />
                    <span className="font-semibold">Profile</span>
                  </button>
                  <div className="border-t border-[#2f3336] my-1"></div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#16181c] transition text-[#f4212e]"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    <span className="font-semibold">Log out @{userHandle}</span>
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className="flex items-center justify-between w-full p-3 rounded-full hover:bg-[#16181c] transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {userAvatar ? (
                    <img 
                      src={userAvatar} 
                      alt={userDisplayName} 
                      className="w-10 h-10 rounded-full object-cover border border-[#2f3336]" 
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                      {userDisplayName[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block min-w-0">
                    <p className="font-bold text-white truncate text-sm leading-tight">{userDisplayName}</p>
                    <p className="text-[#71767b] truncate text-sm">@{userHandle}</p>
                  </div>
                </div>
                <EllipsisHorizontalIcon className="hidden sm:block h-5 w-5 text-[#71767b]" />
              </button>
            </div>
          )}
        </aside>

        {/* Center column - main viewport */}
        <main className="flex-1 min-w-0 border-r border-[#2f3336] min-h-screen pb-24 sm:pb-0">
          {children || <Outlet />}
        </main>

        {/* Right Sidebar - Trending and Suggestions */}
        <aside className="hidden lg:block w-[350px] sticky top-0 h-screen py-3 px-6 space-y-4 overflow-y-auto flex-shrink-0">
          {/* Search bar */}
          <div className="sticky top-0 bg-black py-2 z-10">
            <div className="flex items-center gap-3 bg-[#16181c] rounded-full px-4 py-3 border border-transparent focus-within:border-[#1d9bf0] focus-within:bg-black group transition">
              <MagnifyingGlassIcon className="h-5 w-5 text-[#71767b] group-focus-within:text-[#1d9bf0]" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchSubmit}
                className="bg-transparent border-none outline-none text-[#e7e9ea] placeholder-[#71767b] w-full text-sm"
              />
            </div>
          </div>



          {/* Copyright/Footer links */}
          <footer className="text-xs text-[#71767b] px-4 space-y-1">
            <div className="flex flex-wrap gap-x-2">
              <a href="#" className="hover:underline">Terms of Service</a>
              <a href="#" className="hover:underline">Privacy Policy</a>
              <a href="#" className="hover:underline">Cookie Policy</a>
              <a href="#" className="hover:underline">More</a>
            </div>
            <p>© 2026 ArkNet. Built with Gemini</p>
          </footer>
        </aside>

      </div>
      <Modal
        isOpen={isPostModalOpen}
        title="Compose new post"
        onClose={() => setIsPostModalOpen(false)}
        panelClassName="max-w-lg animate-in fade-in zoom-in-95 duration-200"
      >
        <CreatePost onPostCreated={handleModalPostCreated} isModal={true} />
      </Modal>
    </div>
  )
}
