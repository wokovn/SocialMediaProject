import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'
import postsService from '../services/postsService'
import CreatePost from '../components/CreatePost'
import Feed from '../components/Feed'
import TwitterLayout from '../components/TwitterLayout'

function Home() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState(null)
  const cursorRef = useRef(null)
  const [activeTab, setActiveTab] = useState('foryou') // 'foryou' (hybrid) or 'global' (public)
  const limit = 10

  useEffect(() => {
    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) {
      // Scroll to top and reset state when tab or user changes
      window.scrollTo({ top: 0, behavior: 'instant' })
      setPosts([])
      setHasMore(false)
      cursorRef.current = null
      loadFeed(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab])

  useEffect(() => {
    const handlePostCreatedEvent = (e) => {
      const newPost = e.detail
      if (newPost) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === newPost.id)) return prev
          return [newPost, ...prev]
        })
      }
    }

    window.addEventListener('post-created', handlePostCreatedEvent)
    return () => {
      window.removeEventListener('post-created', handlePostCreatedEvent)
    }
  }, [])

  async function checkUser() {
    const { user, error } = await authService.getCurrentUser()
    
    if (error || !user) {
      navigate('/login')
      return
    }
    
    setUser(user)
    setLoading(false)
  }

  const loadFeed = useCallback(async (isLoadMore = false) => {
    setFeedLoading(true)
    const currentCursor = isLoadMore ? cursorRef.current : null
    
    // Choose between hybrid feed and public feed
    const fetchFeed = activeTab === 'foryou' 
      ? postsService.getHybridFeed(limit, currentCursor) 
      : postsService.getPublicFeed(limit, currentCursor)
      
    const { data, error } = await fetchFeed
    
    if (!error && data) {
      if (isLoadMore) {
        setPosts((prev) => {
          const newPosts = data.filter(d => !prev.some(p => p.id === d.id))
          
          if (newPosts.length === 0 && data.length > 0) {
            setHasMore(false)
            return prev
          }
          
          setHasMore(data.length === limit)
          return [...prev, ...newPosts]
        })
      } else {
        setPosts(data)
        setHasMore(data.length === limit)
      }
      if (data.length > 0) {
        const newCursor = data[data.length - 1].createdAt
        setCursor(newCursor)
        cursorRef.current = newCursor
      }
    }
    
    setFeedLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handlePostCreated = async ({ content, visibility, files }) => {
    const { data, error } = await postsService.createPost({
      content,
      visibility,
      files,
      userId: user?.id,
    })
    
    if (!error && data) {
      // data = { message, postId, post } — extract the post object
      const newPost = data.post || data
      if (newPost?.id) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === newPost.id)) return prev
          return [newPost, ...prev]
        })
      }
    } else {
      throw new Error(error || 'Failed to create post')
    }
  }

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const handlePostShared = (sharedPost) => {
    if (!sharedPost?.id) {
      return
    }
    setPosts((prev) => [sharedPost, ...prev.filter((post) => post.id !== sharedPost.id)])
  }

  const handleLoadMore = useCallback(() => {
    loadFeed(true)
  }, [loadFeed])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Home Header & Tabs */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2f3336]">
        <div className="px-4 py-3">
          <h2 className="text-xl font-bold font-display text-white">Home</h2>
        </div>
        
        {/* Tab Selection */}
        <div className="flex border-t border-[#2f3336] text-sm">
          <button 
            onClick={() => { 
              if (activeTab !== 'foryou') {
                setActiveTab('foryou')
                setCursor(null)
                cursorRef.current = null
              }
            }}
            className="flex-1 py-4 text-center hover:bg-[#16181c] transition relative text-white font-bold"
          >
            <span className={activeTab === 'foryou' ? 'text-white' : 'text-[#71767b]'}>For you</span>
            {activeTab === 'foryou' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#1d9bf0] rounded-full" />
            )}
          </button>
          <button 
            onClick={() => { 
              if (activeTab !== 'global') {
                setActiveTab('global')
                setCursor(null)
                cursorRef.current = null
              }
            }}
            className="flex-1 py-4 text-center hover:bg-[#16181c] transition relative text-white font-bold"
          >
            <span className={activeTab === 'global' ? 'text-white' : 'text-[#71767b]'}>Global</span>
            {activeTab === 'global' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1d9bf0] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Main post editor */}
      <div className="border-b border-[#2f3336] p-4">
        <CreatePost onPostCreated={handlePostCreated} />
      </div>

      {/* Feed List */}
      <div className="pb-12">
        <Feed 
          posts={posts} 
          loading={feedLoading}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          currentUser={user}
          onPostDeleted={handlePostDeleted}
          onPostShared={handlePostShared}
        />
      </div>
    </>
  )
}

export default Home
