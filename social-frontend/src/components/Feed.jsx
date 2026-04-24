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

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onDeleted={onPostDeleted}
          onBookmarkChange={onPostBookmarkChange}
          onPostShared={onPostShared}
        />
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
