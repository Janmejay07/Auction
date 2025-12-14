'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { Trophy, Shield, Clock, PlusCircle } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [initialPurse, setInitialPurse] = useState('100000000'); // ₹10 Cr
  const [minBidIncrement, setMinBidIncrement] = useState('500000'); // ₹5 Lakh
  const [bidTimerSeconds, setBidTimerSeconds] = useState('15');
  const [maxSquadSize, setMaxSquadSize] = useState('11');
  const [minSquadSize, setMinSquadSize] = useState('5');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      toast.error('Please enter your team name');
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        teamName: teamName.trim(),
        settings: {
          purseTotal: Number(initialPurse),
          bidIncrement: Number(minBidIncrement),
          bidTimerSeconds: Number(bidTimerSeconds),
          squadLimit: Number(maxSquadSize),
        },
      };

      const res = await api.post('/rooms', payload);
      const data = res.data?.data || res.data;
      const roomCode = data.roomCode || data.room?.roomCode;

      toast.success(`Auction room created! Room code: ${roomCode}`);
      onClose();
      router.push(`/rooms/${roomCode}`);
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
      title="Create New Auction Room"
      description="Configure your football auction room parameters and initial purse settings."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Your Manager / Team Name"
          placeholder="e.g. Red Devils FC"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          required
          leftIcon={<Shield className="w-4 h-4" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Total Purse per Team (₹)"
            type="number"
            value={initialPurse}
            onChange={(e) => setInitialPurse(e.target.value)}
            required
            helperText="Default: ₹10 Crore"
          />

          <Input
            label="Minimum Bid Increment (₹)"
            type="number"
            value={minBidIncrement}
            onChange={(e) => setMinBidIncrement(e.target.value)}
            required
            helperText="Default: ₹5 Lakh"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Hammer Timer (Sec)"
            type="number"
            value={bidTimerSeconds}
            onChange={(e) => setBidTimerSeconds(e.target.value)}
            required
            min={5}
            max={60}
            leftIcon={<Clock className="w-4 h-4" />}
          />

          <Input
            label="Min Squad Size"
            type="number"
            value={minSquadSize}
            onChange={(e) => setMinSquadSize(e.target.value)}
            required
            min={1}
            max={25}
          />

          <Input
            label="Max Squad Size"
            type="number"
            value={maxSquadSize}
            onChange={(e) => setMaxSquadSize(e.target.value)}
            required
            min={5}
            max={30}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-arena-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Create Auction Room
          </Button>
        </div>
      </form>
    </Modal>
  );
}
