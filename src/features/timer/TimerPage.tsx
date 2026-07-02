import { PresenceState, usePresence } from '@shared/hooks/usePresence.tsx';
import Timer from '@features/timer/Timer.tsx';

export default function TimerPage() {
  const { updatePresence } = usePresence();
  updatePresence(PresenceState.Idle); //Update presence on App statup
  return <Timer />;
}
