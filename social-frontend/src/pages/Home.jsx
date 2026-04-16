import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import authService from '../services/authService'
import postsService from '../services/postsService'
import CreatePost from '../components/CreatePost'
import Feed from '../components/Feed'

function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 20

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadFeed()
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

  const loadFeed = async (isLoadMore = false) => {
    setFeedLoading(true)
    const currentOffset = isLoadMore ? offset : 0
    
    const { data, error } = await postsService.getPublicFeed(limit, currentOffset)
    
    if (!error && data) {
      if (isLoadMore) {
        setPosts([...posts, ...data])
      } else {
        setPosts(data)
      }
      
      setHasMore(data.length === limit)
      setOffset(currentOffset + data.length)
    }
    
    setFeedLoading(false)
  }

  const handlePostCreated = async ({ content, visibility, files }) => {
    const { data, error } = await postsService.createPost({
      content,
      visibility,
      files,
      userId: user?.id,
    })
    
    if (!error && data) {
      // Reload the feed to show the new post
      setOffset(0)
      await loadFeed(false)
    } else {
      throw new Error(error || 'Failed to create post')
    }
  }

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const handleLoadMore = () => {
    loadFeed(true)
  }

  const handleSignOut = async () => {
    await authService.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-xl font-bold text-gray-900">Social Feed</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.user_metadata?.full_name || user?.email}
              </span>
              <button
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <UserCircleIcon className="w-4 h-4" aria-hidden="true" />
                Profile
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CreatePost onPostCreated={handlePostCreated} />
        
        <Feed 
          posts={posts} 
          loading={feedLoading}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          currentUser={user}
          onPostDeleted={handlePostDeleted}
        />
      </main>
    </div>
  )
}

export default Home
