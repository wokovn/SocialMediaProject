import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncBots() {
    console.log("--- ĐANG KÉO DỮ LIỆU BOT TỪ DATABASE ---");
    
    // 1. Lấy tất cả user có username bắt đầu bằng 'bot_' từ bảng public.users
    const { data: publicUsers, error: publicError } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, email')
        .ilike('username', 'bot_%');

    if (publicError) {
        console.error("Lỗi lấy public users:", publicError.message);
        return;
    }

    console.log(`Tìm thấy ${publicUsers.length} tài khoản bot trong database.`);

    // 2. Map sang định dạng của botData.json
    // Lưu ý: Password không lấy được từ DB, nên ta giả định là 'Password123!' 
    // (theo đúng kịch bản tạo bot trước đó)
    const bots = publicUsers.map(user => ({
        email: user.email,
        password: 'Password123!',
        username: user.username,
        fullName: user.full_name,
        accessToken: null,
        userId: user.id,
        following: []
    }));

    // 3. Lưu vào file botData.json
    const botDataPath = path.join(__dirname, 'botData.json');
    fs.writeFileSync(botDataPath, JSON.stringify(bots, null, 2));

    console.log(`--- HOÀN TẤT: Đã cập nhật ${bots.length} bot vào file botData.json ---`);
}

syncBots();
