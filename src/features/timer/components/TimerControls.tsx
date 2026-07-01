import Button from '@shared/components/Button';
import { Pause, Play, TimerReset } from 'lucide-react';

interface Props {
  isRunning: boolean;
  onStartStop: () => void;
  onReset: () => void;
}

export function TimerControls({ isRunning, onStartStop, onReset }: Readonly<Props>) {
  return (
    <div className="flex w-full justify-center gap-4">
      <Button onClick={onStartStop}>
        {isRunning ? <Pause /> : <Play />}
        {isRunning ? 'Stop' : 'Start'} timer
      </Button>
      <Button onClick={onReset}>
        <TimerReset />
      </Button>
    </div>
  );
}
