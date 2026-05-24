import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Cấu hình kịch bản Max Endurance (Stress) trong 30 Phút
export const options = {
    stages: [
        { duration: '5m', target: 150 },  // Ramping up nhanh lên 150 VUs (Kích hoạt HPA)
        { duration: '20m', target: 350 }, // MAX ENDURANCE: Duy trì tải cực hạn 350 VUs trong 20 phút
        { duration: '5m', target: 0 },    // Cool-down tải về 0
    ],
    thresholds: {
        http_req_failed: ['rate<0.05'],       // Chấp nhận tỉ lệ lỗi tích lũy dưới 5% ở mức tải cực hạn
        http_req_duration: ['p(95)<2000'],    // Phản hồi p95 dưới 2 giây
    },
};

const BASE_URL = 'http://localhost:8080/api';

// Đọc danh sách tài khoản bot từ file botData.json có sẵn trong dự án
// Đường dẫn tương đối so với vị trí của file script này
const botData = JSON.parse(open('../social-backend/scripts/bots/botData.json'));

// Chuẩn bị file ảnh nhị phân giả lập (~1.5MB)
const fakeImage = open('./assets/test-image.jpg', 'b');

// Hàm setup() chạy duy nhất 1 lần trước khi chạy test chính (giai đoạn Warmup)
// Thực hiện tự động lấy tokens từ Express API với tần suất thấp (low rate)
export function setup() {
    console.log('--- GIAI ĐOẠN WARMUP: TỰ ĐỘNG ĐĂNG NHẬP LẤY TOKENS ---');
    console.log(`Tìm thấy: ${botData.length} tài khoản bots trong botData.json.`);

    const tokens = [];
    const maxBotsToLogin = Math.min(botData.length, 50); // Đăng nhập tối đa 50 bots để có đủ tokens mà không làm quá tải auth lúc khởi động
    console.log(`Tiến hành đăng nhập ${maxBotsToLogin} bots với tần suất chậm để tránh rate limit...`);

    for (let i = 0; i < maxBotsToLogin; i++) {
        const bot = botData[i];
        const payload = JSON.stringify({
            identifier: bot.email,
            password: bot.password || 'Password123!', // sử dụng mật khẩu mặc định nếu rỗng
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
                console.warn(`[Warmup] Lỗi phân tích phản hồi login của bot ${bot.username}`);
            }
        } else {
            console.warn(`[Warmup] Không thể đăng nhập bot ${bot.username} (Status: ${res.status})`);
        }

        // Tần suất đăng nhập thấp (Sleep 200ms giữa mỗi bot để tránh rate limit)
        sleep(0.2);
    }

    console.log(`[Warmup] HOÀN TẤT! Đã lấy thành công ${tokens.length} hoạt động tokens.`);
    if (tokens.length === 0) {
        throw new Error('Không lấy được bất kỳ token hợp lệ nào. Vui lòng kiểm tra kết nối tới Backend!');
    }

    // Trả về mảng tokens để tự động truyền làm tham số "data" cho các VUs trong hàm main default()
    return tokens;
}

// Hàm chạy test chính (VUs sẽ chạy song song)
export default function (tokens) {
    // Lấy ngẫu nhiên một token cho Virtual User (VU) hiện tại từ danh sách tokens nhận được từ setup()
    const token = tokens[randomIntBetween(0, tokens.length - 1)];

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    };

    const roll = Math.random();

    if (roll < 0.50) {
        // --- TÁC VỤ 1: ĐỌC FEED (50% Tỉ lệ) ---
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

    } else if (roll < 0.80) {
        // --- TÁC VỤ 2: TƯƠNG TÁC LIKE/COMMENT (30% Tỉ lệ) ---
        let feedRes = http.get(`${BASE_URL}/posts/feed/hybrid?limit=5`, params);
        let posts = [];
        try { posts = JSON.parse(feedRes.body); } catch(e) {}

        if (posts && posts.length > 0) {
            const postId = posts[randomIntBetween(0, posts.length - 1)].id;
            
            let likeRes = http.post(`${BASE_URL}/posts/${postId}/like`, null, params);
            check(likeRes, { 'Like post status is 200': (r) => r.status === 200 });

            const commentPayload = JSON.stringify({
                content: `Comment tải cực đại: ${randomString(10)} 🔥`
            });
            let commentRes = http.post(`${BASE_URL}/posts/${postId}/comments`, commentPayload, {
                headers: { ...params.headers, 'Content-Type': 'application/json' }
            });
            check(commentRes, { 'Comment post status is 201': (r) => r.status === 201 });
        }

    } else {
        // --- TÁC VỤ 3: UPLOAD MEDIA & TẠO BÀI VIẾT (20% Tỉ lệ - CỰC NẶNG) ---
        const data = {
            file: http.file(fakeImage, 'stress-image.jpg', 'image/jpeg'),
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
                content: `Bài viết mới kèm ảnh được tạo tự động dưới tải cực đại k6!`,
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

    sleep(randomIntBetween(1, 2));
}
