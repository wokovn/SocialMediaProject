import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load biến môi trường từ .env của backend
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = 'http://localhost:3000/api'; // Thay đổi port nếu backend chạy port khác

// Khởi tạo Supabase client với Service Role Key để có quyền Admin
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

class BotSimulator {
    constructor(email, password, username, fullName) {
        this.email = email;
        this.password = password;
        this.username = username;
        this.fullName = fullName;
        this.accessToken = null;
        this.userId = null;
        this.axiosInstance = axios.create({
            baseURL: API_BASE_URL,
        });
    }

    /**
     * 1. Khởi tạo/Đăng nhập Bot
     * Dùng Admin API để tạo user và auto-confirm email.
     */
    async init() {
        console.log(`[Bot ${this.username}] Đang khởi tạo...`);
        try {
            // Thử tạo user bằng Admin API
            const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: this.email,
                password: this.password,
                email_confirm: true, // Bypass email confirmation
                user_metadata: {
                    username: this.username,
                    full_name: this.fullName
                }
            });

            if (createError && !createError.message.includes('already registered')) {
                throw createError;
            }

            if (!createError) {
                console.log(`[Bot ${this.username}] Tạo tài khoản thành công!`);
            } else {
                console.log(`[Bot ${this.username}] Tài khoản đã tồn tại, tiến hành đăng nhập...`);
            }

            // Đăng nhập bằng client thông thường để lấy JWT Access Token
            const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_KEY);
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: this.email,
                password: this.password
            });

            if (authError) throw authError;

            this.accessToken = authData.session.access_token;
            this.userId = authData.user.id;
            
            // Gắn token vào axios instance
            this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
            console.log(`[Bot ${this.username}] Đăng nhập thành công!`);
            
        } catch (error) {
            console.error(`[Bot ${this.username}] Lỗi khởi tạo:`, error.message);
        }
    }

    /**
     * 2. Tự động Follow 1 danh sách Username quy định
     */
    async followTargetUsernames(targetUsernames) {
        for (const targetUsername of targetUsernames) {
            try {
                // 2.1. Lấy thông tin user mục tiêu qua username
                const res = await this.axiosInstance.get(`/users/by-username/${targetUsername}`);
                const targetUserId = res.data.data.id;

                // 2.2. Gửi request follow
                await this.axiosInstance.post(`/users/${targetUserId}/follow`);
                console.log(`[Bot ${this.username}] Đã follow @${targetUsername}`);
            } catch (error) {
                console.log(`[Bot ${this.username}] Không thể follow @${targetUsername}:`, error.response?.data?.message || error.message);
            }
        }
    }

    /**
     * 3. Tự động đăng bài viết (Post)
     */
    async createPost(content, visibility = 'public') {
        try {
            const res = await this.axiosInstance.post('/posts', {
                content,
                visibility
            });
            console.log(`[Bot ${this.username}] Đã đăng bài: "${content}" (ID: ${res.data.data.id})`);
            return res.data.data.id;
        } catch (error) {
            console.log(`[Bot ${this.username}] Lỗi đăng bài:`, error.response?.data?.message || error.message);
        }
    }

    /**
     * 4. Tự động Like 1 bài viết
     */
    async likePost(postId) {
        try {
            await this.axiosInstance.post(`/posts/${postId}/like`);
            console.log(`[Bot ${this.username}] Đã like bài viết ${postId}`);
        } catch (error) {
            console.log(`[Bot ${this.username}] Lỗi like bài:`, error.response?.data?.message || error.message);
        }
    }

    /**
     * 5. Tự động Comment vào bài viết
     */
    async commentOnPost(postId, content) {
        try {
            const res = await this.axiosInstance.post(`/comments`, {
                postId,
                content
            });
            console.log(`[Bot ${this.username}] Đã comment: "${content}" vào bài ${postId}`);
            return res.data.data.id;
        } catch (error) {
            console.log(`[Bot ${this.username}] Lỗi comment:`, error.response?.data?.message || error.message);
        }
    }
}

// ==========================================
// KỊCH BẢN CHẠY THỬ (TEST SCENARIO)
// ==========================================
async function runSimulator() {
    console.log("=== BẮT ĐẦU CHẠY STRESS TEST / BOT SIMULATOR ===");

    // Những username thật trên hệ thống mà bạn muốn bot follow
    const targetUsernamesToFollow = ['admin', 'testuser1'];

    // Khởi tạo 2 Bot ảo
    const bot1 = new BotSimulator('bot1@example.com', 'Password123!', 'testbot1', 'Test Bot 1');
    const bot2 = new BotSimulator('bot2@example.com', 'Password123!', 'testbot2', 'Test Bot 2');

    // Khởi chạy đăng nhập/đăng ký
    await bot1.init();
    await bot2.init();

    if (!bot1.accessToken || !bot2.accessToken) return;

    // Kịch bản:
    // 1. Bot follow các account mục tiêu
    await bot1.followTargetUsernames(targetUsernamesToFollow);
    await bot2.followTargetUsernames(targetUsernamesToFollow);

    // 2. Bot 1 đăng bài
    const postId = await bot1.createPost(`Hello world! Tớ là bot 1 đang test hệ thống. Time: ${new Date().toISOString()}`);

    if (postId) {
        // 3. Bot 2 đi like bài của bot 1
        await bot2.likePost(postId);

        // 4. Bot 2 comment vào bài của bot 1
        await bot2.commentOnPost(postId, 'Comment tự động từ Bot 2! Bài viết rất hay nha!');
    }

    console.log("=== HOÀN TẤT KỊCH BẢN ===");
}

runSimulator();
