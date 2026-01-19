import { formatDistanceToNow } from 'date-fns'

function PostCard({ post }) {
  const formatDate = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
      {/* Author Info */}
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
          {post.author?.fullName?.[0]?.toUpperCase() || post.author?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="ml-3">
          <h4 className="font-semibold text-gray-900">
            {post.author?.fullName || post.author?.username || 'Unknown User'}
          </h4>
          <p className="text-sm text-gray-500">
            {post.author?.username && `@${post.author.username} • `}
            {formatDate(post.createdAt)}
          </p>
        </div>
        {post.visibility !== 'public' && (
          <span className="ml-auto px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            {post.visibility}
          </span>
        )}
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <p className="text-gray-800 whitespace-pre-wrap break-words">
          {post.content}
        </p>
      </div>

      {/* Post Stats & Actions */}
      <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
        <button className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-sm font-medium">{post.likesCount || 0}</span>
        </button>

        <button className="flex items-center gap-2 text-gray-500 hover:text-green-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium">{post.commentsCount || 0}</span>
        </button>

        <button className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-sm font-medium">{post.sharesCount || 0}</span>
        </button>
      </div>
    </div>
  )
}

export default PostCard
