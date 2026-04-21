import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import commentsService from '../services/commentsService'

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
          className="text-blue-600 font-semibold cursor-pointer hover:underline"
        >
          {part}
        </Link>
      )
    }
    return part
  })
}

function CommentItem({ comment, postId, currentUserId, currentUser, onDeleted, onReply, depth = 0 }) {
  const [isLiked, setIsLiked] = useState(comment.hasLiked || false)
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0)
  const [repliesCount, setRepliesCount] = useState(comment.repliesCount || 0)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [replies, setReplies] = useState([])
  const [repliesVisible, setRepliesVisible] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const replyInputRef = useRef(null)

  const formatDate = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  const handleLike = async () => {
    if (isLiked) {
      setIsLiked(false)
      setLikesCount((prev) => Math.max(0, prev - 1))
      await commentsService.unlikeComment(postId, comment.id)
    } else {
      setIsLiked(true)
      setLikesCount((prev) => prev + 1)
      await commentsService.likeComment(postId, comment.id)
    }
  }

  const handleDelete = async () => {
    const { error } = await commentsService.deleteComment(postId, comment.id)
    if (!error) onDeleted(comment.id)
  }

  const toggleReplyInput = () => {
    setShowReplyInput((v) => {
      if (!v) {
        // Focus after the input renders
        setTimeout(() => replyInputRef.current?.focus(), 0)
      }
      return !v
    })
  }

  const loadReplies = async () => {
    if (loadingReplies) return
    setLoadingReplies(true)
    const { data, error } = await commentsService.getReplies(postId, comment.id)
    setLoadingReplies(false)
    if (!error && data) setReplies(data.replies || [])
  }

  const toggleReplies = async () => {
    if (!repliesVisible && replies.length === 0) {
      await loadReplies()
    }
    setRepliesVisible((v) => !v)
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyContent.trim()) return
    setSubmittingReply(true)

    const optimistic = {
      id: '__reply_temp__' + Date.now(),
      content: replyContent.trim(),
      parentId: comment.id,
      likesCount: 0,
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      hasLiked: false,
      author: {
        id: currentUser?.id,
        fullName: currentUser?.user_metadata?.full_name || null,
        username: currentUser?.user_metadata?.username || null,
        avatar: null,
      },
    }

    setReplies((prev) => [...prev, optimistic])
    setRepliesVisible(true)
    setRepliesCount((prev) => prev + 1)
    setReplyContent('')
    setShowReplyInput(false)

    const { data, error } = await commentsService.replyToComment(postId, comment.id, optimistic.content)
    setSubmittingReply(false)

    if (!error && data) {
      setReplies((prev) => prev.map((r) => r.id === optimistic.id ? data : r))
    } else {
      // Roll back
      setReplies((prev) => prev.filter((r) => r.id !== optimistic.id))
      setRepliesCount((prev) => Math.max(0, prev - 1))
      setReplyContent(optimistic.content)
      setShowReplyInput(true)
      setTimeout(() => replyInputRef.current?.focus(), 0)
    }
  }

  const handleReplyDeleted = (replyId) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId))
    setRepliesCount((prev) => Math.max(0, prev - 1))
  }

  const handleChildReply = (username) => {
    setReplyContent(`@${username} `)
    setShowReplyInput(true)
    setTimeout(() => replyInputRef.current?.focus(), 0)
  }

  return (
    <div className={`flex gap-3 ${depth > 0 ? 'mt-2' : ''}`}>
      {comment.author?.avatar ? (
        <img
          src={comment.author.avatar}
          alt={`${comment.author?.fullName || comment.author?.username || 'User'} avatar`}
          className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {comment.author?.fullName?.[0]?.toUpperCase() || comment.author?.username?.[0]?.toUpperCase() || 'U'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <Link to={comment.author?.username ? `/profile/u/${comment.author.username}` : '#'} className="text-sm font-semibold text-gray-900 hover:underline">
            {comment.author?.fullName || comment.author?.username || 'Unknown'}
          </Link>
          <div className="text-sm text-gray-800 break-words">{renderCommentContent(comment.content)}</div>
        </div>

        <div className="flex items-center gap-4 mt-1 px-1">
          <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
          <button
            onClick={handleLike}
            className={`text-xs font-semibold transition ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
          >
            {isLiked ? 'Liked' : 'Like'}{likesCount > 0 ? ` · ${likesCount}` : ''}
          </button>
          {depth === 0 ? (
            <button
              onClick={toggleReplyInput}
              className={`text-xs font-semibold transition ${showReplyInput ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
            >
              Reply
            </button>
          ) : (
            <button
              onClick={() => onReply?.(comment.author?.username)}
              className="text-xs font-semibold text-gray-400 hover:text-blue-500 transition"
            >
              Reply
            </button>
          )}
          {currentUserId === comment.author?.id && (
            <button
              onClick={handleDelete}
              className="text-xs font-semibold text-gray-400 hover:text-red-500 transition"
            >
              Delete
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyInput && (
          <form onSubmit={handleReply} className="flex gap-2 mt-2">
            <input
              ref={replyInputRef}
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply…"
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={submittingReply || !replyContent.trim()}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40 transition"
            >
              {submittingReply ? '…' : 'Send'}
            </button>
          </form>
        )}

        {/* Replies toggle */}
        {depth === 0 && repliesCount > 0 && (
          <button
            onClick={toggleReplies}
            className="text-xs text-blue-500 hover:text-blue-600 font-semibold mt-1 px-1 transition"
          >
            {loadingReplies
              ? 'Loading…'
              : repliesVisible
              ? `Hide replies`
              : `View ${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`}
          </button>
        )}

        {/* Replies list */}
        {repliesVisible && replies.length > 0 && (
          <div className="mt-2 pl-2 border-l-2 border-gray-100 space-y-2">
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

function CommentSection({ postId, onCommentCountChange, currentUser }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const currentUserId = currentUser?.id || null

  useEffect(() => {
    loadComments()
  }, [postId])

  const loadComments = async (cursor = null) => {
    setLoading(true)
    const { data, error } = await commentsService.getComments(postId, { limit: 20, cursor })
    setLoading(false)
    if (error || !data) return
    setComments((prev) => cursor ? [...prev, ...data.comments] : data.comments)
    setHasMore(data.hasMore)
    setNextCursor(data.nextCursor)
  }

  const TEMP_ID = '__temp__'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)

    // Optimistic insert with current user info so name shows immediately
    const optimistic = {
      id: TEMP_ID,
      content: newComment.trim(),
      parentId: null,
      likesCount: 0,
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      hasLiked: false,
      author: {
        id: currentUser?.id,
        fullName: currentUser?.user_metadata?.full_name || null,
        username: currentUser?.user_metadata?.username || null,
        avatar: null,
      },
    }
    setComments((prev) => [optimistic, ...prev])
    setNewComment('')

    const { data, error } = await commentsService.postComment(postId, optimistic.content)
    setSubmitting(false)

    if (!error && data) {
      // Replace temp entry with real server data (includes correct id + author)
      setComments((prev) => prev.map((c) => (c.id === TEMP_ID ? data : c)))
      onCommentCountChange?.(1)
    } else {
      // Roll back on failure
      setComments((prev) => prev.filter((c) => c.id !== TEMP_ID))
      setNewComment(optimistic.content)
    }
  }

  const handleDeleted = (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    onCommentCountChange?.(-1)
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      {/* New comment input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting ? '…' : 'Post'}
        </button>
      </form>

      {/* Comment list */}
      {loading && comments.length === 0 ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              currentUserId={currentUserId}
              currentUser={currentUser}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => loadComments(nextCursor)}
          disabled={loading}
          className="text-sm text-blue-600 hover:underline disabled:opacity-40 transition"
        >
          {loading ? 'Loading…' : 'Load more comments'}
        </button>
      )}
    </div>
  )
}

export default CommentSection
