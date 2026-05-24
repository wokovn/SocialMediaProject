import apiClient from './apiClient'
import { uploadMediaFile } from './mediaUploadService'

const profileService = {
  async getMyProfile() {
    return apiClient.get('/api/users/me')
  },

  async getProfileById(userId) {
    return apiClient.get(`/api/users/${userId}`)
  },

  async getProfileByUsername(username) {
    return apiClient.get(`/api/users/by-username/${username}`)
  },

  // Update own profile fields
  async updateProfile({ fullName, username, bio, website, showEmail }) {
    return apiClient.patch('/api/users/me', { fullName, username, bio, website, showEmail })
  },

  // Upload avatar temp file then finalize
  async uploadAvatarFile({ file, userId }) {
    try {
      const data = await uploadMediaFile({ file, userId })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message || 'Failed to upload avatar file' }
    }
  },

  async finalizeAvatar({ storageBucket, storagePath, url }) {
    return apiClient.post('/api/media/profile-picture/finalize', {
      storageBucket,
      storagePath,
      url,
    })
  },

  // Upload banner temp file then finalize
  async uploadBannerFile({ file, userId }) {
    try {
      const data = await uploadMediaFile({ file, userId })
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error.message || 'Failed to upload banner file' }
    }
  },

  async finalizeBanner({ storageBucket, storagePath, url }) {
    return apiClient.post('/api/users/me/banner', { storageBucket, storagePath, url })
  },

  // Follow / Unfollow
  async followUser(userId) {
    return apiClient.post(`/api/users/${userId}/follow`)
  },

  async unfollowUser(userId) {
    return apiClient.delete(`/api/users/${userId}/follow`)
  },

  // Followers / Following lists
  async getFollowers(userId, { limit = 20, cursor = null } = {}) {
    const params = new URLSearchParams({ limit })
    if (cursor) params.set('cursor', cursor)
    return apiClient.get(`/api/users/${userId}/followers?${params}`)
  },

  async getFollowing(userId, { limit = 20, cursor = null } = {}) {
    const params = new URLSearchParams({ limit })
    if (cursor) params.set('cursor', cursor)
    return apiClient.get(`/api/users/${userId}/following?${params}`)
  },

  // Full-text search
  async search({ q, filter = 'all', limit = 20 }) {
    const params = new URLSearchParams({ q, filter, limit })
    return apiClient.get(`/api/users/search?${params}`)
  },
}

export default profileService
