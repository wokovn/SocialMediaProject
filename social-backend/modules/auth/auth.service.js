import redisService from "../redis/redis.service.js";

const AuthService = {

    logout: async (token) => {
        
        try {
            const result = await redisService.setBlacklist(token);
            return result;
        } catch (error) {
            return { error: error.message };
        }
    },

}
export default AuthService;