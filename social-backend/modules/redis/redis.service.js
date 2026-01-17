import redisClient from "./redis.config.js";
import jwt from "jsonwebtoken";
const redisService = {
    set: async (key, value) => {
        try {
            await redisClient.set(key, value);
            return { message: 'Value set successfully' };
        } catch (error) {
            return { error: error.message };
        }
    },

    get: async (key) => {
        try {
            const value = await redisClient.get(key);
            return { value };
        } catch (error) {
            return { error: error.message };
        }
    },
    del: async (key) => {
        try {
            await redisClient.del(key);
            return { message: 'Value deleted successfully' };
        } catch (error) {
            return { error: error.message };
        }
    },
    setBlacklist: async (token) => {
        
        try {
            const decoded = jwt.decode(token);
            const expiration = decoded.exp - Math.floor(Date.now() / 1000);
            await redisClient.set("jwt:blacklist:" + token, 'blacklisted', 'EX', expiration);
            return { message: 'Token blacklisted successfully' };
        } catch (error) {
            return { error: error.message };
        }
    },
    isBlacklisted: async (token) => {
        try {
            const result = await redisClient.get(token);
            return { blacklisted: result === 'blacklisted' };
        } catch (error) {
            return { error: error.message };
        }
    },

}

export default redisService;