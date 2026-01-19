import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoute from './modules/auth/auth.route.js';
import postsRoute from './modules/posts/posts.route.js';

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
app.use('/api/posts', postsRoute);

export default app;
