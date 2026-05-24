import { describe, it, expect, vi, beforeEach } from 'vitest'
import postsService from './postsService'
import apiClient from './apiClient'

// Mock apiClient convenience methods
vi.mock('./apiClient', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
  }
})

describe('postsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPublicFeed', () => {
    it('calls apiClient.get with correct URL when no cursor is provided', async () => {
      apiClient.get.mockResolvedValue({ data: [{ id: 1 }], error: null })
      const res = await postsService.getPublicFeed(10)
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/feed/public?limit=10')
      expect(res.data).toEqual([{ id: 1 }])
    })

    it('calls apiClient.get with cursor query parameter if cursor is provided', async () => {
      apiClient.get.mockResolvedValue({ data: [{ id: 2 }], error: null })
      const res = await postsService.getPublicFeed(20, '2026-05-24T12:00:00Z')
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/feed/public?limit=20&cursor=2026-05-24T12:00:00Z')
      expect(res.data).toEqual([{ id: 2 }])
    })
  })

  describe('getHybridFeed', () => {
    it('calls apiClient.get with hybrid endpoint and limit', async () => {
      apiClient.get.mockResolvedValue({ data: [], error: null })
      await postsService.getHybridFeed(15)
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/posts/feed/hybrid?limit=15')
    })
  })

  describe('createPost', () => {
    it('calls apiClient.post with parsed parameters', async () => {
      apiClient.post.mockResolvedValue({ data: { id: 123, content: 'Test post' }, error: null })
      const payload = { content: 'Test post', visibility: 'public', files: [], userId: 'user-id-123' }
      const res = await postsService.createPost(payload)

      expect(apiClient.post).toHaveBeenCalledWith('/api/posts', {
        content: 'Test post',
        visibility: 'public',
        mediaAttachments: [],
      })
      expect(res.data).toEqual({ id: 123, content: 'Test post' })
    })
  })

  describe('like and unlike', () => {
    it('calls apiClient.post for liking a post', async () => {
      apiClient.post.mockResolvedValue({ data: { success: true }, error: null })
      await postsService.likePost('post-id-1')
      expect(apiClient.post).toHaveBeenCalledWith('/api/posts/post-id-1/like')
    })

    it('calls apiClient.post for unliking a post', async () => {
      apiClient.post.mockResolvedValue({ data: { success: true }, error: null })
      await postsService.unlikePost('post-id-1')
      expect(apiClient.post).toHaveBeenCalledWith('/api/posts/post-id-1/unlike')
    })
  })

  describe('bookmark and unbookmark', () => {
    it('calls apiClient.post to bookmark a post', async () => {
      apiClient.post.mockResolvedValue({ data: { success: true }, error: null })
      await postsService.bookmarkPost('post-id-2')
      expect(apiClient.post).toHaveBeenCalledWith('/api/posts/post-id-2/bookmark')
    })

    it('calls apiClient.delete to unbookmark a post', async () => {
      apiClient.delete.mockResolvedValue({ data: { success: true }, error: null })
      await postsService.unbookmarkPost('post-id-2')
      expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/post-id-2/bookmark')
    })
  })
})
