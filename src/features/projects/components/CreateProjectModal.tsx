import Button from '@/shared/components/Button';
import { TextInput } from '@/shared/components/TextInput';
import { Folder } from '@/shared/lib/models/project';
import { cn, getErrorMessage } from '@/shared/lib/utils';
import Modal from '@shared/components/Modal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, Check } from 'lucide-react';
import React, { useEffect, useId, useState } from 'react';
import { FolderSelect } from './FolderSelect';

const STUDIO_COLOR_SWATCHES = [
  { name: 'Solar Amber', hex: '#F59E0B' },
  { name: 'Coral', hex: '#F97316' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Sky', hex: '#38BDF8' },
  { name: 'Cobalt', hex: '#3B82F6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Lavender', hex: '#A78BFA' },
  { name: 'Slate', hex: '#94A3B8' },
] as const;

const DEFAULT_PROJECT_COLOR = '#F59E0B';

interface CreateProjectModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (val: boolean) => void;
  defaultFolderId?: string | null;
}

export function CreateProjectModal({
  isModalOpen,
  setIsModalOpen,
  defaultFolderId = null,
}: Readonly<CreateProjectModalProps>) {
  const queryClient = useQueryClient();
  const uid = useId();
  const nameInputId = `${uid}-name`;
  const descriptionInputId = `${uid}-description`;
  const colorInputId = `${uid}-color`;

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectColor, setProjectColor] = useState(DEFAULT_PROJECT_COLOR);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(defaultFolderId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
  });

  const mutation = useMutation({
    mutationFn: (newProject: {
      name: string;
      description: string;
      color: string;
      folderId: string | null;
    }) => invoke('create_project', newProject),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['localSelectedProjects'] });
      setIsModalOpen(false);
    },
    onError: (err) => {
      setErrorMessage(getErrorMessage(err, 'Failed to create project.'));
    },
  });

  useEffect(() => {
    if (isModalOpen) {
      setProjectName('');
      setProjectDescription('');
      setProjectColor(DEFAULT_PROJECT_COLOR);
      setSelectedFolderId(defaultFolderId);
      setErrorMessage(null);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, defaultFolderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = projectName.trim();
    const trimmedDescription = projectDescription.trim();

    if (!trimmedName) {
      setErrorMessage('Please enter a project name.');
      return;
    }
    if (!trimmedDescription) {
      setErrorMessage('Please enter a short description.');
      return;
    }

    setErrorMessage(null);
    mutation.mutate({
      name: trimmedName,
      description: trimmedDescription,
      color: projectColor,
      folderId: selectedFolderId,
    });
  };

  return (
    <Modal variant="default" scale="md" isOpen={isModalOpen} setIsOpen={setIsModalOpen}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="pr-8">
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/10"
              style={{ backgroundColor: projectColor }}
            />
            <h2 className="text-xl font-semibold tracking-tight text-[#F4F5F7]">New Project</h2>
          </div>
          <p className="mt-1 text-xs text-[#9CA3B0]">
            Create a workspace to organize focus sessions and track time.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={nameInputId} className="text-xs font-medium text-[#D1D5DE]">
                Project Name
              </label>
              <span className="font-mono text-[11px] text-[#646C7A] tabular-nums">
                {projectName.length}/30
              </span>
            </div>
            <TextInput
              id={nameInputId}
              name="name"
              type="text"
              placeholder="e.g. Solato Client, Thesis Research"
              required
              minLength={1}
              maxLength={30}
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={descriptionInputId} className="text-xs font-medium text-[#D1D5DE]">
                Description
              </label>
              <span className="font-mono text-[11px] text-[#646C7A] tabular-nums">
                {projectDescription.length}/70
              </span>
            </div>
            <TextInput
              id={descriptionInputId}
              name="description"
              type="text"
              placeholder="Short note about what you're working on"
              required
              minLength={1}
              maxLength={70}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#D1D5DE]">Folder</span>
            <FolderSelect
              folders={folders}
              value={selectedFolderId}
              onChange={setSelectedFolderId}
              emptyLabel="No folder"
              variant="form"
              ariaLabel="Project folder"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor={colorInputId} className="text-xs font-medium text-[#D1D5DE]">
                Color
              </label>
              <span className="font-mono text-[11px] tracking-wide text-[#9CA3B0] uppercase">
                {projectColor}
              </span>
            </div>
            <div className="surface-well flex flex-wrap items-center gap-2 rounded-xl p-2.5">
              {STUDIO_COLOR_SWATCHES.map((swatch) => {
                const isSelected = projectColor.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    aria-label={`Select ${swatch.name}`}
                    aria-pressed={isSelected}
                    onClick={() => setProjectColor(swatch.hex)}
                    className={cn(
                      'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none',
                      isSelected && 'scale-105 ring-2 ring-white ring-offset-2 ring-offset-[#0F1116]',
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#0A0B0E] stroke-[3]" />}
                  </button>
                );
              })}

              <label
                htmlFor={colorInputId}
                title="Custom color"
                className="ml-auto flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#191D26] px-2 text-[11px] font-medium text-[#9CA3B0] transition-colors hover:border-white/[0.2] hover:text-[#F4F5F7]"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: projectColor }}
                />
                <span>Custom</span>
                <input
                  id={colorInputId}
                  name="color"
                  type="color"
                  value={projectColor}
                  required
                  onChange={(e) => setProjectColor(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2.5 border-t border-white/[0.06] pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsModalOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
