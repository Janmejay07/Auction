import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

  if (!socket || !socket.connected) {
    socket = io(SOCKET_URL, {
      auth: {
        token: activeToken ? `Bearer ${activeToken}` : '',
      },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
