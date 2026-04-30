import { useEffect, useRef } from 'react'
import { NewspaperIcon } from '@heroicons/react/24/outline'
import PostCard from './PostCard'

function Feed({
  posts,
  loading,
  onLoadMore,
  hasMore,
  currentUser,
  onPostDeleted,
  onPostBookmarkChange,
  onPostShared,
  emptyTitle = 'No posts yet',
  emptyDescription = 'Be the first to create a post!',
}) {
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    observer.observe(sentinelRef.current)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loading, onLoadMore])

  const seenPostsRef = useRef(new Set())

  useEffect(() => {
    if (!currentUser) return

    const observer = new IntersectionObserver(
      (entries) => {
        const newSeenIds = []
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postId = entry.target.dataset.postId
            if (postId && !seenPostsRef.current.has(postId)) {
              seenPostsRef.current.add(postId)
              newSeenIds.push(postId)
            }
          }
        })

        if (newSeenIds.length > 0) {
          import('../services/postsService').then((module) => {
            module.default.markSeen(newSeenIds).catch(console.error)
          })
        }
      },
      { threshold: 0.5 }
    )

    const elements = document.querySelectorAll('.post-card-container')
    elements.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [posts, currentUser])

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <NewspaperIcon className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-gray-500">{emptyDescription}</p>
      </div>
    )
  }

  const firstCaughtUpIndex = posts.findIndex(p => p.isCaughtUp)

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <div key={post.id}>
          {index === firstCaughtUpIndex && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 my-8 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">You're all caught up!</h3>
              <p className="text-sm text-gray-500 mt-1">You've seen all new posts from your friends and people you followed. Here are some suggested posts.</p>
            </div>
          )}
          <div className="post-card-container" data-post-id={post.id}>
            <PostCard
              post={post}
              currentUser={currentUser}
              onDeleted={onPostDeleted}
              onBookmarkChange={onPostBookmarkChange}
              onPostShared={onPostShared}
            />
          </div>
        </div>
      ))}

      {/* Sentinel for Infinite Scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

export default Feed
