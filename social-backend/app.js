import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoute from './modules/auth/auth.route.js';
import postsRoute from './modules/posts/posts.route.js';
import commentsRoute from './modules/comments/comment.route.js';
import mediaRoute from './modules/media/media.route.js';
import usersRoute from './modules/users/users.route.js';
import usersPublicRoute from './modules/users/users.public.route.js';
import adminRoute from './modules/admin/admin.route.js';
import notificationsRoute from './modules/notifications/notifications.route.js';
import { verifySupabaseJWT } from './middlewares/jwt/jwt.middleware.js';

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.use('/api/auth', authRoute);
app.use('/api/admin', adminRoute);
app.use('/api/users', usersPublicRoute);
app.use('/api/posts', verifySupabaseJWT, postsRoute);
app.use('/api/posts/:postId/comments', verifySupabaseJWT, commentsRoute);
app.use('/api/media', verifySupabaseJWT, mediaRoute);
app.use('/api/users', verifySupabaseJWT, usersRoute);
app.use('/api/notifications', verifySupabaseJWT, notificationsRoute);

export default app;
