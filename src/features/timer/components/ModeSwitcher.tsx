import Button from '@shared/components/Button';

interface Props {
  currentMode: 'pomodoro' | 'stopwatch';
  onSwitch: any;
}

export function ModeSwitcher({ currentMode, onSwitch }: Readonly<Props>) {
  return (
    <div className="flex w-fit justify-center gap-2 rounded-full bg-slate-800 p-1">
      <Button
        variant={currentMode === 'stopwatch' ? 'secondary' : 'ghost'}
        scale={'sm'}
        onClick={() => onSwitch('stopwatch')}
      >
        Stopwatch
      </Button>
      <Button
        variant={currentMode === 'pomodoro' ? 'secondary' : 'ghost'}
        scale={'sm'}
        onClick={() => onSwitch('pomodoro')}
      >
        Pomodoro
      </Button>
    </div>
  );
}
