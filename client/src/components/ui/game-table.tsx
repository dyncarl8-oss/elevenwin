import React from 'react';
import { cn } from '@/lib/utils';

interface GameTableProps {
  children?: React.ReactNode;
  className?: string;
  centerContent?: React.ReactNode;
  playerPositions?: Array<{
    id: string;
    position: 'bottom' | 'left' | 'top' | 'right' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    content: React.ReactNode;
  }>;
}

const GameTable: React.FC<GameTableProps> = ({
  children,
  className,
  centerContent,
  playerPositions = []
}) => {
  return (
    <div className={cn('relative w-full h-full min-h-[600px] p-8', className)}>
      {/* Table Background with Neon Cyan Edge */}
      <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/15 to-primary/10 shadow-2xl">
        {/* Table Edge with 3D Effect - Neon Horizon */}
        <div className="absolute inset-0 rounded-3xl border-8 border-primary/40 bg-gradient-to-br from-primary/30 to-secondary/30 shadow-lg">
          {/* Inner Table Surface - Dark Surface */}
          <div className="absolute inset-6 rounded-2xl bg-gradient-to-br from-muted via-card to-background shadow-inner">
            {/* Subtle Texture Overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent backdrop-blur-[0.5px]">
              {/* Subtle Pattern Effect */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-10"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,182,255,0.4) 1px, transparent 0)`,
                  backgroundSize: '20px 20px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Center Content Area */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center justify-center">
            {centerContent}
          </div>
        </div>
      </div>

      {/* Player Positions */}
      {playerPositions.map((player) => {
        const positionClasses = {
          bottom: 'bottom-4 left-1/2 transform -translate-x-1/2',
          top: 'top-4 left-1/2 transform -translate-x-1/2',
          left: 'left-4 top-1/2 transform -translate-y-1/2',
          right: 'right-4 top-1/2 transform -translate-y-1/2',
          'bottom-left': 'bottom-4 left-4',
          'bottom-right': 'bottom-4 right-4',
          'top-left': 'top-4 left-4',
          'top-right': 'top-4 right-4'
        };

        return (
          <div
            key={player.id}
            className={cn(
              'absolute z-10',
              positionClasses[player.position]
            )}
          >
            {player.content}
          </div>
        );
      })}

      {/* Additional Children */}
      {children}
    </div>
  );
};

export default GameTable;