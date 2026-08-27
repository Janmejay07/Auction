'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomCode: string) => Promise<{ ok: boolean; error?: { message?: string } }>;
  leaveRoom: (roomCode: string) => Promise<{ ok: boolean; error?: { message?: string } }>;
  setReady: (roomCode: string, isReady: boolean) => Promise<{ ok: boolean; data?: unknown; error?: { message?: string } }>;
  syncRoom: (roomCode: string) => Promise<{ ok: boolean; data?: unknown; error?: { message?: string } }>;
  placeBid: (roomCode: string, amount: number, clientBidId: string) => Promise<{ ok: boolean; data?: unknown; error?: { message?: string } }>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (token && user) {
      const s = getSocket(token);

      const onConnect = () => {
        setIsConnected(true);
      };

      const onDisconnect = () => {
        setIsConnected(false);
      };

      const onConnectError = (err: Error) => {
        setIsConnected(false);
        console.error('Socket connection error:', err.message);
      };

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('connect_error', onConnectError);

      if (!s.connected) {
        s.connect();
      }

      setSocket(s);

      return () => {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        s.off('connect_error', onConnectError);
      };
    } else {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    }
  }, [token, user]);

  const joinRoom = useCallback(
    async (roomCode: string): Promise<{ ok: boolean; error?: { message?: string } }> => {
      return new Promise((resolve) => {
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: { message: 'Socket is not connected' } });
          return;
        }

        socket.emit('room:join', { roomCode }, (response: { ok: boolean; error?: { message?: string } }) => {
          if (!response.ok) {
            toast.error(response.error?.message || 'Failed to join auction room');
          }
          resolve(response);
        });
      });
    },
    [socket]
  );

  const leaveRoom = useCallback(
    async (roomCode: string): Promise<{ ok: boolean; error?: { message?: string } }> => {
      return new Promise((resolve) => {
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: { message: 'Socket is not connected' } });
          return;
        }

        socket.emit('room:leave', { roomCode }, (response: { ok: boolean; error?: { message?: string } }) => {
          resolve(response || { ok: true });
        });
      });
    },
    [socket]
  );

  const setReady = useCallback(
    async (
      roomCode: string,
      isReady: boolean
    ): Promise<{ ok: boolean; data?: unknown; error?: { message?: string } }> => {
      return new Promise((resolve) => {
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: { message: 'Socket is not connected' } });
          return;
        }

        socket.emit('room:ready', { roomCode, isReady }, (response: { ok: boolean; data?: unknown; error?: { message?: string } }) => {
          resolve(response || { ok: true });
        });
      });
    },
    [socket]
  );

  const syncRoom = useCallback(
    async (roomCode: string): Promise<{ ok: boolean; data?: unknown; error?: { message?: string } }> => {
      return new Promise((resolve) => {
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: { message: 'Socket is not connected' } });
          return;
        }

        socket.emit('room:sync', { roomCode }, (response: { ok: boolean; data?: unknown; error?: { message?: string } }) => {
          resolve(response);
        });
      });
    },
    [socket]
  );

  const placeBid = useCallback(
    async (
      roomCode: string,
      amount: number,
      clientBidId: string
    ): Promise<{ ok: boolean; data?: unknown; error?: { message?: string } }> => {
      return new Promise((resolve) => {
        if (!socket || !socket.connected) {
          resolve({ ok: false, error: { message: 'Socket is not connected' } });
          return;
        }

        socket.emit(
          'bid:place',
          { roomCode, amount, clientBidId },
          (response: { ok: boolean; data?: unknown; error?: { message?: string } }) => {
            resolve(response);
          }
        );
      });
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinRoom,
        leaveRoom,
        setReady,
        syncRoom,
        placeBid,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
