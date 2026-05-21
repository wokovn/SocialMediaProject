import { sql } from 'drizzle-orm';
import { pgTable, uuid, timestamp, unique, integer } from 'drizzle-orm/pg-core';
import users from './users.schema.js';

// Follows table - follow/following relationships
export const follows = pgTable('follows', {
  id: uuid('id').default(sql`uuid_generate_v7()`).primaryKey(),
  followerId: uuid('follower_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  followingId: uuid('following_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  uniqueFollowerFollowing: unique().on(table.followerId, table.followingId)
}));

// User stats table - track follower/following counts
export const userStats = pgTable('user_stats', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  followersCount: integer('followers_count').default(0),
  followingCount: integer('following_count').default(0),
  postsCount: integer('posts_count').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export default follows;
