import Button from '@shared/components/Button';
import { ChartLine, CirclePlus, LucideIcon, Plus, Timer } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';

interface TutorialStepProps {
  position: number;
  title: string;
  description: string;
  Icon: LucideIcon;
  highlighted: boolean;
  setIsModalOpen: any;
}

function TutorialStep({
  position,
  title,
  description,
  Icon,
  highlighted,
  setIsModalOpen,
}: Readonly<TutorialStepProps>) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
      <div className="flex">
        <div
          className={`${highlighted ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-700 text-white'} mt-2 rounded-2xl p-4`}
        >
          <Icon></Icon>
        </div>
        <span className="ml-auto text-6xl font-bold text-slate-700 opacity-50 hover:opacity-80">
          {position}
        </span>
      </div>
      <div className="flex flex-col gap-3 pt-5">
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
        <p className="font-light text-blue-200 opacity-70">{description}</p>
        {highlighted && (
          <Button onClick={() => setIsModalOpen(true)} className="rounded-md font-medium">
            <Plus />
            Add Project
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FirstProjectTutorial() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="mt-30 justify-center text-center">
        <h2 className="text-4xl font-semibold text-white">No projects found</h2>
        <p className="mr-auto ml-auto max-w-150 text-blue-200">
          Get started in three simple steps. Create your first project to begin tracking your
          productivity journey.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-10 pt-15 pr-15 pl-15 lg:grid-cols-2 xl:grid-cols-3">
        <TutorialStep
          position={1}
          title="Create a Project"
          description="Set up a new workspace for your tasks and give it a name."
          Icon={CirclePlus}
          highlighted={true}
          setIsModalOpen={setIsModalOpen}
        />
        <TutorialStep
          position={2}
          title="Start the Timer"
          description="Select your project and hit play. Use Pomodoro intervals to stay focused."
          Icon={Timer}
          highlighted={false}
          setIsModalOpen={setIsModalOpen}
        />
        <TutorialStep
          position={3}
          title="View Progress"
          description="See detailed analytics of your time spent and improve your workflow."
          Icon={ChartLine}
          highlighted={false}
          setIsModalOpen={setIsModalOpen}
        />
      </div>
      <CreateProjectModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      ></CreateProjectModal>
    </>
  );
}
