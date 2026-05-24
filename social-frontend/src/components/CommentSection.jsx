import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useCommentItem, useCommentSection } from '../hooks/useComments'

const renderCommentContent = (content) => {
  if (!content) return null
  const parts = content.split(/(@\w+)/g)
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Link
          key={index}
          to={`/profile/u/${username}`}
          className="text-[#1d9bf0] font-semibold cursor-pointer hover:underline"
        >
          {part}
        </Link>
      )
    }
    return part
  })
}

function CommentItem({ comment, postId, currentUserId, currentUser, onDeleted, onReply, depth = 0 }) {
  const {
    isLiked,
    likesCount,
    repliesCount,
    showReplyInput,
    replyContent,
    setReplyContent,
    submittingReply,
    replies,
    repliesVisible,
    loadingReplies,
    replyInputRef,
    handleLike,
    handleDelete,
    toggleReplyInput,
    loadReplies,
    toggleReplies,
    handleReply,
    handleReplyDeleted,
    handleChildReply
  } = useCommentItem({ comment, postId, currentUserId, currentUser, onDeleted })

  const formatDate = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className={`flex gap-3 ${depth > 0 ? 'mt-3 pl-3 border-l border-[#2f3336]' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.author?.avatar ? (
          <img
            src={comment.author.avatar}
            alt={`${comment.author?.fullName || comment.author?.username || 'User'} avatar`}
            className="w-8 h-8 rounded-full object-cover border border-[#2f3336]"
          />
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] rounded-full flex items-center justify-center text-white text-xs font-bold">
            {(comment.author?.fullName?.[0] || comment.author?.username?.[0] || 'U').toUpperCase()}
          </div>
        )}
      </div>

      {/* Main Comment Area */}
      <div className="flex-1 min-w-0">
        {/* Commenter Name and Meta */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link 
            to={comment.author?.username ? `/profile/u/${comment.author.username}` : '#'} 
            className="text-sm font-bold text-white hover:underline"
          >
            {comment.author?.fullName || comment.author?.username || 'Unknown'}
          </Link>
          {comment.author?.username && (
            <span className="text-xs text-[#71767b]">@{comment.author.username}</span>
          )}
          <span className="text-xs text-[#71767b]">•</span>
          <span className="text-xs text-[#71767b]">{formatDate(comment.createdAt)}</span>
        </div>

        {/* Comment Text */}
        <div className="text-[14px] leading-relaxed text-[#e7e9ea] mt-1 break-words">
          {renderCommentContent(comment.content)}
        </div>

        {/* Comment Actions */}
        <div className="flex items-center gap-4 mt-2 text-xs text-[#71767b]">
          <button
            onClick={handleLike}
            className={`font-semibold hover:text-[#f4212e] transition ${isLiked ? 'text-[#f4212e]' : ''}`}
          >
            {isLiked ? 'Liked' : 'Like'}{likesCount > 0 ? ` (${likesCount})` : ''}
          </button>
          
          {depth === 0 ? (
            <button
              onClick={toggleReplyInput}
              className={`font-semibold hover:text-[#1d9bf0] transition ${showReplyInput ? 'text-[#1d9bf0]' : ''}`}
            >
              Reply
            </button>
          ) : (
            <button
              onClick={() => onReply?.(comment.author?.username)}
              className="font-semibold hover:text-[#1d9bf0] transition"
            >
              Reply
            </button>
          )}

          {currentUserId === comment.author?.id && (
            <button
              onClick={handleDelete}
              className="font-semibold hover:text-[#f4212e] transition"
            >
              Delete
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyInput && (
          <form onSubmit={handleReply} className="flex gap-2 mt-3">
            <input
              ref={replyInputRef}
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Post your reply…"
              className="flex-1 text-sm bg-black border border-[#2f3336] rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0]"
            />
            <button
              type="submit"
              disabled={submittingReply || !replyContent.trim()}
              className="px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-xs font-bold rounded-full disabled:opacity-50 transition"
            >
              {submittingReply ? 'Sending' : 'Reply'}
            </button>
          </form>
        )}

        {/* Replies toggle button */}
        {depth === 0 && repliesCount > 0 && (
          <div className="mt-2">
            <button
              onClick={toggleReplies}
              className="text-xs text-[#1d9bf0] hover:underline font-bold transition"
            >
              {loadingReplies
                ? 'Loading replies…'
                : repliesVisible
                ? `Hide replies`
                : `Show replies (${repliesCount})`}
            </button>
          </div>
        )}

        {/* Replies List */}
        {repliesVisible && replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                currentUserId={currentUserId}
                currentUser={currentUser}
                onDeleted={handleReplyDeleted}
                onReply={handleChildReply}
                depth={1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentSection({ postId, onCommentCountChange, currentUser, onClose }) {
  const {
    comments,
    loading,
    hasMore,
    nextCursor,
    newComment,
    setNewComment,
    submitting,
    loadComments,
    handleSubmit,
    handleDeleted
  } = useCommentSection({ postId, currentUser, onCommentCountChange })

  const currentUserId = currentUser?.id || null

  return (
    <div className="space-y-4 pt-1">
      {/* New comment input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Post your reply…"
          className="flex-1 text-sm bg-black border border-[#2f3336] rounded-full px-4 py-2 text-white placeholder-[#71767b] focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0]"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-sm font-bold rounded-full disabled:opacity-50 transition"
        >
          {submitting ? 'Posting' : 'Reply'}
        </button>
      </form>

      {/* Comment list */}
      {loading && comments.length === 0 ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1d9bf0]" />
        </div>
      ) : (
        <div className="space-y-4 divide-y divide-[#2f3336]/40">
          {comments.map((comment, index) => (
            <div key={comment.id} className={index > 0 ? 'pt-3' : ''}>
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                currentUserId={currentUserId}
                currentUser={currentUser}
                onDeleted={handleDeleted}
              />
            </div>
          ))}
        </div>
      )}

      {/* Load More and Close Footer */}
      <div className="flex justify-between items-center pt-2 text-xs">
        {hasMore ? (
          <button
            onClick={() => loadComments(nextCursor)}
            disabled={loading}
            className="text-sm text-[#1d9bf0] font-bold hover:underline disabled:opacity-40 transition"
          >
            {loading ? 'Loading…' : 'Show more comments'}
          </button>
        ) : <div />}
        
        {onClose && (
          <button
            onClick={onClose}
            className="font-bold text-[#71767b] hover:text-white px-3 py-1.5 rounded-full hover:bg-[#16181c] transition"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}

export default CommentSection
