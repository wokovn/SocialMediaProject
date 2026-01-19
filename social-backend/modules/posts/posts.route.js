import PostsController from "./posts.controller.js";
import { verifyPostOwner } from "../../middlewares/posts/posts.middleware.js";
import { verifySupabaseJWT } from "../../middlewares/jwt/jwt.middleware.js";
import express from "express";

const router = express.Router();

router.get("/feed/public", verifySupabaseJWT, PostsController.getPublicFeed);
router.get("/:id", verifySupabaseJWT, PostsController.getPost);
router.get("/user/:userId", verifySupabaseJWT, PostsController.getUserPosts);
router.post("/", verifySupabaseJWT, PostsController.createPost);
router.delete("/:id", verifySupabaseJWT, verifyPostOwner, PostsController.deletePost);
router.post("/:id/like", verifySupabaseJWT, PostsController.likePost);
router.post("/:id/unlike", verifySupabaseJWT, PostsController.unlikePost);

export default router;