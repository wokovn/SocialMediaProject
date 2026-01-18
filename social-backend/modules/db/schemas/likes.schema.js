import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import users from './users.schema.js';
import posts from './posts.schema.js';
import comments from './comments.schema.js';

// Likes table - for both posts and comments
const likes = pgTable('likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  uniqueUserPost: unique().on(table.userId, table.postId),
  uniqueUserComment: unique().on(table.userId, table.commentId)
}));

export default likes;
