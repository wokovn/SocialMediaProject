import authRedis from "./auth.redis.js";
import { supabase } from "./supabase.js";
import db from "../db/db.js";
import users from "../db/schemas/users.schema.js";
import { eq, or } from "drizzle-orm";

const AuthService = {
    login: async (identifier, password) => {
        let email = identifier;

        // Check if identifier is an email
        const isEmail = identifier.includes('@');

        if (!isEmail) {
            // Find user by username
            const [user] = await db.select()
                .from(users)
                .where(eq(users.username, identifier))
                .limit(1);

            if (!user) {
                throw new Error('User not found');
            }
            email = user.email;
        }

        // Sign in with Supabase (v1 method)
        const { user, session, error } = await supabase.auth.signIn({
            email,
            password
        });

        if (error) throw error;

        return { user, session };
    },


    logout: async (token) => {
        if (!token) {
            throw new Error('Token is required for logout');
        }

        await authRedis.blacklistToken(token);
        return { success: true };
    },

}
export default AuthService;