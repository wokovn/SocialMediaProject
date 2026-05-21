import { sql } from 'drizzle-orm';
import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import users from './users.schema.js';
import posts from './posts.schema.js';

// Bookmarks table - save posts for later
const bookmarks = pgTable('bookmarks', {
  id: uuid('id').default(sql`uuid_generate_v7()`).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  uniqueUserPost: unique().on(table.userId, table.postId)
}));

export default bookmarks;
