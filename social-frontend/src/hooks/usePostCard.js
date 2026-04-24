import { useState, useEffect } from 'react'
import postsService from '../services/postsService'

export function usePostCard({ post, onDeleted, onBookmarkChange, onPostShared }) {
  const [isLiked, setIsLiked] = useState(post.hasLiked || false)
  const [isBookmarked, setIsBookmarked] = useState(Boolean(post.isBookmarked))
  const [likesCount, setLikesCount] = useState(post.likesCount || 0)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0)
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0)
  const [showComments, setShowComments] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareContent, setShareContent] = useState('')
  const [shareError, setShareError] = useState('')
  const [shareSubmitting, setShareSubmitting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSharedExpanded, setIsSharedExpanded] = useState(false)
  const [originalPostModalOpen, setOriginalPostModalOpen] = useState(false)

  useEffect(() => {
    setIsBookmarked(Boolean(post.isBookmarked))
  }, [post.isBookmarked])

  useEffect(() => {
    setSharesCount(post.sharesCount || 0)
  }, [post.sharesCount])

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await postsService.deletePost(post.id)
    setDeleting(false)
    if (!error) onDeleted?.(post.id)
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

  const handleBookmark = async () => {
    if (bookmarkLoading) {
      return
    }

    const nextBookmarkedState = !isBookmarked
    setIsBookmarked(nextBookmarkedState)
    setBookmarkLoading(true)

    try {
      if (nextBookmarkedState) {
        await postsService.bookmarkPost(post.id)
      } else {
        await postsService.unbookmarkPost(post.id)
      }

      onBookmarkChange?.(post.id, nextBookmarkedState)
    } catch (error) {
      setIsBookmarked(!nextBookmarkedState)
      console.error('Failed to toggle bookmark:', error)
    } finally {
      setBookmarkLoading(false)
    }
  }

  const openShareModal = () => {
    setShareError('')
    setShareModalOpen(true)
  }

  const closeShareModal = () => {
    if (shareSubmitting) {
      return
    }

    setShareModalOpen(false)
    setShareError('')
    setShareContent('')
  }

  const submitShare = async () => {
    if (shareSubmitting) {
      return
    }

    setShareSubmitting(true)
    setShareError('')

    const { data, error } = await postsService.sharePost(post.id, shareContent)
    if (error) {
      setShareError(error)
      console.error('Failed to share post:', error)
    } else if (typeof data?.shareCount === 'number') {
      setSharesCount(data.shareCount)

      if (data?.post) {
        onPostShared?.(data.post)
      }

      setShareModalOpen(false)
      setShareContent('')
    }

    setShareSubmitting(false)
  }

  return {
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
  }
}
