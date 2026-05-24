import React, { useState, useRef, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const { notifications, unreadCount, markGroupAsRead, markAllAsRead, fetchNotifications, markAsRead, fetchMoreNotifications, fetchingMore, hasMore } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (notifGroup) => {
    if (!notifGroup.isRead) {
      if (notifGroup.isGroup) {
        await markGroupAsRead(notifGroup.compositeKey);
      } else {
        await markAsRead(notifGroup.id);
      }
    }
    setIsOpen(false);
    if (notifGroup.targetUrl) {
      if (notifGroup.targetUrl.startsWith('/post/')) {
        const postId = notifGroup.targetUrl.split('/post/')[1];
        navigate(`?postId=${postId}`);
      } else {
        navigate(notifGroup.targetUrl);
      }
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      if (hasMore && !fetchingMore) {
        fetchMoreNotifications();
      }
    }
  };

  const renderNotificationContent = (group) => {
    const count = group.isGroup ? group.items.length : 1;
    const latestNotif = group.isGroup ? group.items[0] : group.data;
    const metadata = latestNotif?.metadata || {};
    const actorName = metadata.actor_name || 'Someone';

    let text = '';
    if (group.type === 'INTERACTION' && group.action === 'LIKE') {
      text = count > 1 ? `${actorName} and ${count - 1} others liked your post` : `${actorName} liked your post`;
    } else if (group.type === 'INTERACTION' && group.action === 'COMMENT') {
      text = count > 1 ? `${actorName} and ${count - 1} others commented on your post` : `${actorName} commented on your post`;
    } else if (group.type === 'SOCIAL' && group.action === 'FOLLOW') {
      text = count > 1 ? `${actorName} and ${count - 1} others followed you` : `${actorName} followed you`;
    } else if (group.type === 'SOCIAL' && group.action === 'SHARE') {
      text = count > 1 ? `${actorName} and ${count - 1} others shared your post` : `${actorName} shared your post`;
    } else {
      text = 'New notification';
    }

    return (
      <div className="flex items-start gap-3">
        {metadata.actor_avatar ? (
          <img src={metadata.actor_avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-[#2f3336]" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#1d9bf0]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[#1d9bf0] font-bold text-lg uppercase">{actorName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#e7e9ea] leading-snug">
            {text}
          </p>
          {metadata.postTitle && (
            <p className="text-xs text-[#71767b] mt-1 truncate italic">"{metadata.postTitle}"</p>
          )}
          <span className="text-xs text-[#71767b] mt-1 block">
            {new Date(group.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-4 py-3 px-4 rounded-full hover:bg-[#16181c] transition w-full text-left font-display group text-[#e7e9ea]"
      >
        <div className="relative flex items-center">
          <BellIcon className="w-7 h-7 transition group-hover:scale-105" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-[#1d9bf0] rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span className="hidden sm:inline text-xl">Notifications</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-black rounded-2xl shadow-2xl overflow-hidden z-50 border border-[#2f3336]">
          <div className="px-4 py-3 border-b border-[#2f3336] flex justify-between items-center bg-[#09090b]">
            <h3 className="text-sm font-bold text-white font-display">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                className="text-xs text-[#1d9bf0] hover:underline font-bold transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-[28rem] overflow-y-auto" onScroll={handleScroll}>
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-[#71767b]">
                <BellIcon className="w-12 h-12 text-[#2f3336] mb-2" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2f3336]">
                {notifications.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleNotificationClick(group)}
                    className={`p-4 cursor-pointer hover:bg-[#16181c] transition-colors relative ${!group.isRead ? 'bg-[#1d9bf0]/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {renderNotificationContent(group)}
                      {!group.isRead && (
                        <span className="w-2 h-2 bg-[#1d9bf0] rounded-full flex-shrink-0 mt-2 shadow-sm"></span>
                      )}
                    </div>
                  </div>
                ))}
                {fetchingMore && (
                  <div className="p-4 text-center text-xs text-[#71767b]">
                    Loading more...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
