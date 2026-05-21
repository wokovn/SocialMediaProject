import { v7 as uuidv7 } from 'uuid';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BotSimulator } from './BotSimulator.js';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_DATA_PATH = path.join(__dirname, 'botData.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Hàm đọc/ghi dữ liệu bot
function loadBotsData() {
    if (!fs.existsSync(BOT_DATA_PATH)) return [];
    try {
        const raw = fs.readFileSync(BOT_DATA_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function saveBotsData(botsData) {
    fs.writeFileSync(BOT_DATA_PATH, JSON.stringify(botsData, null, 2));
}

// Hàm lấy summary nhẹ
function getBotsSummary() {
    return activeBots.map(b => ({
        username: b.username,
        followingCount: b.following.length,
        status: b.accessToken ? 'Ready' : 'No Token'
    }));
}

// Khôi phục bots từ JSON (Chạy ngầm, không chặn startup)
let activeBots = [];
async function initializeBots() {
    const data = loadBotsData();
    activeBots = data.map(b => new BotSimulator(b));
    console.log(`[Manager] Đã load ${activeBots.length} bots. Đang login ngầm...`);
    
    // Login dần dần ở background để không treo server
    for (const bot of activeBots) {
        if (!bot.accessToken) {
            bot.init().catch(() => {});
            // Nghỉ một chút để tránh spam auth server quá nhanh
            await new Promise(r => setTimeout(r, 50)); 
        }
    }
}

// --- API Endpoints ---

// Phục vụ giao diện HTML với dữ liệu nhúng sẵn
app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    const summary = getBotsSummary();
    // Nhúng dữ liệu vào script tag
    html = html.replace('/*INITIAL_DATA*/', `window.initialBots = ${JSON.stringify(summary)};`);
    res.send(html);
});

// 1. Lấy danh sách bots (Nếu UI cần update lại)
app.get('/api/bots', (req, res) => {
    res.json(getBotsSummary());
});

// 2. Tạo bot mới
app.post('/api/bots/create', async (req, res) => {
    const { count, prefix } = req.body;
    let createdCount = 0;
    
    for (let i = 0; i < count; i++) {
        // Tạo unique suffix bằng random hex để tránh trùng lặp như uuidv7 trong cùng 1 mili-giây
        const uuid = crypto.randomBytes(4).toString('hex');
        const bot = new BotSimulator({
            email: `${prefix}_${uuid}@bot.local`,
            password: 'Password123!',
            username: `${prefix}_${uuid}`,
            fullName: `Bot ${prefix} ${uuid}`
        });
        const success = await bot.init();
        if (success) {
            activeBots.push(bot);
            createdCount++;
        }
    }
    saveBotsData(activeBots.map(b => b.toJSON()));
    res.json({ message: `Đã tạo ${createdCount} bots mới với GUID an toàn.`, total: activeBots.length });
});

// 2.5 Đăng nhập lại tất cả bot (để cập nhật token)
app.post('/api/bots/login-all', async (req, res) => {
    console.log("[Manager] Đang đăng nhập lại toàn bộ bot...");
    let successCount = 0;
    for (const bot of activeBots) {
        const success = await bot.init();
        if (success) successCount++;
    }
    saveBotsData(activeBots.map(b => b.toJSON()));
    res.json({ message: `Đã đăng nhập lại thành công ${successCount}/${activeBots.length} bots.` });
});

// 3. Hành động: Đẩy bài viết lên xu hướng (Make Hot) với tỉ lệ tùy chỉnh
app.post('/api/actions/hot', async (req, res) => {
    const { postId, likeRate = 1.0, commentRate = 0.5 } = req.body;
    if (!postId) return res.status(400).json({ error: 'Thiếu postId' });

    const COMMENT_POOL = [
        'Bài này thú vị đấy 🔥', 'Đỉnh quá!', 'Cho mình hóng với',
        'Tuyệt vời 👏', '+1', 'Hay lắm bạn ơi!', 'Ủng hộ nhiệt tình!',
        'Nội dung cực chất 💯', 'Đáng xem lắm!', 'Cảm ơn đã chia sẻ!'
    ];

    let likeCount = 0;
    let commentCount = 0;
    
    for (const bot of activeBots) {
        if (Math.random() <= likeRate) {
            const liked = await bot.likePost(postId);
            if (liked) likeCount++;
        }
        if (Math.random() <= commentRate) {
            const content = COMMENT_POOL[Math.floor(Math.random() * COMMENT_POOL.length)];
            const commented = await bot.commentOnPost(postId, content);
            if (commented) commentCount++;
        }
    }
    
    saveBotsData(activeBots.map(b => b.toJSON()));
    res.json({ message: `Đã đẩy bài ${postId} thành Hot!`, likes: likeCount, comments: commentCount });
});

// 3.5 Hành động: Bot tự tạo bài viết + các bot khác tương tác
app.post('/api/actions/create-posts', async (req, res) => {
    const {
        totalPosts = 10,         // Tổng số bài cần tạo (random bot đăng)
        enableEngagement = true, // Có để bot khác like/comment không
        likeRate = 0.7,          // Tỉ lệ like (0.0 - 1.0)
        commentRate = 0.3,       // Tỉ lệ comment (0.0 - 1.0)
        visibility = 'public'
    } = req.body;

    if (activeBots.length === 0) {
        return res.status(400).json({ error: 'Không có bot nào. Hãy tạo bot trước!' });
    }

    const CONTENT_POOL = [
    'Hôm nay thật là một ngày tuyệt vời! ☀️',
    'Vừa khám phá ra điều thú vị, chia sẻ cùng mọi người! 🚀',
    'Cuộc sống đẹp hơn khi có những khoảnh khắc như thế này 💫',
    'Cảm ơn mọi người đã luôn ủng hộ! ❤️',
    'Đang thử nghiệm tính năng mới, mọi người góp ý nhé!',
    'Chia sẻ chút suy nghĩ ngẫu nhiên trong ngày hôm nay 🌿',
    'Mỗi ngày là một cơ hội mới để làm điều tốt hơn ✨',
    'Bạn đã uống đủ nước hôm nay chưa? 💧',
    'Nhớ nghỉ ngơi đúng giờ nhé, sức khỏe là quan trọng nhất! 🏃',
    'Hôm nay có ai có chuyện vui muốn kể không? 😄',

    // Bài dài mới thêm
    'Sáng nay dậy sớm đi chạy bộ ven sông, nhìn ánh bình minh lên mà thấy cuộc đời thật đáng sống. Không khí trong lành, tiếng chim hót líu lo, cảm giác bình yên đến lạ. Nếu bạn đang trải qua giai đoạn khó khăn, hãy thử ra ngoài đi bộ 30 phút – nhiều khi giải pháp không đến từ việc ngồi suy nghĩ mà từ chỗ để cơ thể chuyển động. Chúc mọi người ngày mới tràn đầy năng lượng! 🌅',
    'Vừa hoàn thành dự án cá nhân sau 3 tháng miệt mài. Hành trình không hề dễ: bug liên tục, có lúc tưởng muốn bỏ cuộc. Nhưng nhìn lại, mỗi lần gặp lỗi là một lần học được điều mới. Bài học lớn nhất: đừng để sự hoàn hảo cản trở việc hoàn thành. Shipped > Perfect. Cảm ơn những người đã ủng hộ mình suốt thời gian qua! 💻🔥',
    'Cuối tuần rảnh, thử nấu bún bò Huế theo công thức bà ngoại – loay hoay từ 8 giờ sáng đến 12 giờ trưa. Kết quả: ngon hơn mong đợi rất nhiều! Bí quyết là ninh xương ít nhất 3 tiếng và đừng tiếc tay với sả với mắm ruốc. Nấu ăn đôi khi cũng như cuộc sống, cần kiên nhẫn đúng lúc mới ra được hương vị thật sự 🍜',
    'Hôm nay đọc lại cuốn sách cũ mua từ hồi đại học, bỗng thấy mình hiểu khác hẳn so với lần đầu đọc. Cùng một trang sách, nhưng con người đã khác. Đó cũng là lý do mình tin rằng đọc sách lần hai đôi khi còn giá trị hơn lần đầu – vì lúc đó mình đã có đủ trải nghiệm để hiểu tác giả muốn nói gì. 📚',
    'Remote work được 2 năm rồi, nhìn lại thấy mình đã thay đổi rất nhiều. Năng suất cao hơn, nhưng ranh giới giữa công việc và cuộc sống cá nhân mờ dần lúc nào không hay. Ai đang WFH có tips gì để "tắt máy đúng giờ" không? Mình đang cố tập thói quen dọn bàn làm việc lúc 6 giờ chiều như một nghi lễ kết thúc ngày làm 🏠💼',
    'Mới xem xong bộ phim tài liệu về biến đổi khí hậu, lòng nặng trĩu thật sự. Không phải vì bi quan, mà vì nhận ra những thứ mình đang làm hằng ngày – túi nilon, chai nhựa, thịt đỏ – đều có tác động. Bắt đầu từ những thứ nhỏ thôi: mang túi vải, uống nước bình, đi xe đạp khi có thể. Ai cùng thử challenge 30 ngày xanh hơn với mình không? 🌱',
    'Cà phê sáng + mưa lất phất ngoài cửa sổ + bản nhạc jazz nhẹ = combo hoàn hảo để làm việc. Mình hay nói vui là mình chỉ "vào trạng thái" được khi trời mưa. Bạn có "ritual" nào để bắt đầu ngày làm việc không? Share cho mình học hỏi với! ☕🎷',
    'Hôm qua tình cờ gặp lại người bạn cũ sau 5 năm không liên lạc. Ngồi nói chuyện 3 tiếng đồng hồ, kể đủ thứ chuyện đã xảy ra trong cuộc đời mỗi người. Mới thấy, có những mối quan hệ dù xa lâu đến mấy, gặp lại vẫn tự nhiên như chưa hề có khoảng cách. Trân trọng những người bạn như vậy lắm 🤝',
];

const COMMENT_POOL = [
    // Ngắn & emoji
    'Hay quá bạn ơi! 🔥', 'Nội dung cực chất! 💯', '+1 ủng hộ!',
    'Thú vị thật sự 😍', 'Cho mình hóng với nhé!', 'Tuyệt vời 👏',
    'Cảm ơn đã chia sẻ!', 'Bài viết rất có ý nghĩa ❤️',
    'Đỉnh của đỉnh! 🚀', 'Mình cũng nghĩ vậy!',

    // Phản hồi có nội dung hơn
    'Đọc xong thấy được truyền cảm hứng ghê, cảm ơn bạn nhiều lắm!',
    'Bài này cần được nhiều người đọc hơn, share ngay thôi!',
    'Mình đang trải qua đúng tình huống này, đọc bài bạn thấy đỡ hơn nhiều 🥺',
    'Lần đầu đọc bài của bạn, follow ngay từ bây giờ luôn!',
    'Ủa hay thế, bạn có thể nói rõ hơn phần này không?',
    'Mình không đồng ý 100% nhưng quan điểm của bạn rất đáng suy nghĩ 🤔',
    'Cần thêm nhiều nội dung như này lắm, cảm ơn bạn!',
    'Đã lưu lại để đọc lại sau, quá hữu ích!',
    'Bạn có thể làm video về chủ đề này không? Mình nghĩ nhiều người muốn xem lắm.',
    'Tag bạn thân vào đây để cùng đọc 😂',

    // Hài hước / tự nhiên
    'Đọc xong nghĩ ngợi cả buổi sáng luôn 😅',
    'Tại sao bài này không có thêm 1000 like 😤',
    'Mình đang ăn mà đọc xong muốn dừng lại suy nghĩ về cuộc đời 😂',
    'Bạn nói hộ lòng mình rồi đó!',
    'Nghe xong muốn đi ngủ sớm và dậy sớm luôn 💤',
    'Nhìn ảnh thôi đã thấy stress tan biến rồi 🌿',
    'Chill vãi, ai rảnh đi cùng mình không 😄',
    'Đợt này mình cũng đang cố thay đổi, đọc bài bạn có thêm động lực!',
];

    let totalPostsCreated = 0;
    let totalLikes = 0;
    let totalComments = 0;
    const createdPostIds = [];

    // Lọc bot sẵn sàng, rồi random chọn để đăng cho đủ totalPosts bài
    const readyBots = activeBots.filter(b => b.accessToken);
    if (readyBots.length === 0) {
        return res.status(400).json({ error: 'Không có bot nào sẵn sàng (chưa có token). Hãy Refresh Token trước!' });
    }

    for (let i = 0; i < totalPosts; i++) {
        const bot = readyBots[Math.floor(Math.random() * readyBots.length)];
        const content = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)];
        const postId = await bot.createPost(content, visibility);
        if (postId) {
            createdPostIds.push({ postId, authorUsername: bot.username });
            totalPostsCreated++;
        }
    }

    // Nếu bật engagement: các bot KHÁC sẽ like/comment lên các bài vừa tạo
    if (enableEngagement && createdPostIds.length > 0) {
        for (const { postId, authorUsername } of createdPostIds) {
            for (const bot of activeBots) {
                // Bot không tự like/comment bài của chính mình
                if (bot.username === authorUsername) continue;
                if (!bot.accessToken) continue;

                if (Math.random() <= likeRate) {
                    const liked = await bot.likePost(postId);
                    if (liked) totalLikes++;
                }
                if (Math.random() <= commentRate) {
                    const content = COMMENT_POOL[Math.floor(Math.random() * COMMENT_POOL.length)];
                    const commented = await bot.commentOnPost(postId, content);
                    if (commented) totalComments++;
                }
            }
        }
    }

    saveBotsData(activeBots.map(b => b.toJSON()));
    res.json({
        message: `Hoàn tất! Đã tạo ${totalPostsCreated} bài viết.`,
        totalPosts: totalPostsCreated,
        totalLikes,
        totalComments,
        postIds: createdPostIds.map(p => p.postId)
    });
});

// 4. Hành động: Random tương tác (Random actions)
app.post('/api/actions/random', async (req, res) => {
    const { targetUsernames, targetPostIds, times } = req.body; // mảng username, mảng postId, số lần lặp
    
    for (let i = 0; i < times; i++) {
        // Mỗi bot thực hiện 1 hành động ngẫu nhiên
        for (const bot of activeBots) {
            // Tỉ lệ 30% bot sẽ làm gì đó mỗi vòng
            if (Math.random() < 0.3) {
                await bot.doRandomInteraction(targetUsernames || [], targetPostIds || []);
            }
        }
    }
    saveBotsData(activeBots.map(b => b.toJSON()));
    res.json({ message: `Đã chạy xong ${times} vòng random actions!` });
});

// 5. Khởi động server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Bot Manager UI đang chạy tại: http://localhost:${PORT}`);
    initializeBots(); // Chạy khởi tạo bot sau khi server đã mở
});
