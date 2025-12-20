'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { Button } from './Button';
import { Trophy, Users, Shield, LogOut, Radio, LogIn } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

  // Contextual My Squad link: if inside a room, link to that room's squad; else link to all squads history
  const roomMatch = pathname?.match(/\/rooms\/([A-Za-z0-9]+)/);
  const currentRoomCode = roomMatch ? roomMatch[1] : null;
  const mySquadHref = currentRoomCode ? `/rooms/${currentRoomCode}/squad` : '/squads';
  const isMySquadActive = Boolean(pathname?.startsWith('/squads') || pathname?.includes('/squad'));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-arena-800/80 bg-arena-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pitch-700 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
            <div className="w-full h-full bg-arena-950 rounded-[10px] flex items-center justify-center">
              <Trophy className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
              FOOTBALL AUCTION
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PRO
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        {!isAuthPage && (
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors ${
                pathname === '/'
                  ? 'bg-arena-800 text-emerald-400 border border-arena-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-arena-900'
              }`}
            >
              Rooms Hub
            </Link>

            {user && (
              <Link
                href={mySquadHref}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  isMySquadActive
                    ? 'bg-arena-800 text-emerald-400 border border-arena-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-arena-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                My Squad
              </Link>
            )}

            <Link
              href="/players"
              className={`hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors items-center gap-1.5 ${
                pathname === '/players'
                  ? 'bg-arena-800 text-emerald-400 border border-arena-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-arena-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Players
            </Link>
          </nav>
        )}

        {/* User / Socket Status / Auth buttons */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-arena-900 border border-arena-800 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                }`}
              />
              <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-arena-900/90 border border-arena-800 px-3 py-1.5 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-pitch-900 border border-pitch-700/60 flex items-center justify-center text-xs font-bold text-emerald-400">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-200 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    {user.role === 'ADMIN' && <Shield className="w-2.5 h-2.5 text-amber-400" />}
                    {user.email}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                title="Log out"
                className="text-slate-400 hover:text-rose-400"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            !isAuthPage && (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    <LogIn className="w-4 h-4 mr-1.5" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
