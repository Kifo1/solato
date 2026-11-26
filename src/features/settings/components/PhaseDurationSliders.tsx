import { useEffect, useState } from 'react';
import { AlertCircle, Coffee, LucideIcon, Sofa, Timer } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { CustomSlider } from '@shared/components/Slider';
import { cn, getErrorMessage } from '@shared/lib/utils';

type DurationKey = 'focus_duration' | 'short_break' | 'long_break';
type AccentColor = 'amber' | 'teal' | 'sky';

interface SliderComponentProps {
  title: string;
  description: string;
  Icon: LucideIcon;
  settingsKey: DurationKey;
  accentColor: AccentColor;
  min: number;
  max: number;
  step: number;
}

const ACCENT_UI: Record<
  AccentColor,
  { iconContainer: string; badge: string }
> = {
  amber: {
    iconContainer: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    badge: 'border-amber-500/25 bg-amber-500/12 text-amber-300',
  },
  teal: {
    iconContainer: 'border-teal-400/20 bg-teal-400/10 text-teal-300',
    badge: 'border-teal-400/25 bg-teal-400/12 text-teal-300',
  },
  sky: {
    iconContainer: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    badge: 'border-sky-400/25 bg-sky-400/12 text-sky-300',
  },
};

function generateMarks(min: number, max: number, step: number) {
  const marks: { value: number; label: string }[] = [];
  for (let i = min; i <= max; i += step) {
    marks.push({ value: i, label: `${i}` });
  }
  return marks;
}

function SliderComponent({
  title,
  description,
  Icon,
  settingsKey,
  accentColor,
  min,
  max,
  step,
}: Readonly<SliderComponentProps>) {
  const { settings, updateSingleSetting } = useSettings();
  const [localValue, setLocalValue] = useState<number>(settings?.[settingsKey] ?? min);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setLocalValue(settings[settingsKey]);
    }
  }, [settings, settingsKey]);

  const handleLiveChange = (val: number) => {
    setLocalValue(val);
    if (saveError) setSaveError(null);
  };

  const handleFinalChange = async (val: number) => {
    if (!settings || val === settings[settingsKey]) return;
    try {
      setSaveError(null);
      await updateSingleSetting({ [settingsKey]: val });
    } catch (err) {
      setLocalValue(settings[settingsKey]);
      setSaveError(getErrorMessage(err, 'Failed to save duration.'));
    }
  };

  const styles = ACCENT_UI[accentColor];

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
              styles.iconContainer,
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#F4F5F7]">{title}</p>
            <p className="mt-0.5 text-xs text-[#9CA3B0]">{description}</p>
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums',
            styles.badge,
          )}
        >
          {localValue} min
        </span>
      </div>

      <div className="px-1">
        <CustomSlider
          value={localValue}
          onChange={handleLiveChange}
          onChangeCommitted={handleFinalChange}
          step={step}
          min={min}
          max={max}
          marks={generateMarks(min, max, step)}
          accentColor={accentColor}
          ariaLabel={title}
          valueLabelFormat={(value) => `${value}m`}
        />
      </div>

      {saveError && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}

export default function PhaseDurationSliders() {
  const { settings } = useSettings();

  if (!settings) return null;

  return (
    <div className="surface-card divide-y divide-white/[0.06] rounded-2xl">
      <SliderComponent
        title="Focus Duration"
        description="Length of a single focused work session"
        Icon={Timer}
        settingsKey="focus_duration"
        accentColor="amber"
        min={5}
        max={60}
        step={5}
      />
      <SliderComponent
        title="Short Break"
        description="Quick recovery pause between work intervals"
        Icon={Coffee}
        settingsKey="short_break"
        accentColor="teal"
        min={5}
        max={15}
        step={1}
      />
      <SliderComponent
        title="Long Break"
        description="Extended rest after a full Pomodoro cycle"
        Icon={Sofa}
        settingsKey="long_break"
        accentColor="sky"
        min={5}
        max={30}
        step={5}
      />
    </div>
  );
}
