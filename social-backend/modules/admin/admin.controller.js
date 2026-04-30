import redisService from '../../infra/redis/redis.service.js';
import db from '../db/db.js';
import posts from '../db/schemas/posts.schema.js';
import users from '../db/schemas/users.schema.js';
import { inArray, eq } from 'drizzle-orm';

export const getAdminStats = async (req, res) => {
    try {
        // 1. Get Top 20 Trending Posts
        const trendingRaw = await redisService.zrevrange('global_trending_feed', 0, 19, 'WITHSCORES');
        const trendingList = [];
        const postIds = [];
        
        // zrevrange with WITHSCORES returns [item1, score1, item2, score2, ...]
        for (let i = 0; i < trendingRaw.length; i += 2) {
            const postId = trendingRaw[i];
            const score = parseFloat(trendingRaw[i + 1]);
            trendingList.push({ postId, score });
            postIds.push(postId);
        }

        let populatedPosts = [];
        if (postIds.length > 0) {
            populatedPosts = await db
                .select({
                    id: posts.id,
                    content: posts.content,
                    likesCount: posts.likesCount,
                    commentsCount: posts.commentsCount,
                    sharesCount: posts.sharesCount,
                    createdAt: posts.createdAt,
                    author: {
                        id: users.id,
                        fullName: users.fullName,
                        username: users.username,
                    }
                })
                .from(posts)
                .leftJoin(users, eq(posts.userId, users.id))
                .where(inArray(posts.id, postIds));
        }

        // Merge DB data with Redis scores
        const resultPosts = trendingList.map(item => {
            const p = populatedPosts.find(p => p.id === item.postId);
            return {
                ...p,
                hotScore: item.score
            };
        }).filter(p => p.id); // Lọc bỏ nếu post bị xóa khỏi DB

        return res.status(200).json({
            trendingPosts: resultPosts
        });
    } catch (error) {
        console.error('[Admin] Error getting stats', error);
        return res.status(500).json({ error: error.message });
    }
};
