import PostsService from './posts.service.js';

const PostsController = {

    getPost: async (req, res) => {
        const postId = req.params.id;
        try {
            const post = await PostsService.getPostById(postId);
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
        const userId = req.params.userId;
        try {
            const posts = await PostsService.getPostsByUserId(userId);
            res.status(200).json(posts);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: 'Error retrieving posts' });
        }
    },
};
export default PostsController;