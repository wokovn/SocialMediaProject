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

  async followUser(userId) {
    return apiClient.post(`/api/users/${userId}/follow`)
  },

  async unfollowUser(userId) {
    return apiClient.delete(`/api/users/${userId}/follow`)
  },

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
}

export default profileService
