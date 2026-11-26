import Button from '@shared/components/Button';
import { SolatoLogo } from '@shared/components/SolatoLogo';
import { ChartLine, FolderPlus, LucideIcon, Plus, Timer } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';

interface OnboardingStep {
  number: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
}

const STEPS: OnboardingStep[] = [
  {
    number: '01',
    title: 'Create a Project',
    description: 'Set up a workspace with a name, color, and optional folder to organize your work.',
    Icon: FolderPlus,
    iconBgClass: 'bg-amber-500/12 border-amber-500/20',
    iconColorClass: 'text-amber-400',
  },
  {
    number: '02',
    title: 'Focus with Timer',
    description: 'Select your project and run Pomodoro or stopwatch sessions distraction-free.',
    Icon: Timer,
    iconBgClass: 'bg-teal-500/12 border-teal-500/20',
    iconColorClass: 'text-teal-400',
  },
  {
    number: '03',
    title: 'Explore Insights',
    description: 'Review streaks, daily rhythms, and time distribution across all your projects.',
    Icon: ChartLine,
    iconBgClass: 'bg-sky-500/12 border-sky-500/20',
    iconColorClass: 'text-sky-400',
  },
];

export default function FirstProjectTutorial() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="mx-auto mt-6 w-full max-w-3xl">
      <div className="surface-card rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <SolatoLogo size={48} className="mb-4" />
          <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Start tracking with clarity
          </h2>
          <p className="mt-2 max-w-md text-sm text-fg-secondary">
            Create your first project to organize focus sessions, track daily momentum, and unlock
            studio analytics.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {STEPS.map(({ number, title, description, Icon, iconBgClass, iconColorClass }) => (
            <div
              key={number}
              className="surface-well flex flex-col gap-3 rounded-xl p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${iconBgClass}`}
                >
                  <Icon className={`h-4 w-4 ${iconColorClass}`} />
                </div>
                <span className="font-mono text-xs font-semibold text-fg-muted tabular-nums">
                  {number}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex justify-center">
          <Button variant="primary" scale="lg" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Create your first project
          </Button>
        </div>
      </div>

      {isModalOpen && (
        <CreateProjectModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
      )}
    </div>
  );
}
