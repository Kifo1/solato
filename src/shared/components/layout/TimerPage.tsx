import { PresenceState, updatePresence } from '@/shared/lib/discord';
import Timer from '@features/timer/Timer';

export default function TimerPage() {
  updatePresence(PresenceState.Idle); //Update presence on App statup
  return <Timer />;
}
