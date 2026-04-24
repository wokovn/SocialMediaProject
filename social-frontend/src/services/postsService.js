import apiClient from './apiClient'
import { uploadPostMediaFiles } from './mediaUploadService'

const postsService = {
  // Get public feed
  async getPublicFeed(limit = 20, cursor = null) {
    const url = `/api/posts/feed/public?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`
    return await apiClient.get(url)
  },

  // Get saved/bookmarked posts
  async getSavedPosts(limit = 20, cursor = null) {
    const url = `/api/posts/saved?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`
    return await apiClient.get(url)
  },

  // Create a new post
  async createPost({ content, visibility = 'public', files = [], userId }) {
    let mediaAttachments = []

    if (files.length > 0) {
      const { data, error } = await uploadPostMediaFiles({ files, userId })
      if (error) {
        return { data: null, error }
      }

      mediaAttachments = data
    }

    return await apiClient.post('/api/posts', {
      content,
      visibility,
      mediaAttachments,
    })
  },

  // Get post by ID
  async getPostById(postId) {
    return await apiClient.get(`/api/posts/${postId}`)
  },

  // Get user posts
  async getUserPosts(userId, limit = 20, cursor = null) {
    const url = `/api/posts/user/${userId}?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`
    return await apiClient.get(url)
  },

  // Delete post
  async deletePost(postId) {
    return await apiClient.delete(`/api/posts/${postId}`)
  },

  // Like post
  async likePost(postId) {
    return await apiClient.post(`/api/posts/${postId}/like`)
  },

  // Unlike post
  async unlikePost(postId) {
    return await apiClient.post(`/api/posts/${postId}/unlike`)
  },

  // Share post
  async sharePost(postId, content = '') {
    return await apiClient.post(`/api/posts/${postId}/share`, { content })
  },

  // Save post
  async bookmarkPost(postId) {
    return await apiClient.post(`/api/posts/${postId}/bookmark`)
  },

  // Remove saved post
  async unbookmarkPost(postId) {
    return await apiClient.delete(`/api/posts/${postId}/bookmark`)
  },
}

export default postsService
