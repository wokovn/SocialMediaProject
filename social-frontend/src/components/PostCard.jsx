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
import CommentSection from './CommentSection'
import Modal from './Modal'
import RichTextEditor from './RichTextEditor'
import VideoPlayer from './VideoPlayer'
import { usePostCard } from '../hooks/usePostCard'

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
    <div className="bg-black border-b border-[#2f3336] p-4 sm:p-5 hover:bg-[#16181c]/40 transition duration-200">
      <div className="flex gap-3">
        {/* Left Column: Avatar */}
        <div className="flex-shrink-0">
          {authorProfilePath ? (
            <Link to={authorProfilePath} className="block group">
              {post.author?.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={`${post.author?.fullName || post.author?.username || 'User'} avatar`}
                  className="w-10 h-10 rounded-full object-cover border border-[#2f3336] group-hover:opacity-90 transition"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {(post.author?.fullName?.[0] || post.author?.username?.[0] || 'U').toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <div>
              {post.author?.avatar ? (
                <img
                  src={post.author.avatar}
                  alt="Author avatar"
                  className="w-10 h-10 rounded-full object-cover border border-[#2f3336]"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {(post.author?.fullName?.[0] || post.author?.username?.[0] || 'U').toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Post Body */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-x-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {authorProfilePath ? (
                <Link to={authorProfilePath} className="font-bold text-white hover:underline truncate">
                  {post.author?.fullName || post.author?.username || 'Unknown User'}
                </Link>
              ) : (
                <span className="font-bold text-white truncate">
                  {post.author?.fullName || post.author?.username || 'Unknown User'}
                </span>
              )}
              {post.author?.username && (
                <span className="text-sm text-[#71767b] truncate">@{post.author.username}</span>
              )}
              <span className="text-sm text-[#71767b]">•</span>
              <span className="text-sm text-[#71767b] hover:underline" title={new Date(post.createdAt).toLocaleString()}>
                {formatDate(post.createdAt)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {post.visibility !== 'public' && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#1d9bf0]/10 text-[#1d9bf0] rounded-full border border-[#1d9bf0]/20">
                  {post.visibility}
                </span>
              )}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-1.5 rounded-full hover:bg-red-500/10 text-[#71767b] hover:text-[#f4212e] disabled:opacity-40 transition"
                  title="Delete post"
                >
                  <TrashIcon className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Text Content */}
          <div
            className={`text-[15px] leading-relaxed text-[#e7e9ea] break-words post-rich-content ${!isExpanded && isLongContent ? 'line-clamp-4 overflow-hidden' : ''}`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
          {isLongContent && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="text-[#1d9bf0] hover:underline text-sm font-medium mt-1 mb-2 block"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {/* Shared Post (Retweet) Block */}
          {sharedPost && (
            <div 
              className="mt-3 rounded-2xl border border-[#2f3336] bg-black p-3.5 hover:bg-[#16181c]/30 transition cursor-pointer"
              onClick={() => setOriginalPostModalOpen(true)}
            >
              <div className="flex items-center gap-2 mb-2">
                {sharedPost.author?.avatar ? (
                  <img
                    src={sharedPost.author.avatar}
                    alt={`${sharedPost.author?.fullName || sharedPost.author?.username || 'User'} avatar`}
                    className="w-5 h-5 rounded-full object-cover border border-[#2f3336]"
                  />
                ) : (
                  <div className="w-5 h-5 bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                    {(sharedPost.author?.fullName?.[0] || sharedPost.author?.username?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-bold text-white truncate">
                  {sharedPost.author?.fullName || sharedPost.author?.username}
                </span>
                {sharedPost.author?.username && (
                  <span className="text-xs text-[#71767b] truncate">@{sharedPost.author.username}</span>
                )}
                <span className="text-xs text-[#71767b]">•</span>
                <span className="text-xs text-[#71767b]">{formatDate(sharedPost.createdAt)}</span>
              </div>

              <div
                className={`text-sm leading-relaxed text-[#e7e9ea] break-words post-rich-content ${!isSharedExpanded && isSharedLongContent ? 'line-clamp-3 overflow-hidden' : ''}`}
                dangerouslySetInnerHTML={{ __html: sharedPostHtml }}
              />
              {isSharedLongContent && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSharedExpanded(!isSharedExpanded)
                  }} 
                  className="text-[#1d9bf0] hover:underline text-xs font-medium mt-1 block"
                >
                  {isSharedExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {sharedMediaItems.length > 0 && (
                <div className={`mt-3 grid gap-2 overflow-hidden rounded-2xl border border-[#2f3336] ${sharedMediaItems.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {sharedMediaItems.map((item, index) => (
                    <div key={item.id || `${sharedPost.id}-${index}`} className="relative bg-black">
                      {item.mediaType === 'video' ? (
                        <VideoPlayer
                          src={item.url}
                          poster={item.thumbnailUrl || undefined}
                          className="w-full aspect-video bg-black"
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
            <div className="mt-3 rounded-2xl border border-[#2f3336] bg-[#16181c]/20 px-4 py-3 text-sm text-[#71767b] italic">
              Original post is unavailable.
            </div>
          )}

          {/* Media Items Block */}
          {mediaItems.length > 0 && (
            <div className={`mt-3 grid gap-2 overflow-hidden rounded-2xl border border-[#2f3336] ${mediaItems.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {mediaItems.map((item, index) => (
                <div key={item.id || `${post.id}-${index}`} className="relative bg-black">
                  {item.mediaType === 'video' ? (
                    <VideoPlayer
                      src={item.url}
                      poster={item.thumbnailUrl || undefined}
                      className="w-full aspect-video bg-black"
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
                          className="w-full max-h-[500px] object-cover mx-auto"
                        />
                      )
                    })()
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Interaction Bar */}
          <div className="flex items-center justify-between mt-4 max-w-md text-[#71767b]">
            {/* Like Button */}
            <button
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike post' : 'Like post'}
              className={`flex items-center gap-2 transition group text-sm ${isLiked ? 'text-[#f4212e]' : 'hover:text-[#f4212e]'}`}
            >
              <div className={`p-2 rounded-full ${isLiked ? '' : 'group-hover:bg-[#f4212e]/10'}`}>
                {isLiked ? (
                  <HeartSolidIcon className="w-[18px] h-[18px] text-[#f4212e] transform scale-110 transition-transform" />
                ) : (
                  <HeartOutlineIcon className="w-[18px] h-[18px]" />
                )}
              </div>
              <span className="font-semibold">{likesCount}</span>
            </button>

            {/* Comment Button */}
            <button
              onClick={() => setShowComments((v) => !v)}
              aria-label={showComments ? 'Hide comments' : 'Show comments'}
              className="flex items-center gap-2 hover:text-[#1d9bf0] transition group text-sm"
            >
              <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10">
                <ChatBubbleOvalLeftIcon className="w-[18px] h-[18px]" />
              </div>
              <span className="font-semibold">{commentsCount}</span>
            </button>


            {/* Bookmark Button */}
            <button
              onClick={handleBookmark}
              disabled={bookmarkLoading}
              aria-label={isBookmarked ? 'Remove from saved posts' : 'Save post'}
              className={`flex items-center gap-2 transition group text-sm disabled:opacity-50 ${isBookmarked ? 'text-[#e6af2e]' : 'hover:text-[#e6af2e]'}`}
            >
              <div className="p-2 rounded-full group-hover:bg-[#e6af2e]/10">
                {isBookmarked ? (
                  <BookmarkSolidIcon className="w-[18px] h-[18px] text-[#e6af2e]" />
                ) : (
                  <BookmarkOutlineIcon className="w-[18px] h-[18px]" />
                )}
              </div>
            </button>

            {/* Retweet/Share Button */}
            <button
              onClick={openShareModal}
              disabled={shareSubmitting}
              aria-label="Share post"
              className="flex items-center gap-2 hover:text-[#00ba7c] transition group text-sm disabled:opacity-50"
            >
              <div className="p-2 rounded-full group-hover:bg-[#00ba7c]/10">
                <ShareIcon className="w-[18px] h-[18px]" />
              </div>
              <span className="font-semibold">{sharesCount}</span>
            </button>
          </div>

          {/* Comments Section Drawer */}
          {showComments && (
            <div className="mt-4 border-t border-[#2f3336] pt-4">
              <CommentSection
                postId={post.id}
                currentUser={currentUser}
                onCommentCountChange={(delta) => setCommentsCount((prev) => Math.max(0, prev + delta))}
                onClose={() => setShowComments(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Share/Retweet Dialog Modal */}
      <Modal
        isOpen={shareModalOpen}
        title="Share Post"
        onClose={closeShareModal}
        actions={(
          <>
            <button
              type="button"
              onClick={closeShareModal}
              disabled={shareSubmitting}
              className="rounded-full border border-[#2f3336] px-4 py-2 text-sm font-bold text-[#e7e9ea] hover:bg-[#16181c]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitShare}
              disabled={shareSubmitting}
              className="rounded-full bg-[#1d9bf0] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a8cd8]"
            >
              {shareSubmitting ? 'Sharing...' : 'Share'}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-[#71767b]">Add your thoughts (optional):</p>
          <RichTextEditor
            value={shareContent}
            onChange={setShareContent}
            placeholder="Say something about this post..."
            disabled={shareSubmitting}
          />
          
          {/* Post Preview inside Modal */}
          <div className="rounded-2xl border border-[#2f3336] p-4 bg-[#16181c]/30">
            <div className="flex items-center gap-2 mb-2">
              {post.author?.avatar ? (
                <img src={post.author.avatar} alt="Author" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                  {(post.author?.fullName?.[0] || post.author?.username?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <span className="text-sm font-bold text-white">{post.author?.fullName || post.author?.username}</span>
            </div>
            <div className="text-sm text-[#e7e9ea] line-clamp-3 post-rich-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </div>

          {shareError && (
            <p className="text-sm text-[#f4212e]">{shareError}</p>
          )}
        </div>
      </Modal>

      {/* Original Post Modal */}
      {sharedPost && (
        <Modal
          isOpen={originalPostModalOpen}
          title="Original Post"
          onClose={() => setOriginalPostModalOpen(false)}
        >
          <div className="-mx-4 -my-3 sm:-mx-6 bg-black">
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
