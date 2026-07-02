import { PresenceState, usePresence } from '@/shared/hooks/usePresence';
import Timer from '@features/timer/Timer';

export default function TimerPage() {
  const { updatePresence } = usePresence();
  updatePresence(PresenceState.Idle); //Update presence on App statup
  return <Timer />;
}
