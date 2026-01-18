import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Users table - linked to auth.users
const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull(),
  email: text('email').unique(),
  username: text('username').unique(),
  fullName: text('full_name'),
  avatar: text('avatar'),
  bio: text('bio'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export default users;
