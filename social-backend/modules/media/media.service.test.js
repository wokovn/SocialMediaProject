import { describe, it, expect, vi, beforeEach } from 'vitest';
import MediaService from './media.service.js';

vi.mock('../../infra/storage/storage.service.js', () => ({
    default: {
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
        getPublicUrl: vi.fn(),
        resolveStorageLocation: vi.fn().mockReturnValue({ bucketName: 'post-media', storagePath: 'some/path.jpg' }),
        normalizeStoragePath: vi.fn().mockReturnValue('some/path'),
        normalizeStoragePrefix: vi.fn().mockReturnValue('post-media/')
    },
    STORAGE_PATH_PREFIXES: {
        TMP: 'tmp',
        POST_MEDIA: 'post-media',
        PROFILE_PICTURE: 'profile-picture'
    },
    STORAGE_BUCKETS: {
        POST_MEDIA: 'post-media',
        PROFILE_PICTURE: 'profile-picture'
    }
}));

describe('MediaService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Service Check', () => {
        it('should be defined', () => {
            expect(MediaService).toBeDefined();
            expect(typeof MediaService.getImageVariantUrls).toBe('function');
        });
    });
});
