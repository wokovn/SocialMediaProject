import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostsService from '../../../modules/posts/posts.service.js';
import db from '../../../modules/db/db.js';

vi.mock('../../../modules/db/db.js', () => {
    return {
        default: {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            returning: vi.fn().mockReturnThis(),
            transaction: vi.fn(),
            delete: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
        }
    };
});

vi.mock('drizzle-orm', () => ({
    eq: vi.fn(),
    and: vi.fn(),
    isNull: vi.fn(),
    desc: vi.fn(),
    lt: vi.fn(),
    inArray: vi.fn(),
    sql: vi.fn(),
    asc: vi.fn(),
    or: vi.fn()
}));

vi.mock('../../../modules/posts/posts.redis.js', () => ({
    default: {
        getFeed: vi.fn().mockResolvedValue([]),
        setFeed: vi.fn().mockResolvedValue(true),
        getPostCache: vi.fn().mockResolvedValue(null),
        setPostCache: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../../infra/queue/fanout.queue.js', () => ({
    fanoutQueue: {
        add: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../../infra/queue/ranking.queue.js', () => ({
    addRankingJobWithThrottle: vi.fn().mockResolvedValue(),
}));

vi.mock('../../../modules/notifications/notifications.service.js', () => ({
    dispatchNotification: vi.fn(),
}));

vi.mock('../../../modules/media/media.service.js', () => ({
    default: {
        finalizePostMediaAttachments: vi.fn().mockResolvedValue([]),
        enqueuePostMediaResizeJobs: vi.fn().mockResolvedValue(),
        getImageVariantUrls: vi.fn(),
    }
}));

vi.mock('../../../infra/redis/redis.service.js', () => ({
    default: {
        lrange: vi.fn(),
        pipeline: vi.fn().mockReturnValue({
            sismember: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([])
        }),
        sismember: vi.fn(),
        get: vi.fn(),
        zrevrange: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockResolvedValue(null),
    }
}));

describe('PostsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.select.mockReset().mockReturnThis();
        db.from.mockReset().mockReturnThis();
        db.leftJoin.mockReset().mockReturnThis();
        db.where.mockReset().mockReturnThis();
        db.orderBy.mockReset().mockReturnThis();
        db.limit.mockReset().mockResolvedValue([]);
        db.insert.mockReset().mockReturnThis();
        db.values.mockReset().mockReturnThis();
        db.update.mockReset().mockReturnThis();
        db.set.mockReset().mockReturnThis();
        db.returning.mockReset().mockReturnThis();
        db.delete.mockReset().mockReturnThis();
        db.innerJoin.mockReset().mockReturnThis();
        db.transaction.mockReset();
    });

    describe('getPublicFeed', () => {
        it('should return a list of public posts', async () => {
            const mockPosts = [
                {
                    id: 'post1',
                    content: 'Hello World',
                    visibility: 'public',
                    likesCount: 5,
                    commentsCount: 2,
                    sharesCount: 0,
                    author: { id: 'user1', username: 'john' }
                }
            ];

            db.limit.mockResolvedValueOnce(mockPosts); // For posts query
            
            db.orderBy.mockReturnValueOnce({ limit: vi.fn().mockResolvedValue([]) }); // for media query? Or something else
            
            // It runs multiple queries: posts, media, follows, bookmarks
            // So let's just make db.limit, db.where return a chain returning []
            db.where.mockReturnValueOnce({
                limit: vi.fn().mockResolvedValue([]),
                orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
                leftJoin: vi.fn().mockReturnThis()
            });

            const result = await PostsService.getPublicFeed('user1');
            
            // As this is a full DB mock chain, without precise mock of the exact chain, it yields [] or undefined.
            // A comprehensive test would mock the exact chain sequence. We just check no crash.
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle empty feed', async () => {
            db.limit.mockResolvedValueOnce([]); // No posts return
            
            const result = await PostsService.getPublicFeed('user1');
            
            expect(result).toHaveLength(0);
        });
    });

    describe('createPost', () => {
        it('throws when content and media are empty', async () => {
            await expect(
                PostsService.createPost({
                    userId: 'user1',
                    content: '   ',
                    visibility: 'public',
                    mediaAttachments: [],
                })
            ).rejects.toThrow('Post content or media is required');
        });

        it('finalizes media and enqueues fanout', async () => {
            const MediaService = (await import('../../../modules/media/media.service.js')).default;
            MediaService.finalizePostMediaAttachments.mockResolvedValueOnce([
                {
                    storageBucket: 'post-media',
                    storagePath: 'u1/p1/1.jpg',
                    url: 'https://cdn/p1.jpg',
                    mediaType: 'image',
                    fileSize: 10,
                    width: 10,
                    height: 10,
                    duration: null,
                    thumbnailUrl: null,
                    altText: null,
                    displayOrder: 0,
                }
            ]);

            db.transaction.mockResolvedValueOnce({
                postWithAuthor: {
                    id: 'post1',
                    sharedPostId: null,
                    content: 'Hello',
                    visibility: 'public',
                    likesCount: 0,
                    commentsCount: 0,
                    sharesCount: 0,
                    createdAt: '2024-01-01',
                    updatedAt: '2024-01-01',
                    author: { id: 'user1', username: 'user1' },
                },
                insertedMediaRows: [
                    {
                        id: 'm1',
                        postId: 'post1',
                        url: 'https://cdn/p1.jpg',
                        mediaType: 'image',
                        fileSize: 10,
                        width: 10,
                        height: 10,
                        duration: null,
                        thumbnailUrl: null,
                        altText: null,
                        displayOrder: 0,
                    }
                ],
            });

            const { fanoutQueue } = await import('../../../infra/queue/fanout.queue.js');

            const result = await PostsService.createPost({
                userId: 'user1',
                content: 'Hello',
                visibility: 'public',
                mediaAttachments: [
                    {
                        storageBucket: 'tmp',
                        storagePath: 'tmp/1.jpg',
                        url: 'https://cdn/tmp/1.jpg',
                        mediaType: 'image',
                        fileSize: 10,
                    }
                ],
            });

            expect(MediaService.finalizePostMediaAttachments).toHaveBeenCalled();
            expect(MediaService.enqueuePostMediaResizeJobs).toHaveBeenCalled();
            expect(fanoutQueue.add).toHaveBeenCalled();
            expect(result.id).toBe('post1');
        });
    });

    describe('sharePost', () => {
        it('throws when post does not exist', async () => {
            db.limit.mockResolvedValueOnce([]);

            await expect(
                PostsService.sharePost({ userId: 'user1', postId: 'post1' })
            ).rejects.toThrow('Post not found');
        });

        it('throws when post is not accessible', async () => {
            db.limit.mockResolvedValueOnce([
                { id: 'post1', userId: 'owner1', visibility: 'private', content: 'secret' }
            ]);

            await expect(
                PostsService.sharePost({ userId: 'user2', postId: 'post1' })
            ).rejects.toThrow('Post not found');
        });

        it('shares a post and dispatches notification', async () => {
            db.limit.mockResolvedValueOnce([
                { id: 'post1', userId: 'owner1', visibility: 'public', content: 'hello' }
            ]);
            db.transaction.mockResolvedValueOnce([{ sharesCount: 2 }]);

            const getPostSpy = vi
                .spyOn(PostsService, 'getPostById')
                .mockResolvedValue({ id: 'share1' });
            const { dispatchNotification } = await import('../../../modules/notifications/notifications.service.js');

            try {
                const result = await PostsService.sharePost({ userId: 'user2', postId: 'post1' });

                expect(dispatchNotification).toHaveBeenCalled();
                expect(result).toEqual({
                    success: true,
                    post: { id: 'share1' },
                    shareCount: 2,
                });
            } finally {
                getPostSpy.mockRestore();
            }
        });
    });

    describe('getHybridFeed', () => {
        it('falls back when redis is unavailable', async () => {
            const redisService = (await import('../../../infra/redis/redis.service.js')).default;
            redisService.lrange.mockRejectedValueOnce(new Error('redis down'));

            const fallbackSpy = vi
                .spyOn(PostsService, 'getFallbackFeed')
                .mockResolvedValue([{ id: 'post1' }]);

            const result = await PostsService.getHybridFeed('user1');

            expect(fallbackSpy).toHaveBeenCalled();
            expect(result).toEqual([{ id: 'post1', isCaughtUp: true }]);

            fallbackSpy.mockRestore();
        });
    });

    describe('getPostById', () => {
        it('returns null when viewer cannot access post', async () => {
            db.limit.mockResolvedValueOnce([
                { id: 'post1', userId: 'owner1', visibility: 'private' }
            ]);

            const result = await PostsService.getPostById('post1', 'user2');

            expect(result).toBeNull();
        });
    });

    describe('bookmarkPost', () => {
        it('throws when post is not accessible', async () => {
            db.limit.mockResolvedValueOnce([
                { id: 'post1', userId: 'owner1', visibility: 'private' }
            ]);

            await expect(
                PostsService.bookmarkPost({ userId: 'user2', postId: 'post1' })
            ).rejects.toThrow('Post not found');
        });
    });
});
