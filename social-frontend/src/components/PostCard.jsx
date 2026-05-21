import { formatDistanceToNow } from 'date-fns'
import { Link, useSearchParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  BookmarkIcon as BookmarkOutlineIcon,
  ChatBubbleOvalLeftIcon,
  HeartIcon as HeartOutlineIcon,
  ShareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  BookmarkIcon as BookmarkSolidIcon,
  HeartIcon as HeartSolidIcon,
} from '@heroicons/react/24/solid'
import postsService from '../services/postsService'
import CommentSection from './CommentSection'
import Modal from './Modal'
import RichTextEditor from './RichTextEditor'
import VideoPlayer from './VideoPlayer'

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

import { usePostCard } from '../hooks/usePostCard'

function PostCard({ post, currentUser, onDeleted, onBookmarkChange, onPostShared, isModal = false }) {
  const {
    isLiked,
    isBookmarked,
    likesCount,
    commentsCount,
    setCommentsCount,
    sharesCount,
    showComments,
    setShowComments,
    deleting,
    bookmarkLoading,
    shareModalOpen,
    shareContent,
    setShareContent,
    shareError,
    shareSubmitting,
    isExpanded,
    setIsExpanded,
    isSharedExpanded,
    setIsSharedExpanded,
    originalPostModalOpen,
    setOriginalPostModalOpen,
    handleDelete,
    handleLike,
    handleBookmark,
    openShareModal,
    closeShareModal,
    submitShare
  } = usePostCard({ post, onDeleted, onBookmarkChange, onPostShared })
  const [, setSearchParams] = useSearchParams()

  const mediaItems = Array.isArray(post.media) ? post.media : []
  const safeHtml = renderPostContent(post.content)
  const isLongContent = (() => {
    if (!post.content) return false
    const textOnly = post.content.replace(/<[^>]*>/g, '')
    const lineCount = (post.content.match(/<p>|<br>|\n/g) || []).length
    return textOnly.length > 250 || lineCount > 8
  })()
  const authorProfilePath = post.author?.id ? `/profile/${post.author.id}` : null
  const sharedPost = post.sharedPost || null
  const sharedPostUnavailable = Boolean(post.sharedPostId && !sharedPost)
  const sharedPostHtml = sharedPost ? renderPostContent(sharedPost.content || '') : ''
  const isSharedLongContent = (() => {
    if (!sharedPost?.content) return false
    const textOnly = sharedPost.content.replace(/<[^>]*>/g, '')
    const lineCount = (sharedPost.content.match(/<p>|<br>|\n/g) || []).length
    return textOnly.length > 250 || lineCount > 8
  })()
  const sharedMediaItems = Array.isArray(sharedPost?.media) ? sharedPost.media : []

  const isOwner = currentUser?.id === post.author?.id

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
        className={`mb-4 text-gray-800 break-words post-rich-content ${!isExpanded && isLongContent ? 'line-clamp-4 overflow-hidden' : ''}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      {isLongContent && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="text-blue-500 hover:text-blue-700 text-sm font-medium mb-4 -mt-3 block"
        >
          {isExpanded ? 'Show less' : 'Show more...'}
        </button>
      )}

      {sharedPost && (
        <div 
          className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer hover:bg-gray-100 transition"
          onClick={() => setOriginalPostModalOpen(true)}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Shared post</p>
          <div className="mt-2 flex items-center gap-2">
            {sharedPost.author?.avatar ? (
              <img
                src={sharedPost.author.avatar}
                alt={`${sharedPost.author?.fullName || sharedPost.author?.username || 'User'} avatar`}
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                {sharedPost.author?.fullName?.[0]?.toUpperCase() || sharedPost.author?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {sharedPost.author?.fullName || sharedPost.author?.username || 'Unknown User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {sharedPost.author?.username && `@${sharedPost.author.username} • `}
                {formatDate(sharedPost.createdAt)}
              </p>
            </div>
          </div>

          <div
            className={`mt-2 text-gray-800 break-words post-rich-content ${!isSharedExpanded && isSharedLongContent ? 'line-clamp-3 overflow-hidden' : ''}`}
            dangerouslySetInnerHTML={{ __html: sharedPostHtml }}
          />
          {isSharedLongContent && (
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setIsSharedExpanded(!isSharedExpanded)
              }} 
              className="text-blue-500 hover:text-blue-700 text-sm font-medium mt-1 block"
            >
              {isSharedExpanded ? 'Show less' : 'Show more...'}
            </button>
          )}

          {sharedMediaItems.length > 0 && (
            <div className={`mt-3 grid gap-2 ${sharedMediaItems.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
              {sharedMediaItems.map((item, index) => (
                <div
                  key={item.id || `${sharedPost.id}-${index}`}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                >
                  {item.mediaType === 'video' ? (
                    <VideoPlayer
                      src={item.url}
                      poster={item.thumbnailUrl || undefined}
                      className="w-full aspect-auto max-h-[450px] min-h-[150px] bg-black rounded-md"
                    />
                  ) : (
                    (() => {
                      const imageSources = getImageSources(item)

                      return (
                        <img
                          src={imageSources.src}
                          srcSet={imageSources.srcSet}
                          sizes={sharedMediaItems.length > 1 ? '(max-width: 640px) 100vw, 50vw' : '100vw'}
                          alt={item.altText || 'Shared post media'}
                          loading="lazy"
                          className="w-full max-h-72 object-cover"
                        />
                      )
                    })()
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sharedPostUnavailable && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Original post is unavailable.
        </div>
      )}

      {mediaItems.length > 0 && (
        <div className={`mb-4 grid gap-3 ${mediaItems.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {mediaItems.map((item, index) => (
            <div
              key={item.id || `${post.id}-${index}`}
              className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            >
              {item.mediaType === 'video' ? (
              <VideoPlayer
                src={item.url}
                poster={item.thumbnailUrl || undefined}
                className="w-full aspect-auto max-h-[600px] min-h-[200px] bg-black rounded-lg"
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
          onClick={() => {
            if (isModal) {
              setShowComments((v) => !v);
            } else {
              setSearchParams(prev => {
                prev.set('postId', post.id);
                return prev;
              });
            }
          }}
          aria-label={showComments ? 'Hide comments' : 'Show comments'}
          className={`flex items-center gap-2 transition ${
            showComments ? 'text-green-600' : 'text-gray-500 hover:text-green-600'
          }`}
        >
          <ChatBubbleOvalLeftIcon className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-medium">{commentsCount}</span>
        </button>

        <button
          onClick={handleBookmark}
          disabled={bookmarkLoading}
          aria-label={isBookmarked ? 'Remove from saved posts' : 'Save post'}
          className={`flex items-center gap-2 transition disabled:opacity-50 ${
            isBookmarked
              ? 'text-amber-600'
              : 'text-gray-500 hover:text-amber-600'
          }`}
        >
          {isBookmarked ? (
            <BookmarkSolidIcon className="w-5 h-5" aria-hidden="true" />
          ) : (
            <BookmarkOutlineIcon className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        <button
          onClick={openShareModal}
          disabled={shareSubmitting}
          aria-label="Share post"
          className="flex items-center gap-2 text-gray-500 hover:text-purple-600 transition disabled:opacity-50"
        >
          <ShareIcon className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-medium">{sharesCount}</span>
        </button>
      </div>

      {showComments && (
        <CommentSection
          postId={post.id}
          currentUser={currentUser}
          onCommentCountChange={(delta) => setCommentsCount((prev) => Math.max(0, prev + delta))}
        />
      )}

      <Modal
        isOpen={shareModalOpen}
        title="Share post"
        onClose={closeShareModal}
        panelClassName="max-w-2xl"
        actions={(
          <>
            <button
              type="button"
              onClick={closeShareModal}
              disabled={shareSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitShare}
              disabled={shareSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {shareSubmitting ? 'Sharing...' : 'Share'}
            </button>
          </>
        )}
      >
        <p className="mb-2 text-sm text-gray-600">Add your thoughts (optional).</p>
        <RichTextEditor
          value={shareContent}
          onChange={setShareContent}
          placeholder="Say something about this post..."
          disabled={shareSubmitting}
        />
        
        {/* Post Preview inside Share Modal */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            {post.author?.avatar ? (
              <img src={post.author.avatar} alt="Author" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-[10px] font-semibold">
                {post.author?.fullName?.[0]?.toUpperCase() || post.author?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className="text-sm font-semibold text-gray-900">{post.author?.fullName || post.author?.username}</span>
          </div>
          <div className="text-sm text-gray-700 line-clamp-3 post-rich-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          {mediaItems.length > 0 && (
            <p className="mt-2 text-xs text-gray-500 font-medium">Includes {mediaItems.length} media item(s)</p>
          )}
        </div>

        {shareError && (
          <p className="mt-2 text-sm text-red-600">{shareError}</p>
        )}
      </Modal>

      {/* Original Post Modal */}
      {sharedPost && (
        <Modal
          isOpen={originalPostModalOpen}
          title="Original Post"
          onClose={() => setOriginalPostModalOpen(false)}
          panelClassName="max-w-2xl"
        >
          <div className="-mx-4 sm:-mx-6 -my-4">
            <PostCard
              post={sharedPost}
              currentUser={currentUser}
              onDeleted={(id) => {
                setOriginalPostModalOpen(false)
                onDeleted?.(id)
              }}
              onBookmarkChange={onBookmarkChange}
              onPostShared={onPostShared}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default PostCard
