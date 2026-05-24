import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserPlusIcon,
  UserIcon,
  NewspaperIcon,
} from '@heroicons/react/24/outline'
import authService from '../services/authService'
import profileService from '../services/profileService'
import Feed from '../components/Feed'

export default function Search() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''

  const [authUser, setAuthUser] = useState(null)
  const [searchInput, setSearchInput] = useState(query)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'users' | 'posts'
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const { user } = await authService.getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }
      setAuthUser(user)
    }
    checkAuth()
  }, [navigate])

  useEffect(() => {
    setSearchInput(query)
    if (query.trim()) {
      handleSearch(query, activeTab)
    } else {
      setUsers([])
      setPosts([])
    }
  }, [query, activeTab])

  const handleSearch = async (searchTerm, filter) => {
    setLoading(true)
    setError('')
    try {
      const { data, error: searchError } = await profileService.search({
        q: searchTerm,
        filter: filter,
        limit: 30,
      })

      if (searchError) throw new Error(searchError)

      setUsers(data?.users || [])
      setPosts(data?.posts || [])
    } catch (err) {
      setError(err.message || 'Something went wrong during search.')
    } finally {
      setLoading(false)
    }
  }

  const onSearchSubmit = (e) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() })
    }
  }

  const handleFollowToggle = async (targetUser) => {
    try {
      const { data, error: followError } = targetUser.isFollowing
        ? await profileService.unfollowUser(targetUser.id)
        : await profileService.followUser(targetUser.id)

      if (followError) throw new Error(followError)

      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, isFollowing: !u.isFollowing } : u
        )
      )
    } catch (err) {
      setError(err.message || 'Failed to update follow state.')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Search Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2f3336] p-4 space-y-3">
        <form onSubmit={onSearchSubmit} className="flex items-center gap-3 bg-[#16181c] rounded-full px-4 py-2.5 border border-transparent focus-within:border-[#1d9bf0] focus-within:bg-black group transition">
          <MagnifyingGlassIcon className="h-5 w-5 text-[#71767b] group-focus-within:text-[#1d9bf0]" />
          <input
            type="text"
            placeholder="Search ArkNet (use @username for people)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-transparent border-none outline-none text-[#e7e9ea] placeholder-[#71767b] w-full text-sm"
          />
        </form>

        {/* Filters Tabs */}
        <div className="flex border-b border-[#2f3336]">
          {[
            { id: 'all', label: 'Top' },
            { id: 'users', label: 'People' },
            { id: 'posts', label: 'Latest' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 text-center py-3 text-sm font-bold relative hover:bg-[#16181c] transition"
              >
                <span className={isActive ? 'text-white font-extrabold' : 'text-[#71767b]'}>{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#1d9bf0] rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search Results Area */}
      <div className="pb-24">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <ArrowPathIcon className="h-8 w-8 text-[#1d9bf0] animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">{error}</div>
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <MagnifyingGlassIcon className="h-16 w-16 text-[#2f3336] mb-4" />
            <h3 className="text-xl font-bold text-white mb-1">Search for users and posts</h3>
            <p className="text-sm text-[#71767b] max-w-sm">
              Type what you are looking for in the search bar above. Try `@name` to find users.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Users section */}
            {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
              <div className="border-b border-[#2f3336] last:border-b-0">
                {activeTab === 'all' && (
                  <h4 className="text-lg font-black font-display px-4 py-3 border-b border-[#2f3336] text-white">
                    People
                  </h4>
                )}
                <div className="divide-y divide-[#2f3336]">
                  {users.map((userItem) => (
                    <div key={userItem.id} className="flex justify-between items-center px-4 py-3 hover:bg-[#16181c]/30 transition gap-3">
                      <div
                        onClick={() => navigate(`/profile/${userItem.id}`)}
                        className="flex gap-3 cursor-pointer group flex-1 min-w-0"
                      >
                        {userItem.avatar ? (
                          <img src={userItem.avatar} alt="Avatar" className="h-11 w-11 rounded-full object-cover" />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] flex items-center justify-center text-white font-bold">
                            {(userItem.fullName?.[0] || userItem.username?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-white group-hover:underline truncate leading-tight">
                            {userItem.fullName || userItem.username}
                          </p>
                          <p className="text-xs text-[#71767b] truncate">@{userItem.username}</p>
                          {userItem.bio && (
                            <p className="text-xs text-[#e7e9ea] truncate mt-1 max-w-lg">{userItem.bio}</p>
                          )}
                        </div>
                      </div>

                      {/* Follow/Unfollow button */}
                      {!userItem.isSelf && authUser && (
                        <button
                          onClick={() => handleFollowToggle(userItem)}
                          className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                            userItem.isFollowing
                              ? 'border border-[#2f3336] text-white hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 group/btn'
                              : 'bg-white text-black hover:bg-[#e6e6e6]'
                          }`}
                        >
                          {userItem.isFollowing ? (
                            <>
                              <span className="group-hover/btn:hidden">Following</span>
                              <span className="hidden group-hover/btn:inline">Unfollow</span>
                            </>
                          ) : (
                            'Follow'
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Posts section */}
            {(activeTab === 'all' || activeTab === 'posts') && (
              <div>
                {activeTab === 'all' && posts.length > 0 && (
                  <h4 className="text-lg font-black font-display px-4 py-3 border-b border-[#2f3336] text-white">
                    Latest Posts
                  </h4>
                )}
                {posts.length > 0 ? (
                  <Feed
                    posts={posts}
                    loading={false}
                    hasMore={false}
                    onLoadMore={() => {}}
                    currentUser={authUser}
                    emptyTitle="No posts found"
                    emptyDescription="Try searching for another keyword."
                  />
                ) : (
                  activeTab === 'posts' && (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                      <NewspaperIcon className="h-16 w-16 text-[#2f3336] mb-4" />
                      <h3 className="text-xl font-bold text-white mb-1">No posts found</h3>
                      <p className="text-sm text-[#71767b] max-w-sm">
                        Try checking your spelling or search for something else.
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* General Empty state */}
            {users.length === 0 && posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <UserIcon className="h-16 w-16 text-[#2f3336] mb-4" />
                <h3 className="text-xl font-bold text-white mb-1">No results for "{query}"</h3>
                <p className="text-sm text-[#71767b] max-w-sm">
                  Try checking your spelling or searching for another keyword.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
