import PostsService from "../../modules/posts/posts.service.js";

export const verifyPostOwner = (req, res, next) => {
    const userIdFromToken = req.user.sub;
    const postId = req.params.id;
    PostsService.getPostById(postId)
        .then(post => {
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }
            if (post.userId !== userIdFromToken) {
                return res.status(403).json({ message: 'Forbidden: You do not own this post' });
            }
            next();
        }
        ).catch(error => {
        console.log(error);
        return res.status(500).json({ message: 'Error verifying post ownership' });
    });
};
    