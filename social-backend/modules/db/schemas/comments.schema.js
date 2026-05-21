import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import users from './users.schema.js';
import posts from './posts.schema.js';

// Comments table - supports nested comments/replies
const comments = pgTable('comments', {
  id: uuid('id').default(sql`uuid_generate_v7()`).primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  likesCount: integer('likes_count').default(0),
  repliesCount: integer('replies_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export default comments;
