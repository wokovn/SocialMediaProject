// Export all schemas
import users from './users.schema.js';
import posts from './posts.schema.js';
import media from './media.schema.js';
import comments from './comments.schema.js';
import likes from './likes.schema.js';
import bookmarks from './bookmarks.schema.js';
import follows, { userStats } from './follows.schema.js';

export {
  users,
  posts,
  media,
  comments,
  likes,
  bookmarks,
  follows,
  userStats
};
