import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import users from './users.schema.js';

// Posts table
const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sharedPostId: uuid('shared_post_id'),
  content: text('content').notNull(),
  visibility: text('visibility').default('public'),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  sharesCount: integer('shares_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export default posts;
