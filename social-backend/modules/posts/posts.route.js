import PostsController from "./posts.controller.js";
import express from "express";

const router = express.Router();

router.get("/:id", PostsController.getPost);
router.get("/user/:userId", PostsController.getUserPosts);

export default router;