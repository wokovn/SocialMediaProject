import PostsService from './posts.service.js';

const PostsController = {

    getPublicFeed: async (req, res) => {
        const userId = req.user.sub;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        try {
            const posts = await PostsService.getPublicFeed(userId, limit, offset);
            res.status(200).json(posts);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error retrieving public feed' });
        }
    },

    getPost: async (req, res) => {
        const postId = req.params.id;
        const userId = req.user.sub;
        try {
            const post = await PostsService.getPostById(postId, userId);
            if (post) {
            res.status(200).json(post);
            } else {
            res.status(404).json({ message: 'Post not found' });
            }
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error retrieving post' });
        }
        
    },
    getUserPosts: async (req, res) => {
        const targetUserId = req.params.userId;
        const viewerUserId = req.user.sub;
        try {
            const posts = await PostsService.getPostsByUserId(targetUserId, viewerUserId);
            res.status(200).json(posts);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error retrieving posts' });
        }
    },
    createPost: async (req, res) => {
        const userId = req.user.sub; // Get userId from JWT token
        const { content, visibility, mediaAttachments } = req.body;
        try {
            const post = await PostsService.createPost({ userId, content, visibility, mediaAttachments });
            res.status(201).json({ message: 'Post created successfully', postId: post.id, post });
        } catch (error) {
            if (error.message === 'Post content or media is required') {
                return res.status(400).json({ message: error.message });
            }
            console.log(error);
            return res.status(500).json({ message: error.message || 'Error creating post' });
        }
    },
    deletePost: async (req, res) => {
        const postId = req.params.id;
        try {
            await PostsService.deletePost(postId);
            res.status(200).json({ message: 'Post deleted successfully' });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error deleting post' });
        }
    },
    likePost: async (req, res) => {
        const postId = req.params.id;
        const userId = req.user.sub; // Get userId from JWT token
        try {
            const result = await PostsService.likePost({postId, userId});
            res.status(200).json({ message: 'Post liked successfully', likeCount: result.likeCount });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error liking post' });
        }
    },
    unlikePost: async (req, res) => {
        const postId = req.params.id;
        const userId = req.user.sub; // Get userId from JWT token
        try {
            const result = await PostsService.unlikePost({postId, userId});
            res.status(200).json({ message: 'Post unliked successfully', likeCount: result.likeCount });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error unliking post' });
        }
    }
};
export default PostsController;