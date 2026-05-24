import { useEffect, useRef, useCallback } from 'react'
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
  const loadingRef = useRef(loading)
  const onLoadMoreRef = useRef(onLoadMore)

  // Keep refs in sync to avoid stale closures in observer callback
  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  // Setup IntersectionObserver only when hasMore changes — not on every loading state change
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          onLoadMoreRef.current()
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore])

  const seenPostsRef = useRef(new Set())
  const seenBatchRef = useRef([])
  const seenTimerRef = useRef(null)

  // Flush seen batch to server — called after debounce
  const flushSeenBatch = useCallback(() => {
    if (seenBatchRef.current.length === 0) return
    const toSend = [...seenBatchRef.current]
    seenBatchRef.current = []
    import('../services/postsService').then((module) => {
      module.default.markSeen(toSend).catch(console.error)
    })
  }, [])

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
          // Batch: accumulate IDs, debounce flush by 1.5s
          seenBatchRef.current.push(...newSeenIds)
          if (seenTimerRef.current) clearTimeout(seenTimerRef.current)
          seenTimerRef.current = setTimeout(flushSeenBatch, 1500)
        }
      },
      { threshold: 0.5 }
    )

    const elements = document.querySelectorAll('.post-card-container')
    elements.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [posts, currentUser, flushSeenBatch])

  // Flush remaining batch on unmount
  useEffect(() => {
    return () => {
      if (seenTimerRef.current) clearTimeout(seenTimerRef.current)
      flushSeenBatch()
    }
  }, [flushSeenBatch])

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
      </div>
    )
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="p-12 text-center border-t border-[#2f3336]">
        <NewspaperIcon className="mx-auto h-12 w-12 text-[#71767b]" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-bold text-white font-display">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-[#71767b]">{emptyDescription}</p>
      </div>
    )
  }

  const firstCaughtUpIndex = posts.findIndex(p => p.isCaughtUp)

  return (
    <div className="divide-y divide-[#2f3336]">
      {posts.map((post, index) => (
        <div key={post.id} className="w-full">
          {index === firstCaughtUpIndex && (
            <div className="bg-[#16181c] border border-[#2f3336] rounded-2xl p-6 my-4 mx-4 text-center shadow-lg">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-[#1d9bf0]/10 rounded-full mb-3 text-[#1d9bf0]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-md font-bold text-white font-display">You're all caught up!</h3>
              <p className="text-xs text-[#71767b] mt-1">You've seen all new posts from people you followed. Here are some suggested posts.</p>
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

      {/* Sentinel for Infinite Scroll — invisible trigger element */}
      {hasMore && <div ref={sentinelRef} className="h-4" aria-hidden="true" />}

      {/* Loading spinner — shown when actively fetching more */}
      {loading && posts.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
        </div>
      )}

      {/* End of feed indicator */}
      {!hasMore && posts.length > 0 && (
        <div className="py-8 text-center text-sm text-[#71767b]">
          You&apos;ve reached the end
        </div>
      )}
    </div>
  )
}

export default Feed
