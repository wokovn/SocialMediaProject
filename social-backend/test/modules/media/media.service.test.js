import { describe, it, expect, vi, beforeEach } from 'vitest';
import MediaService from '../../../modules/media/media.service.js';
import storageService from '../../../infra/storage/storage.service.js';

vi.mock('../../../infra/storage/storage.service.js', () => ({
    default: {
        isStorageConfigured: vi.fn().mockReturnValue(true),
        uploadBuffer: vi.fn().mockResolvedValue(),
        getPublicUrl: vi.fn().mockReturnValue('https://cdn/tmp/file.jpg'),
        resolveStorageLocation: vi.fn(),
        normalizeStoragePath: vi.fn().mockReturnValue('some/path'),
        normalizeStoragePrefix: vi.fn().mockReturnValue('post-media/'),
        buildPrefixedPath: vi.fn(({ prefix, path }) => `${prefix}/${path}`),
        isPathWithinPrefix: vi.fn().mockReturnValue(false),
        moveObject: vi.fn().mockResolvedValue(),
        removeObjects: vi.fn().mockResolvedValue([]),
        listAllObjects: vi.fn().mockResolvedValue([]),
        buildStorageKey: vi.fn().mockReturnValue('key'),
        uploadLocalFile: vi.fn().mockResolvedValue(),
        copyObject: vi.fn().mockResolvedValue(),
    },
    STORAGE_PATH_PREFIXES: {
        TMP: 'tmp',
        POST_MEDIA: 'post-media',
        PROFILE_PICTURE: 'profile-picture',
        POST_MEDIA_VARIANTS: 'post-media-variants',
    },
    STORAGE_BUCKETS: {
        TMP: 'tmp',
        POST_MEDIA: 'post-media',
        PROFILE_PICTURE: 'profile-picture',
        POST_MEDIA_VARIANTS: 'post-media-variants',
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

    describe('uploadTempMedia', () => {
        it('throws when storage is not configured', async () => {
            storageService.isStorageConfigured.mockReturnValueOnce(false);

            await expect(
                MediaService.uploadTempMedia({
                    userId: 'user1',
                    fileBuffer: Buffer.from('data'),
                    originalName: 'photo.jpg',
                    mimeType: 'image/jpeg',
                    fileSize: 4,
                })
            ).rejects.toThrow('Storage is not configured for media uploads.');
        });

        it('throws when userId is missing', async () => {
            await expect(
                MediaService.uploadTempMedia({
                    userId: null,
                    fileBuffer: Buffer.from('data'),
                    originalName: 'photo.jpg',
                    mimeType: 'image/jpeg',
                    fileSize: 4,
                })
            ).rejects.toThrow('User ID is required for media upload.');
        });

        it('throws when buffer is empty', async () => {
            await expect(
                MediaService.uploadTempMedia({
                    userId: 'user1',
                    fileBuffer: Buffer.from(''),
                    originalName: 'photo.jpg',
                    mimeType: 'image/jpeg',
                    fileSize: 0,
                })
            ).rejects.toThrow('Uploaded file payload is empty.');
        });

        it('throws when media type is unsupported', async () => {
            await expect(
                MediaService.uploadTempMedia({
                    userId: 'user1',
                    fileBuffer: Buffer.from('data'),
                    originalName: 'doc.txt',
                    mimeType: 'text/plain',
                    fileSize: 4,
                })
            ).rejects.toThrow('Only image and video uploads are supported.');
        });
    });

    describe('finalizeProfilePicture', () => {
        it('throws when storage location is missing', async () => {
            storageService.resolveStorageLocation.mockReturnValueOnce(null);

            await expect(
                MediaService.finalizeProfilePicture({
                    userId: 'user1',
                    storageBucket: null,
                    storagePath: null,
                    url: null,
                })
            ).rejects.toThrow('storageBucket + storagePath (or url) are required');
        });
    });
});
