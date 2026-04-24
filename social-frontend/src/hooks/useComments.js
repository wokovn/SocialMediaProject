import { useState, useRef, useEffect } from 'react'
import commentsService from '../services/commentsService'

export function useCommentItem({ comment, postId, currentUserId, currentUser, onDeleted }) {
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

  return {
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
  }
}

export function useCommentSection({ postId, currentUser, onCommentCountChange }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadComments = async (cursor = null) => {
    setLoading(true)
    const { data, error } = await commentsService.getComments(postId, { limit: 20, cursor })
    setLoading(false)
    if (error || !data) return
    setComments((prev) => cursor ? [...prev, ...data.comments] : data.comments)
    setHasMore(data.hasMore)
    setNextCursor(data.nextCursor)
  }

  useEffect(() => {
    loadComments()
  }, [postId])

  const TEMP_ID = '__temp__'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)

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
      setComments((prev) => prev.map((c) => (c.id === TEMP_ID ? data : c)))
      onCommentCountChange?.(1)
    } else {
      setComments((prev) => prev.filter((c) => c.id !== TEMP_ID))
      setNewComment(optimistic.content)
    }
  }

  const handleDeleted = (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    onCommentCountChange?.(-1)
  }

  return {
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
  }
}
