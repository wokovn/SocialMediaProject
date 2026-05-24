import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon } from '@heroicons/react/24/outline'
import { useNotifications } from '../hooks/useNotifications'
import authService from '../services/authService'
import TwitterLayout from '../components/TwitterLayout'

function Notifications() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  
  const {
    notifications,
    unreadCount,
    markGroupAsRead,
    markAllAsRead,
    fetchNotifications,
    markAsRead,
    fetchMoreNotifications,
    fetchingMore,
    hasMore
  } = useNotifications()

  const sentinelRef = useRef(null)
  const fetchingMoreRef = useRef(fetchingMore)
  const hasMoreRef = useRef(hasMore)

  useEffect(() => { fetchingMoreRef.current = fetchingMore }, [fetchingMore])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { user, error } = await authService.getCurrentUser()

    if (error || !user) {
      navigate('/login')
      return
    }

    setLoading(false)
    fetchNotifications()
  }

  const handleNotificationClick = async (notifGroup) => {
    if (!notifGroup.isRead) {
      if (notifGroup.isGroup) {
        await markGroupAsRead(notifGroup.compositeKey)
      } else {
        await markAsRead(notifGroup.id)
      }
    }
    if (notifGroup.targetUrl) {
      if (notifGroup.targetUrl.startsWith('/post/')) {
        const postId = notifGroup.targetUrl.split('/post/')[1]
        navigate(`?postId=${postId}`)
      } else {
        navigate(notifGroup.targetUrl)
      }
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchingMoreRef.current && hasMoreRef.current) {
          fetchMoreNotifications()
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, fetchMoreNotifications])

  const renderNotificationContent = (group) => {
    const count = group.isGroup ? group.items.length : 1
    const latestNotif = group.isGroup ? group.items[0] : group.data
    const metadata = latestNotif?.metadata || {}
    const actorName = metadata.actor_name || 'Someone'

    let text = ''
    if (group.type === 'INTERACTION' && group.action === 'LIKE') {
      text = count > 1 ? `${actorName} and ${count - 1} others liked your post` : `${actorName} liked your post`
    } else if (group.type === 'INTERACTION' && group.action === 'COMMENT') {
      text = count > 1 ? `${actorName} and ${count - 1} others commented on your post` : `${actorName} commented on your post`
    } else if (group.type === 'SOCIAL' && group.action === 'FOLLOW') {
      text = count > 1 ? `${actorName} and ${count - 1} others followed you` : `${actorName} followed you`
    } else if (group.type === 'SOCIAL' && group.action === 'SHARE') {
      text = count > 1 ? `${actorName} and ${count - 1} others shared your post` : `${actorName} shared your post`
    } else {
      text = 'New notification'
    }

    return (
      <div className="flex items-start gap-4">
        {metadata.actor_avatar ? (
          <img src={metadata.actor_avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-[#2f3336] flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#1d9bf0]/10 flex items-center justify-center flex-shrink-0 border border-[#2f3336]">
            <span className="text-[#1d9bf0] font-bold text-lg uppercase">{actorName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base text-[#e7e9ea] leading-snug">
            {text}
          </p>
          {metadata.postTitle && (
            <p className="text-sm text-[#71767b] mt-1 truncate italic bg-[#16181c] p-2 rounded-lg border border-[#2f3336]">
              "{metadata.postTitle}"
            </p>
          )}
          <span className="text-xs text-[#71767b] mt-1.5 block">
            {new Date(group.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2f3336] px-4 py-3 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-white">Notifications</h2>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-sm text-[#1d9bf0] hover:underline font-bold transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="pb-24">
        {notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-[#71767b]">
            <BellIcon className="w-16 h-16 text-[#2f3336] mb-3 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-1">Nothing to see here — yet</h3>
            <p className="text-sm max-w-sm">When other users like, comment, or share your posts, you will see it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2f3336]">
            {notifications.map((group) => (
              <div
                key={group.id}
                onClick={() => handleNotificationClick(group)}
                className={`p-4 cursor-pointer hover:bg-[#16181c] transition-colors relative flex items-start justify-between gap-4 ${
                  !group.isRead ? 'bg-[#1d9bf0]/5 border-l-2 border-[#1d9bf0]' : ''
                }`}
              >
                <div className="flex-1">
                  {renderNotificationContent(group)}
                </div>
                {!group.isRead && (
                  <span className="w-2.5 h-2.5 bg-[#1d9bf0] rounded-full flex-shrink-0 mt-2.5 shadow-sm"></span>
                )}
              </div>
            ))}
            {fetchingMore && (
              <div className="p-4 text-center text-sm text-[#71767b] flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1d9bf0]"></div>
                Loading more...
              </div>
            )}
            {/* Sentinel for Infinite Scroll */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                {!fetchingMore && (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1d9bf0]"></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default Notifications
