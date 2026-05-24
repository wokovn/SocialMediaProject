import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// Cấu hình kịch bản Light Soak (Soak nhẹ) trong 30 Phút
export const options = {
    stages: [
        { duration: '3m', target: 60 },   // Ramping up nhẹ nhàng lên 60 VUs
        { duration: '24m', target: 60 },  // SUSTAINED SOAK: Duy trì tải ổn định 60 VUs trong 24 phút
        { duration: '3m', target: 0 },    // Cool-down về 0 để đo lường dọn dẹp RAM
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],       // Soak nhẹ yêu cầu độ tin cậy tuyệt đối: Lỗi < 1%
        http_req_duration: ['p(95)<800'],     // Phản hồi p95 cực mượt, dưới 800ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// Đọc danh sách tài khoản bot từ file botData.json
const botData = JSON.parse(open('../social-backend/scripts/bots/botData.json'));

// Tự động đăng nhập lấy tokens trong giai đoạn Warmup (setup) của k6 với tần suất chậm
export function setup() {
    console.log('--- GIAI ĐOẠN WARMUP: TỰ ĐỘNG ĐĂNG NHẬP LẤY TOKENS (SOAK NHẸ) ---');
    
    const tokens = [];
    const maxBotsToLogin = Math.min(botData.length, 30); // Soak nhẹ chỉ cần khoảng 30 bots đăng nhập là đủ
    console.log(`Tiến hành đăng nhập ${maxBotsToLogin} bots tuần tự...`);

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
                // silent
            }
        }

        // Tần suất cực thấp: nghỉ 200ms giữa mỗi bot
        sleep(0.2);
    }

    console.log(`[Warmup] Thành công! Đã lấy ${tokens.length} tokens cho Soak test.`);
    if (tokens.length === 0) {
        throw new Error('Không lấy được bất kỳ token nào. Vui lòng kiểm tra kết nối API backend!');
    }

    return tokens;
}

export default function (tokens) {
    // Lấy ngẫu nhiên một token cho Virtual User (VU) hiện tại
    const token = tokens[randomIntBetween(0, tokens.length - 1)];

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    };

    const roll = Math.random();

    if (roll < 0.80) {
        // --- TÁC VỤ 1: ĐỌC FEED (80% Tỉ lệ - Tải lướt tin nhẹ nhàng) ---
        let feedRes = http.get(`${BASE_URL}/posts/feed/hybrid?limit=20`, params);
        check(feedRes, {
            'Hybrid Feed status is 200': (r) => r.status === 200,
        });

        if (Math.random() < 0.3) {
            http.get(`${BASE_URL}/posts/feed/public?limit=10`, params);
        }

    } else {
        // --- TÁC VỤ 2: TƯƠNG TÁC LIKE (20% Tỉ lệ) ---
        let feedRes = http.get(`${BASE_URL}/posts/feed/hybrid?limit=5`, params);
        let posts = [];
        try { posts = JSON.parse(feedRes.body); } catch(e) {}

        if (posts && posts.length > 0) {
            const postId = posts[0].id;
            
            let likeRes = http.post(`${BASE_URL}/posts/${postId}/like`, null, params);
            check(likeRes, {
                'Like post successful': (r) => r.status === 200,
            });
        }
    }

    // Thời gian nghỉ từ 3-6 giây giả lập hành vi lướt tin tự nhiên
    sleep(randomIntBetween(3, 6));
}

export function handleSummary(data) {
    return {
        "light-soak-report.html": htmlReport(data),
    };
}
