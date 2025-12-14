'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { KeyRound, Shield, LogIn } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export function JoinRoomModal({ isOpen, onClose, initialCode = '' }: JoinRoomModalProps) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState(initialCode);
  const [teamName, setTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      toast.error('Please enter a room code');
      return;
    }
    if (!teamName.trim()) {
      toast.error('Please enter your team name');
      return;
    }

    try {
      setIsLoading(true);
      const code = roomCode.trim().toUpperCase();
      await api.post(`/rooms/${code}/join`, {
        teamName: teamName.trim(),
      });

      toast.success(`Joined room ${code} successfully!`);
      onClose();
      router.push(`/rooms/${code}`);
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
      title="Join Auction Room"
      description="Enter the 6-character room code and your team manager name to join the draft."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Room Code"
          placeholder="e.g. AB12CD"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          required
          maxLength={10}
          leftIcon={<KeyRound className="w-4 h-4" />}
        />

        <Input
          label="Your Manager / Team Name"
          placeholder="e.g. Galacticos XI"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          required
          leftIcon={<Shield className="w-4 h-4" />}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-arena-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            <LogIn className="w-4 h-4 mr-1.5" />
            Join Room
          </Button>
        </div>
      </form>
    </Modal>
  );
}
