import { useTimer } from "./hooks/useTimer.js";
import { TimerDisplay } from "./components/TimerDisplay.js";
import { ModeSwitcher } from "./components/ModeSwitcher.js";
import { TimerControls } from "./components/TimerControls.js";
import { TimerProjectDropdown } from "./components/TimerProject.js";

export default function Timer() {
  const {
    stopwatchMillis,
    pomodoroMillis,
    isRunning,
    mode,
    pomodoroPhase,
    selectedProject,
    start,
    stop,
    reset,
    switchMode,
    switchSelectedProject,
  } = useTimer();

  return (
    <div className="flex flex-col h-full gap-5 items-center">
      <ModeSwitcher currentMode={mode} onSwitch={switchMode} />

      <div className="h-100 w-100 grid grid-rows-[2fr_1fr]">
        <TimerDisplay
          millis={mode === "stopwatch" ? stopwatchMillis : pomodoroMillis}
          mode={mode}
          pomodoroPhase={pomodoroPhase}
          isRunning={isRunning}
        ></TimerDisplay>
      </div>

      <TimerControls
        isRunning={isRunning}
        onStartStop={isRunning ? stop : start}
        onReset={reset}
      />
      <TimerProjectDropdown
        currentProject={selectedProject}
        switchCurrentProject={switchSelectedProject}
      ></TimerProjectDropdown>
    </div>
  );
}
