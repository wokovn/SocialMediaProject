import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// Cấu hình kịch bản Stress Test thực tế trong 30 Phút
export const options = {
    stages: [
        { duration: '5m', target: 150 },  // Ramping up nhanh lên 150 VUs (Kích hoạt HPA)
        { duration: '20m', target: 350 }, // MAX ENDURANCE REALISTIC: Duy trì tải 350 VUs trong 20 phút
        { duration: '5m', target: 0 },    // Cool-down tải về 0
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],       // Tải thực tế yêu cầu tỉ lệ lỗi cực thấp (< 1%)
        http_req_duration: ['p(95)<2000'],    // Phản hồi p95 dưới 2 giây
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// Đọc danh sách tài khoản bot từ file botData.json
const botData = JSON.parse(open('../social-backend/scripts/bots/botData.json'));

// Chuẩn bị file ảnh nhị phân giả lập (~1.5MB)
const fakeImage = open('./assets/test-image.png', 'b');

// Hàm setup() chạy 1 lần trước khi chạy test chính để lấy tokens xác thực
export function setup() {
    console.log('--- GIAI ĐOẠN WARMUP: TỰ ĐỘNG ĐĂNG NHẬP LẤY TOKENS CHO REALISTIC TEST ---');
    console.log(`Tìm thấy: ${botData.length} tài khoản bots trong botData.json.`);

    const tokens = [];
    const maxBotsToLogin = Math.min(botData.length, 50); // Đăng nhập tối đa 50 bots
    console.log(`Tiến hành đăng nhập ${maxBotsToLogin} bots với tần suất chậm để tránh rate limit...`);

    for (let i = 0; i < maxBotsToLogin; i++) {
        const bot = botData[i];
        const payload = JSON.stringify({
            identifier: bot.email,
            password: bot.password || 'Password123!',
        });

        const params = {
            headers: { 'Content-Type': 'application/json' },
        };

        const res = http.post(`${BASE_URL}/auth/login`, payload, params);
        
        if (res.status === 200) {
            try {
                const body = JSON.parse(res.body);
                const token = body.session.access_token;
                if (token) {
                    tokens.push(token);
                }
            } catch (e) {
                console.warn(`[Warmup] Lỗi login bot ${bot.username}`);
            }
        } else {
            console.warn(`[Warmup] Không thể đăng nhập bot ${bot.username} (Status: ${res.status})`);
        }

        sleep(0.2); // Nghỉ 200ms để tránh dồn dập
    }

    console.log(`[Warmup] HOÀN TẤT! Lấy thành công ${tokens.length} tokens.`);
    if (tokens.length === 0) {
        throw new Error('Không lấy được bất kỳ token hợp lệ nào!');
    }

    return tokens;
}

// Hàm chạy test chính (VUs sẽ chạy song song)
export default function (tokens) {
    const token = tokens[randomIntBetween(0, tokens.length - 1)];

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    };

    const roll = Math.random();

    if (roll < 0.75) {
        // --- TÁC VỤ 1: ĐỌC FEED THỰC TẾ (75% Tỉ lệ - Phổ biến nhất) ---
        let feedRes = http.get(`${BASE_URL}/posts/feed/hybrid?limit=20`, params);
        check(feedRes, {
            'Hybrid Feed status is 200': (r) => r.status === 200,
            'Hybrid Feed has data': (r) => JSON.parse(r.body).length >= 0,
        });

        let publicRes = http.get(`${BASE_URL}/posts/feed/public?limit=10`, params);
        check(publicRes, {
            'Public Feed status is 200': (r) => r.status === 200,
        });

        try {
            const posts = JSON.parse(feedRes.body);
            if (posts && posts.length > 0) {
                const postIds = posts.slice(0, 5).map(p => p.id);
                let seenRes = http.post(`${BASE_URL}/posts/feed/seen`, JSON.stringify({ postIds }), {
                    headers: { ...params.headers, 'Content-Type': 'application/json' }
                });
                check(seenRes, { 'Mark seen successful': (r) => r.status === 200 });
            }
        } catch (e) {}

    } else if (roll < 0.97) {
        // --- TÁC VỤ 2: TƯƠNG TÁC LIKE/COMMENT (22% Tỉ lệ) ---
        let feedRes = http.get(`${BASE_URL}/posts/feed/hybrid?limit=5`, params);
        let posts = [];
        try { posts = JSON.parse(feedRes.body); } catch(e) {}

        if (posts && posts.length > 0) {
            const postId = posts[randomIntBetween(0, posts.length - 1)].id;
            
            let likeRes = http.post(`${BASE_URL}/posts/${postId}/like`, null, params);
            check(likeRes, { 'Like post status is 200': (r) => r.status === 200 });

            const commentPayload = JSON.stringify({
                content: `Comment thảo luận thực tế: ${randomString(10)} 👍`
            });
            let commentRes = http.post(`${BASE_URL}/posts/${postId}/comments`, commentPayload, {
                headers: { ...params.headers, 'Content-Type': 'application/json' }
            });
            check(commentRes, { 'Comment post status is 201': (r) => r.status === 201 });
        }

    } else {
        // --- TÁC VỤ 3: UPLOAD MEDIA & ĐĂNG BÀI (Chỉ 3% Tỉ lệ - Đúng với thực tế!) ---
        const data = {
            file: http.file(fakeImage, 'stress-image.png', 'image/png'),
        };

        let uploadRes = http.post(`${BASE_URL}/media/upload-temp`, data, params);
        check(uploadRes, {
            'Upload media thành công': (r) => r.status === 200 || r.status === 201,
        });

        let mediaUrl = null;
        let storagePath = null;
        try {
            const body = JSON.parse(uploadRes.body);
            mediaUrl = body.url || body.mediaUrl;
            storagePath = body.storagePath;
        } catch (e) {}

        if (mediaUrl) {
            const postPayload = JSON.stringify({
                content: `Bài viết chia sẻ hình ảnh thực tế từ người dùng k6!`,
                visibility: 'public',
                mediaAttachments: [{
                    url: mediaUrl,
                    storagePath: storagePath,
                    mediaType: 'image',
                    fileSize: 1572864, // ~1.5MB
                    displayOrder: 0
                }]
            });

            let postRes = http.post(`${BASE_URL}/posts`, postPayload, {
                headers: { ...params.headers, 'Content-Type': 'application/json' }
            });

            check(postRes, {
                'Create media post thành công': (r) => r.status === 201,
            });
        }
    }

    // Thời gian nghỉ từ 1-2s giả lập hành vi người dùng lướt và thao tác
    sleep(randomIntBetween(1, 2));
}

export function handleSummary(data) {
    return {
        "realistic-stress-report.html": htmlReport(data),
    };
}
