import apiClient from './apiClient'

const commentsService = {
  async getComments(postId, { limit = 20, cursor = null } = {}) {
    const params = new URLSearchParams({ limit })
    if (cursor) params.set('cursor', cursor)
    return await apiClient.get(`/api/posts/${postId}/comments?${params}`)
  },

  async postComment(postId, content) {
    return await apiClient.post(`/api/posts/${postId}/comments`, { content })
  },

  async replyToComment(postId, parentId, content) {
    return await apiClient.post(`/api/posts/${postId}/comments/${parentId}/reply`, { content })
  },

  async getReplies(postId, commentId) {
    return await apiClient.get(`/api/posts/${postId}/comments/${commentId}/replies`)
  },

  async likeComment(postId, commentId) {
    return await apiClient.post(`/api/posts/${postId}/comments/${commentId}/like`)
  },

  async unlikeComment(postId, commentId) {
    return await apiClient.post(`/api/posts/${postId}/comments/${commentId}/unlike`)
  },

  async deleteComment(postId, commentId) {
    return await apiClient.delete(`/api/posts/${postId}/comments/${commentId}`)
  },
}

export default commentsService
