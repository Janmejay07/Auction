'use client';

import React, { useState } from 'react';
import { api, getErrorMessage } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { UserPlus, Shield, Flag, DollarSign, Award } from 'lucide-react';
import type { PlayerPosition } from '@/types';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayerCreated: () => void;
}

export function AddPlayerModal({ isOpen, onClose, onPlayerCreated }: AddPlayerModalProps) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('FWD');
  const [club, setClub] = useState('');
  const [nationality, setNationality] = useState('');
  const [rating, setRating] = useState('85');
  const [basePrice, setBasePrice] = useState('2000000');
  const [age, setAge] = useState('25');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !club.trim() || !nationality.trim()) {
      toast.error('Please fill in all required player fields');
      return;
    }

    try {
      setIsLoading(true);
      await api.post('/players', {
        name: name.trim(),
        position,
        club: club.trim(),
        nationality: nationality.trim(),
        rating: Number(rating),
        basePrice: Number(basePrice),
        age: Number(age),
      });

      toast.success(`Player ${name} added to global catalogue!`);
      onPlayerCreated();
      onClose();
      // Reset form
      setName('');
      setClub('');
      setNationality('');
      setRating('85');
      setBasePrice('2000000');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Football Player"
      description="Add a player to the master football catalogue (Admin privileges required)."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Player Full Name"
          placeholder="e.g. Erling Haaland"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Field Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as PlayerPosition)}
              className="w-full bg-arena-900 border border-arena-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              <option value="GK">Goalkeeper (GK)</option>
              <option value="DEF">Defender (DEF)</option>
              <option value="MID">Midfielder (MID)</option>
              <option value="FWD">Forward / Striker (FWD)</option>
            </select>
          </div>

          <Input
            label="Overall Rating (OVR)"
            type="number"
            min={50}
            max={99}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            required
            leftIcon={<Award className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Current Club"
            placeholder="e.g. Real Madrid"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            required
            leftIcon={<Shield className="w-4 h-4" />}
          />

          <Input
            label="Nationality"
            placeholder="e.g. Norway"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            required
            leftIcon={<Flag className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Base Starting Price (₹)"
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
            leftIcon={<DollarSign className="w-4 h-4" />}
          />

          <Input
            label="Player Age"
            type="number"
            min={15}
            max={45}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-arena-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add to Catalogue
          </Button>
        </div>
      </form>
    </Modal>
  );
}
