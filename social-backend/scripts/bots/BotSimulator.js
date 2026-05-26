import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = 'http://localhost:3000/api'; 

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

export class BotSimulator {
    constructor({ email, password, username, fullName, accessToken, userId, following = [] }) {
        this.email = email;
        this.password = password;
        this.username = username;
        this.fullName = fullName;
        this.accessToken = accessToken || null;
        this.userId = userId || null;
        this.following = following; // Lịch sử đã follow ai

        this.axiosInstance = axios.create({ baseURL: API_BASE_URL });
        if (this.accessToken) {
            this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
        }
    }

    // Export dữ liệu bot ra để lưu vào JSON
    toJSON() {
        return {
            email: this.email,
            password: this.password,
            username: this.username,
            fullName: this.fullName,
            accessToken: this.accessToken,
            userId: this.userId,
            following: this.following
        };
    }

    async init() {
        try {
            if (!this.userId) {
                // Thử tạo user bằng Admin API (v1 syntax)
                const { data: userData, error: createError } = await supabaseAdmin.auth.api.createUser({
                    email: this.email,
                    password: this.password,
                    email_confirm: true,
                    user_metadata: { username: this.username, full_name: this.fullName }
                });

                if (createError && !createError.message.includes('already registered')) {
                    throw createError;
                }
            }

            // Đăng nhập lấy Token (v1 syntax)
            const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_KEY);
            const { user, session, error: authError } = await supabase.auth.signIn({
                email: this.email,
                password: this.password
            });

            if (authError) throw authError;

            this.accessToken = session.access_token;
            this.userId = user.id;
            this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
            console.log(`[Bot ${this.username}] Khởi tạo thành công! (ID: ${this.userId})`);
            return true;
        } catch (error) {
            console.error(`[Bot ${this.username}] Lỗi init: ${error.message}`);
            return false;
        }
    }

    async followByUsername(targetUsername) {
        if (this.following.includes(targetUsername)) return;
        try {
            const res = await this.axiosInstance.get(`/users/by-username/${targetUsername}`);
            if (!res.data || !res.data.id) {
                throw new Error(`Không tìm thấy profile cho @${targetUsername}`);
            }
            const targetUserId = res.data.id;
            await this.axiosInstance.post(`/users/${targetUserId}/follow`);
            this.following.push(targetUsername);
            console.log(`[Bot ${this.username}] Đã follow @${targetUsername}`);
            return true;
        } catch (error) {
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.message;
            console.error(`[Bot ${this.username}] Lỗi follow @${targetUsername}: [Status ${status}] ${msg}`);
            return false;
        }
    }

    async createPost(content, visibility = 'public') {
        try {
            const res = await this.axiosInstance.post('/posts', { content, visibility });
            // API trả về { message, postId, post }
            const postId = res.data.postId || res.data.id;
            console.log(`[Bot ${this.username}] Đã đăng bài (ID: ${postId})`);
            return postId;
        } catch (error) {
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.message;
            console.error(`[Bot ${this.username}] Lỗi đăng bài: [Status ${status}] ${msg}`);
            return null;
        }
    }

    async likePost(postId) {
        try {
            await this.axiosInstance.post(`/posts/${postId}/like`);
            console.log(`[Bot ${this.username}] Đã like bài ${postId}`);
            return true;
        } catch (error) {
            const status = error.response?.status;
            console.error(`[Bot ${this.username}] Lỗi like bài ${postId}: [Status ${status}]`);
            return false;
        }
    }

    async commentOnPost(postId, content) {
        try {
            // Path chuẩn trong backend: /api/posts/:postId/comments
            const res = await this.axiosInstance.post(`/posts/${postId}/comments`, { content });
            console.log(`[Bot ${this.username}] Đã comment vào bài ${postId}`);
            return res.data.id || true;
        } catch (error) {
            const status = error.response?.status;
            const msg = error.response?.data?.message || error.message;
            console.error(`[Bot ${this.username}] Lỗi comment bài ${postId}: [Status ${status}] ${msg}`);
            return false;
        }
    }

    // Thực hiện hành động ngẫu nhiên
    async doRandomInteraction(targetUsernames, targetPostIds) {
        const action = Math.floor(Math.random() * 3); // 0, 1, 2
        try {
            if (action === 0 && targetUsernames.length > 0) {
                // Random follow
                const randomUser = targetUsernames[Math.floor(Math.random() * targetUsernames.length)];
                await this.followByUsername(randomUser);
            } else if (action === 1 && targetPostIds.length > 0) {
                // Random like
                const randomPost = targetPostIds[Math.floor(Math.random() * targetPostIds.length)];
                await this.likePost(randomPost);
            } else if (action === 2 && targetPostIds.length > 0) {
                // Random comment
                const randomPost = targetPostIds[Math.floor(Math.random() * targetPostIds.length)];
                const comments = ['Bài này thú vị đấy', 'Đỉnh quá', 'Cho mình hóng với', 'Hay tuyệt', '+1'];
                const randomContent = comments[Math.floor(Math.random() * comments.length)];
                await this.commentOnPost(randomPost, randomContent);
            }
        } catch (e) {
            // ignore
        }
    }
}
