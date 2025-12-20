'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import type { User } from '@/types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  register: (data: { email: string; password: string; name: string }) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (jwtToken: string) => {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const userData = response.data?.data?.user || response.data?.data;
      if (userData) {
        setUser({
          id: userData.id || userData._id,
          email: userData.email,
          name: userData.name,
          role: userData.role || 'USER',
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        });
      }
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchCurrentUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [fetchCurrentUser]);

  const login = async (credentials: { email: string; password: string }): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await api.post('/auth/login', credentials);
      const data = res.data?.data || res.data;
      const newToken = data.token;
      const newUser = data.user;

      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser({
        id: newUser.id || newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role || 'USER',
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      });

      toast.success(`Welcome back, ${newUser.name}!`);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; name: string }): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await api.post('/auth/register', data);
      const responseData = res.data?.data || res.data;
      const newToken = responseData.token;
      const newUser = responseData.user;

      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser({
        id: newUser.id || newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role || 'USER',
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      });

      toast.success(`Account created! Welcome to Football Auction, ${newUser.name}`);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    disconnectSocket();
    toast.info('Logged out successfully');
  };

  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
