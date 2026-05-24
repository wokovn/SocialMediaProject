import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Users table - linked to auth.users
const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull(),
  email: text('email').unique(),
  username: text('username').unique(),
  fullName: text('full_name'),
  avatar: text('avatar'),
  banner: text('banner'),
  bio: text('bio'),
  website: text('website'),
  showEmail: boolean('show_email').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export default users;
