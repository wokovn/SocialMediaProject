import redisService from '../../infra/redis/redis.service.js';
import db from '../db/db.js';
import posts from '../db/schemas/posts.schema.js';
import users from '../db/schemas/users.schema.js';
import { inArray, eq, isNull } from 'drizzle-orm';
import { HOT_ZSET, COLD_ZSET, getScoreTier, SCORE_TIERS } from '../../infra/workers/ranking/ranking.processor.js';

/**
 * Helper: parse zrevrange WITHSCORES result into [{postId, score}] array
 */
function parseZrevrange(raw) {
    const list = [];
    const ids  = [];
    for (let i = 0; i < raw.length; i += 2) {
        const postId = raw[i];
        const score  = parseFloat(raw[i + 1]);
        list.push({ postId, score });
        ids.push(postId);
    }
    return { list, ids };
}

/**
 * Helper: fetch post rows from DB and merge with Redis scores.
 * Filters out soft-deleted posts.
 */
async function fetchAndMerge(zrevrangeRaw) {
    const { list, ids } = parseZrevrange(zrevrangeRaw);
    if (!ids.length) return [];

    const dbPosts = await db
        .select({
            id:            posts.id,
            content:       posts.content,
            likesCount:    posts.likesCount,
            commentsCount: posts.commentsCount,
            sharesCount:   posts.sharesCount,
            createdAt:     posts.createdAt,
            author: {
                id:       users.id,
                fullName: users.fullName,
                username: users.username,
            },
        })
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .where(inArray(posts.id, ids) && isNull(posts.deletedAt));  // exclude soft-deleted

    const postMap = new Map(dbPosts.map(p => [p.id, p]));

    return list
        .map(item => {
            const p = postMap.get(item.postId);
            if (!p) return null;
            const tier = getScoreTier(item.score);
            return { ...p, hotScore: item.score, scoreTier: tier.label, scoreTierDesc: tier.description };
        })
        .filter(Boolean);
}

export const getAdminStats = async (req, res) => {
    try {
        // 1. Hot trending posts (active pool)
        const hotRaw  = await redisService.zrevrange(HOT_ZSET,  0, 19, 'WITHSCORES');
        const hotPosts = await fetchAndMerge(hotRaw);

        // 2. Cold posts (archive — optional, useful for "all-time popular" view)
        const coldRaw  = await redisService.zrevrange(COLD_ZSET, 0, 9, 'WITHSCORES');
        const coldPosts = await fetchAndMerge(coldRaw);

        return res.status(200).json({
            trendingPosts: hotPosts,
            coldPosts,
            scoreTiers: SCORE_TIERS, // legend cho dashboard
        });
    } catch (error) {
        console.error('[Admin] Error getting stats', error);
        return res.status(500).json({ error: error.message });
    }
};
