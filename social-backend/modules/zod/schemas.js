import * as z from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
    fullName: z.string().min(5, 'Full name must be at least 5 characters long').max(50, 'Full name must be at most 50 characters long'),
    avatar: z.string().url().optional(),
    bio: z.string().max(160).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(20).optional(),
    fullName: z.string().min(5, 'Full name must be at least 5 characters long').max(50, 'Full name must be at most 50 characters long').optional(),
    avatar: z.string().url().optional(),
    bio: z.string().max(160).optional(),
});

export const createPostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty').max(280, 'Post content cannot exceed 280 characters'),
    visibility: z.enum(['public', 'private', 'friends']).default('public'),
});

export const updatePostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty').max(280, 'Post content cannot exceed 280 characters').optional(),
    visibility: z.enum(['public', 'private', 'friends']).optional(),
});

export const createCommentSchema = z.object({
  postId: z.string().uuid(),
    content: z.string().min(1, 'Comment content cannot be empty').max(280, 'Comment content cannot exceed 280 characters'),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty').max(280, 'Comment content cannot exceed 280 characters').optional(),
});

export const createLikeSchema = z.object({
  postId: z.string().uuid(),
});

export const updateLikeSchema = z.object({
  postId: z.string().uuid().optional(),
});
