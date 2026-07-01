interface Props {
  currentPhase: number;
}

export function PomodoroPhases({ currentPhase }: Readonly<Props>) {
  return (
    <div className="mt-auto mb-15 text-center">
      <ul className="flex justify-center gap-2">
        <li className="">
          <span
            className={`${currentPhase === 0 ? 'glow bg-blue-500' : 'bg-gray-700'} inline-block h-2.5 w-2.5 rounded-full`}
          ></span>
        </li>
        <li>
          <span
            className={`${currentPhase === 1 ? 'glow bg-blue-500' : 'bg-gray-700'} inline-block h-2.5 w-2.5 rounded-full`}
          ></span>{' '}
        </li>
        <li>
          <span
            className={`${currentPhase === 2 ? 'glow bg-blue-500' : 'bg-gray-700'} inline-block h-2.5 w-2.5 rounded-full`}
          ></span>{' '}
        </li>
        <li>
          <span
            className={`${currentPhase === 3 ? 'glow bg-blue-500' : 'bg-gray-700'} inline-block h-2.5 w-2.5 rounded-full`}
          ></span>{' '}
        </li>
      </ul>
      <span className="text-sm font-semibold text-gray-500 uppercase">
        {currentPhase === 0 || currentPhase === 2
          ? 'Focus'
          : currentPhase === 1
            ? 'Short Break'
            : 'Long Break'}
      </span>
    </div>
  );
}
