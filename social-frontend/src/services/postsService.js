import apiClient from './apiClient'

const postsService = {
  // Get public feed
  async getPublicFeed(limit = 20, offset = 0) {
    return await apiClient.get(`/api/posts/feed/public?limit=${limit}&offset=${offset}`)
  },

  // Create a new post
  async createPost({ content, visibility = 'public' }) {
    return await apiClient.post('/api/posts', { content, visibility })
  },

  // Get post by ID
  async getPostById(postId) {
    return await apiClient.get(`/api/posts/${postId}`)
  },

  // Get user posts
  async getUserPosts(userId) {
    return await apiClient.get(`/api/posts/user/${userId}`)
  },

  // Delete post
  async deletePost(postId) {
    return await apiClient.delete(`/api/posts/${postId}`)
  },
}

export default postsService
