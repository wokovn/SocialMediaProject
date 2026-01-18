import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import posts from './posts.schema.js';

// Media table - for post attachments
const media = pgTable('media', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  mediaType: text('media_type').notNull(),
  fileSize: integer('file_size'),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  thumbnailUrl: text('thumbnail_url'),
  altText: text('alt_text'),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export default media;
