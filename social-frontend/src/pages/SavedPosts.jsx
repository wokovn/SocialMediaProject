import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import postsService from '../services/postsService'
import Feed from '../components/Feed'
import TwitterLayout from '../components/TwitterLayout'

function SavedPosts() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState(null)
  const cursorRef = useRef(null)
  const limit = 10

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadSavedPosts(false)
    }
  }, [user])

  const checkUser = async () => {
    const { user, error } = await authService.getCurrentUser()

    if (error || !user) {
      navigate('/login')
      return
    }

    setUser(user)
    setLoading(false)
  }

  const loadSavedPosts = useCallback(async (isLoadMore = false) => {
    setFeedLoading(true)
    const currentCursor = isLoadMore ? cursorRef.current : null

    const { data, error } = await postsService.getSavedPosts(limit, currentCursor)
    if (!error && data) {
      if (isLoadMore) {
        setPosts((prev) => {
          const newPosts = data.filter(d => !prev.some(p => p.id === d.id))
          setHasMore(newPosts.length > 0 && data.length === limit)
          return newPosts.length > 0 ? [...prev, ...newPosts] : prev
        })
      } else {
        setPosts(data)
        setHasMore(data.length === limit)
        cursorRef.current = null
      }
      if (data.length > 0) {
        const newCursor = data[data.length - 1].savedAt
        setCursor(newCursor)
        cursorRef.current = newCursor
      }
    }

    setFeedLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLoadMore = useCallback(() => {
    loadSavedPosts(true)
  }, [loadSavedPosts])

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId))
  }

  const handlePostBookmarkChange = (postId, isBookmarked) => {
    if (isBookmarked) {
      return
    }

    setPosts((prev) => prev.filter((post) => post.id !== postId))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2f3336] px-4 py-3 flex items-center gap-6">
        <button
          onClick={() => navigate('/home')}
          className="p-2 rounded-full hover:bg-[#16181c] text-white transition"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-white">
            <path d="M7.414 13l5.013 5.01 1.414-1.41-6.013-6H21v-2H7.828l6.013-6-1.414-1.41L7.414 11H2v2h5.414z" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold font-display text-white">Bookmarks</h2>
          <p className="text-xs text-[#71767b]">{posts.length} {posts.length === 1 ? 'bookmark' : 'bookmarks'}</p>
        </div>
      </div>

      {/* Bookmarked Feed */}
      <div className="pb-12">
        <Feed
          posts={posts}
          loading={feedLoading}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          currentUser={user}
          onPostDeleted={handlePostDeleted}
          onPostBookmarkChange={handlePostBookmarkChange}
          emptyTitle="Save posts for later"
          emptyDescription="Don’t let the good ones fly away! Bookmark posts to easily find them again in the future."
        />
      </div>
    </>
  )
}

export default SavedPosts
