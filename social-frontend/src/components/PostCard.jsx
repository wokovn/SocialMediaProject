import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  ChatBubbleOvalLeftIcon,
  HeartIcon as HeartOutlineIcon,
  ShareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import postsService from '../services/postsService'
import CommentSection from './CommentSection'

const htmlTagRegex = /<\/?[a-z][\s\S]*>/i

const escapeHtml = (unsafe = '') =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const renderPostContent = (content = '') => {
  const source = htmlTagRegex.test(content)
    ? content
    : `<p>${escapeHtml(content).replace(/\n/g, '<br />')}</p>`

  return DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

const getImageSources = (item) => {
  const small = item?.variants?.small || null
  const medium = item?.variants?.medium || item?.thumbnailUrl || null
  const high = item?.variants?.high || item?.url || null
  const primarySrc = medium || high || small || ''

  const srcSetParts = []
  if (small) {
    srcSetParts.push(`${small} 480w`)
  }
  if (medium) {
    srcSetParts.push(`${medium} 960w`)
  }
  if (high) {
    srcSetParts.push(`${high} 1440w`)
  }

  const srcSet = srcSetParts.join(', ')

  return {
    src: primarySrc,
    srcSet: srcSet || undefined,
  }
}

function PostCard({ post, currentUser, onDeleted }) {
  const [isLiked, setIsLiked] = useState(post.hasLiked || false)
  const [likesCount, setLikesCount] = useState(post.likesCount || 0)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0)
  const [showComments, setShowComments] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const mediaItems = Array.isArray(post.media) ? post.media : []
  const safeHtml = renderPostContent(post.content)
  const authorProfilePath = post.author?.id ? `/profile/${post.author.id}` : null

  const isOwner = currentUser?.id === post.author?.id

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await postsService.deletePost(post.id)
    setDeleting(false)
    if (!error) onDeleted?.(post.id)
  }

  const formatDate = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  const handleLike = async () => {
    try {
      if (isLiked) {
        await postsService.unlikePost(post.id)
        setIsLiked(false)
        setLikesCount(prev => Math.max(0, prev - 1))
      } else {
        await postsService.likePost(post.id)
        setIsLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
      {/* Author Info */}
      <div className="flex items-center mb-4">
        {authorProfilePath ? (
          <Link
            to={authorProfilePath}
            className="inline-flex items-center min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {post.author?.avatar ? (
              <img
                src={post.author.avatar}
                alt={`${post.author?.fullName || post.author?.username || 'User'} avatar`}
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {post.author?.fullName?.[0]?.toUpperCase() || post.author?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="ml-3 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate hover:text-blue-700 transition">
                {post.author?.fullName || post.author?.username || 'Unknown User'}
              </h4>
              <p className="text-sm text-gray-500 truncate">
                {post.author?.username && `@${post.author.username} • `}
                {formatDate(post.createdAt)}
              </p>
            </div>
          </Link>
        ) : (
          <>
            {post.author?.avatar ? (
              <img
                src={post.author.avatar}
                alt="Author avatar"
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {post.author?.fullName?.[0]?.toUpperCase() || post.author?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="ml-3 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">
                {post.author?.fullName || post.author?.username || 'Unknown User'}
              </h4>
              <p className="text-sm text-gray-500 truncate">
                {post.author?.username && `@${post.author.username} • `}
                {formatDate(post.createdAt)}
              </p>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {post.visibility !== 'public' && (
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {post.visibility}
            </span>
          )}
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-40 transition"
            >
              <TrashIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{deleting ? 'Deleting…' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div
        className="mb-4 text-gray-800 break-words post-rich-content"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {mediaItems.length > 0 && (
        <div className={`mb-4 grid gap-3 ${mediaItems.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {mediaItems.map((item, index) => (
            <div
              key={item.id || `${post.id}-${index}`}
              className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            >
              {item.mediaType === 'video' ? (
                <video
                  src={item.url}
                  poster={item.thumbnailUrl || undefined}
                  preload="metadata"
                  controls
                  className="w-full max-h-96 bg-black"
                />
              ) : (
                (() => {
                  const imageSources = getImageSources(item)

                  return (
                    <img
                      src={imageSources.src}
                      srcSet={imageSources.srcSet}
                      sizes={mediaItems.length > 1 ? '(max-width: 640px) 100vw, 50vw' : '100vw'}
                      alt={item.altText || 'Post media'}
                      loading="lazy"
                      className="w-full max-h-96 object-cover"
                    />
                  )
                })()
              )}
            </div>
          ))}
        </div>
      )}

      {/* Post Stats & Actions */}
      <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
        <button
          onClick={handleLike}
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
          className={`flex items-center gap-2 transition ${
            isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
          }`}
        >
          {isLiked ? (
            <HeartSolidIcon className="w-5 h-5" aria-hidden="true" />
          ) : (
            <HeartOutlineIcon className="w-5 h-5" aria-hidden="true" />
          )}
          <span className="text-sm font-medium">{likesCount}</span>
        </button>

        <button
          onClick={() => setShowComments((v) => !v)}
          aria-label={showComments ? 'Hide comments' : 'Show comments'}
          className={`flex items-center gap-2 transition ${
            showComments ? 'text-green-600' : 'text-gray-500 hover:text-green-600'
          }`}
        >
          <ChatBubbleOvalLeftIcon className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-medium">{commentsCount}</span>
        </button>

        <button
          aria-label="Share post"
          className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition"
        >
          <ShareIcon className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-medium">{post.sharesCount || 0}</span>
        </button>
      </div>

      {showComments && (
        <CommentSection
          postId={post.id}
          currentUser={currentUser}
          onCommentCountChange={(delta) => setCommentsCount((prev) => Math.max(0, prev + delta))}
        />
      )}
    </div>
  )
}

export default PostCard
