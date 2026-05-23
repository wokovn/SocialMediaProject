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
          <img src={metadata.actor_avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 font-medium text-lg uppercase">{actorName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">
            {text}
          </p>
          {metadata.postTitle && (
            <p className="text-xs text-gray-500 mt-1 truncate italic">"{metadata.postTitle}"</p>
          )}
          <span className="text-xs text-gray-400 mt-1 block">
            {new Date(group.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none transition-colors rounded-full hover:bg-gray-100"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl overflow-hidden z-50 border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-[28rem] overflow-y-auto" onScroll={handleScroll}>
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-gray-500">
                <BellIcon className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleNotificationClick(group)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors relative ${!group.isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {renderNotificationContent(group)}
                      {!group.isRead && (
                        <span className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0 mt-1.5 shadow-sm"></span>
                      )}
                    </div>
                  </div>
                ))}
                {fetchingMore && (
                  <div className="p-4 text-center text-sm text-gray-500">
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
