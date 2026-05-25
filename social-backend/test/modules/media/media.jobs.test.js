import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMediaMetadata, processResizeJob } from '../../../modules/media/media.jobs.js';
import db from '../../../modules/db/db.js';
import storageService, { STORAGE_BUCKETS } from '../../../infra/storage/storage.service.js';
import ffmpegService from '../../../infra/media/ffmpeg.service.js';

vi.mock('../../../modules/db/db.js', () => ({
  default: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({}),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('../../../infra/storage/storage.service.js', () => ({
  default: {
    isStorageConfigured: vi.fn().mockReturnValue(true),
    resolveStorageLocation: vi.fn().mockReturnValue({ bucket: 'post-media', path: 'user1/post1/file.jpg' }),
    getPublicUrl: vi.fn().mockReturnValue('https://cdn/post_media/user1/post1/file.jpg'),
    copyObject: vi.fn().mockResolvedValue({}),
    uploadLocalFile: vi.fn().mockResolvedValue({}),
    removeObjects: vi.fn().mockResolvedValue([]),
    listAllObjects: vi.fn().mockResolvedValue([]),
    buildStorageKey: vi.fn().mockReturnValue('key'),
    buildPrefixedPath: vi.fn(({ prefix, path }) => `${prefix}/${path}`),
    normalizeStoragePath: vi.fn().mockReturnValue('some/path'),
    normalizeStoragePrefix: vi.fn().mockReturnValue('post-media/'),
    isPathWithinPrefix: vi.fn().mockReturnValue(false),
  },
  STORAGE_PATH_PREFIXES: {
    TMP: 'tmp',
    POST_MEDIA: 'post_media',
    PROFILE_PICTURE: 'profile_picture',
    POST_MEDIA_VARIANTS: 'post_media_variants',
  },
  STORAGE_BUCKETS: {
    TMP: 'tmp',
    POST_MEDIA: 'post-media',
    PROFILE_PICTURE: 'profile-picture',
    POST_MEDIA_VARIANTS: 'post-media-variants',
  },
}));

vi.mock('../../../infra/media/ffmpeg.service.js', () => ({
  default: {
    isAvailable: vi.fn().mockResolvedValue(true),
    probeMedia: vi.fn().mockResolvedValue({ width: 800, height: 600, duration: null, size: 1024 }),
    createImageVariant: vi.fn().mockResolvedValue({ outputPath: '/tmp/out.jpg', cleanup: vi.fn() }),
    createVideoThumbnail: vi.fn().mockResolvedValue({ outputPath: '/tmp/thumb.jpg', cleanup: vi.fn() }),
  },
}));

describe('Media Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateMediaMetadata', () => {
    it('returns immediately if mediaId is missing', async () => {
      await updateMediaMetadata({ mediaId: null, values: { width: 100 } });
      expect(db.update).not.toHaveBeenCalled();
    });

    it('updates metadata when valid inputs are passed', async () => {
      await updateMediaMetadata({ mediaId: 'media1', values: { width: 120, height: 80 } });
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('processResizeJob', () => {
    it('returns skipped status if storage is not configured', async () => {
      storageService.isStorageConfigured.mockReturnValueOnce(false);
      const res = await processResizeJob({
        mediaId: 'media1',
        mediaType: 'image',
        storageBucket: 'tmp',
        storagePath: 'path.jpg',
      });
      expect(res.skipped).toBe(true);
      expect(res.reason).toBe('Storage not configured');
    });

    it('resizes image using ffmpeg and uploads variants', async () => {
      const res = await processResizeJob({
        mediaId: 'media1',
        mediaType: 'image',
        storageBucket: 'post-media',
        storagePath: 'user1/post1/file.jpg',
        userId: 'user1',
        postId: 'post1',
      });

      expect(res.success).toBe(true);
      expect(res.ffmpeg).toBe(true);
      expect(storageService.uploadLocalFile).toHaveBeenCalled();
    });

    it('falls back to file copy if ffmpeg is unavailable', async () => {
      ffmpegService.isAvailable.mockResolvedValueOnce(false);
      const res = await processResizeJob({
        mediaId: 'media1',
        mediaType: 'image',
        storageBucket: 'post-media',
        storagePath: 'user1/post1/file.jpg',
        userId: 'user1',
        postId: 'post1',
      });

      expect(res.success).toBe(true);
      expect(res.fallback).toBe(true);
      expect(storageService.copyObject).toHaveBeenCalled();
    });
  });
});
