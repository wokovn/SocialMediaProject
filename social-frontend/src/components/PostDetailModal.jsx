import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from './Modal';
import PostCard from './PostCard';
import postsService from '../services/postsService';
import authService from '../services/authService';

export default function PostDetailModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const postId = searchParams.get('postId');
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { user } = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('Failed to get user', err);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (postId) {
      const fetchPost = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await postsService.getPostById(postId);
          setPost(res.data);
        } catch (err) {
          console.error(err);
          setError('Failed to load post');
        } finally {
          setLoading(false);
        }
      };
      fetchPost();
    } else {
      setPost(null);
    }
  }, [postId]);

  const handleClose = () => {
    searchParams.delete('postId');
    setSearchParams(searchParams, { replace: true });
  };

  if (!postId) return null;

  return (
    <Modal
      isOpen={!!postId}
      title="Post Detail"
      onClose={handleClose}
      panelClassName="max-w-3xl"
    >
      <div className="max-h-[80vh] overflow-y-auto -mx-6 -my-4 p-6 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center p-8">{error}</div>
        ) : post ? (
          <PostCard
            post={post}
            currentUser={currentUser}
            onDeleted={handleClose}
            isModal={true}
          />
        ) : null}
      </div>
    </Modal>
  );
}
