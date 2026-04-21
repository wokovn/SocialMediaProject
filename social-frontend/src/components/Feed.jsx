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
  emptyTitle = 'No posts yet',
  emptyDescription = 'Be the first to create a post!',
}) {
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
        />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}

export default Feed
