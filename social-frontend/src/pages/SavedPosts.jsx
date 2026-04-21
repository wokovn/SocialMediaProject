import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline'
import authService from '../services/authService'
import postsService from '../services/postsService'
import Feed from '../components/Feed'

function SavedPosts() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 20

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

  const loadSavedPosts = async (isLoadMore = false) => {
    setFeedLoading(true)
    const currentOffset = isLoadMore ? offset : 0

    const { data, error } = await postsService.getSavedPosts(limit, currentOffset)
    if (!error && data) {
      setPosts((prev) => (isLoadMore ? [...prev, ...data] : data))
      setHasMore(data.length === limit)
      setOffset(currentOffset + data.length)
    }

    setFeedLoading(false)
  }

  const handleLoadMore = () => {
    loadSavedPosts(true)
  }

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading saved posts...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back to Feed
            </button>

            <div className="inline-flex items-center gap-2 text-gray-900">
              <BookmarkIcon className="h-5 w-5" aria-hidden="true" />
              <h1 className="text-lg font-semibold">Saved Posts</h1>
            </div>

            <div className="w-24" />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Feed
          posts={posts}
          loading={feedLoading}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          currentUser={user}
          onPostDeleted={handlePostDeleted}
          onPostBookmarkChange={handlePostBookmarkChange}
          emptyTitle="No saved posts yet"
          emptyDescription="Tap Save on a post in your feed to keep it here."
        />
      </main>
    </div>
  )
}

export default SavedPosts
