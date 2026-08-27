'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Player, PlayerPosition } from '@/types';
import { formatCurrency, getPositionBadge } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AddPlayerModal } from '@/components/players/AddPlayerModal';
import staticPlayersData from '@/data/players.json';
import {
  Users,
  Search,
  Plus,
  Shield,
  Flag,
  Sparkles,
  RefreshCw,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PlayersPage() {
  const { user } = useAuth();
  const [dbPlayers, setDbPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [clubFilter, setClubFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'rating_desc' | 'price_desc' | 'name_asc'>('rating_desc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch from DB if available, fallback to static mapped JSON
  const fetchDbPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/players?limit=100');
      const data = res.data?.data || res.data;
      if (data.players && data.players.length > 0) {
        setDbPlayers(data.players);
      }
    } catch {
      // Graceful fallback to static mapped dataset
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDbPlayers();
  }, [fetchDbPlayers]);

  const allPlayers: Player[] = useMemo(() => {
    // If DB has custom players, merge or prioritize DB, otherwise use static mapped dataset
    if (dbPlayers.length > 0) {
      const dbMap = new Map(dbPlayers.map((p) => [p.name.toLowerCase(), p]));
      const merged = [...dbPlayers];
      for (const sp of staticPlayersData as Player[]) {
        if (!dbMap.has(sp.name.toLowerCase())) {
          merged.push(sp);
        }
      }
      return merged;
    }
    return staticPlayersData as Player[];
  }, [dbPlayers]);

  // Extract unique clubs
  const clubs = useMemo(() => {
    const set = new Set<string>();
    allPlayers.forEach((p) => {
      if (p.club) set.add(p.club);
    });
    return Array.from(set).sort();
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    return allPlayers
      .filter((player) => {
        const matchesSearch =
          player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (player.fullName && player.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          player.club.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (player.nationality && player.nationality.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesPos = positionFilter === 'ALL' || player.position === positionFilter;
        const matchesClub = clubFilter === 'ALL' || player.club === clubFilter;

        return matchesSearch && matchesPos && matchesClub;
      })
      .sort((a, b) => {
        if (sortBy === 'rating_desc') return b.rating - a.rating;
        if (sortBy === 'price_desc') return b.basePrice - a.basePrice;
        return a.name.localeCompare(b.name);
      });
  }, [allPlayers, searchTerm, positionFilter, clubFilter, sortBy]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Premier League Player Catalogue
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Official 2026–27 roster with {allPlayers.length} verified players across all 20 clubs.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Custom Player
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-arena-900/80 border border-arena-800 p-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              placeholder="Search by player name, club, or country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Club Dropdown */}
          <div className="w-full sm:w-auto">
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="w-full sm:w-48 bg-arena-950 border border-arena-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="ALL">All Clubs ({clubs.length})</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full sm:w-44 bg-arena-950 border border-arena-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="rating_desc">Highest Rating (OVR)</option>
              <option value="price_desc">Highest Base Price</option>
              <option value="name_asc">Player Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Position Pill Filters */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-arena-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  positionFilter === pos
                    ? 'bg-emerald-500 text-arena-950 shadow-md shadow-emerald-500/20'
                    : 'bg-arena-950 text-slate-400 hover:text-slate-200 border border-arena-800'
                }`}
              >
                {pos === 'ALL' ? 'All Positions' : pos}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-500 shrink-0">
            Showing <strong className="text-emerald-400">{filteredPlayers.length}</strong> Players
          </span>
        </div>
      </div>

      {/* Players Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : filteredPlayers.length === 0 ? (
        <Card variant="glass" className="text-center p-12 space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No Players Found</h3>
          <p className="text-xs text-slate-500">
            No player entries matched your search criteria or club/position filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPlayers.map((player, idx) => {
            const pos = getPositionBadge(player.position);

            return (
              <Card
                key={player._id || player.externalId || idx}
                variant="default"
                className="hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all p-4 space-y-3 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Meta Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${pos.bg}`}>
                      {pos.abbr} • {pos.label}
                    </span>
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-black">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{player.rating}</span>
                    </div>
                  </div>

                  {/* Photo & Name */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-16 rounded-xl bg-arena-950/80 border border-arena-800 flex items-center justify-center overflow-hidden shrink-0">
                      {player.image || player.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.image || player.imageUrl}
                          alt={player.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-base font-bold text-slate-400">
                          {player.name.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {player.name}
                      </h3>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                        {player.clubLogo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={player.clubLogo} alt="" className="w-3 h-3 object-contain shrink-0" />
                        )}
                        <span className="truncate">{player.club}</span>
                      </div>
                      {player.nationality && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                          <Flag className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{player.nationality}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-arena-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Base Starting
                  </span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {formatCurrency(player.basePrice)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Player Modal */}
      <AddPlayerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPlayerCreated={fetchDbPlayers}
      />
    </div>
  );
}
