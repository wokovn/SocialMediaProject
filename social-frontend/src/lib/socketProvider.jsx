import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { supabase } from './supabase.js';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let currentSocket = null;
    let heartbeatInterval = null;

    const initSocket = async (userId) => {
      // Khi để trống, socket.io tự kết nối đến window.location.origin
      // Nginx sẽ proxy /socket.io/ → backend:3000
      const socketUrl = import.meta.env.VITE_BACKEND_URL || undefined;
      
      currentSocket = io(socketUrl, {
        auth: { userId },
        transports: ['websocket'],
      });

      currentSocket.on('connect', () => {
        console.log('Socket connected');
        const intervalSec = parseInt(import.meta.env.VITE_PRESENCE_HEARTBEAT_INTERVAL || '30', 10);
        
        heartbeatInterval = setInterval(() => {
          if (currentSocket.connected) {
            currentSocket.emit('presence_heartbeat', { userId });
          }
        }, intervalSec * 1000);
      });

      currentSocket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      setSocket(currentSocket);
    };

    const setupAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            initSocket(session.user.id);
        }
    };
    
    setupAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        if (!currentSocket && session?.user?.id) {
          initSocket(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        if (currentSocket) {
          currentSocket.disconnect();
          currentSocket = null;
          setSocket(null);
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      }
    });

    return () => {
      if (currentSocket) {
        currentSocket.disconnect();
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (authListener?.subscription) {
          authListener.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
