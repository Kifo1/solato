import Button from '@/shared/components/Button';
import { TextInput } from '@/shared/components/TextInput';
import { Folder, getDescendantFolderIds } from '@/shared/lib/models/project';
import Modal from '@shared/components/Modal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import React, { useMemo, useState } from 'react';
import { FolderSelect } from './FolderSelect';

const PRESET_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

interface FolderModalProps {
  folder?: Folder | null;
  defaultParentId?: string | null;
  isModalOpen: boolean;
  setIsModalOpen: (val: boolean) => void;
}

export function FolderModal({
  folder = null,
  defaultParentId = null,
  isModalOpen,
  setIsModalOpen,
}: Readonly<FolderModalProps>) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(folder);

  const [folderName, setFolderName] = useState(folder?.name ?? '');
  const [folderColor, setFolderColor] = useState(folder?.color ?? '#3B82F6');
  const [parentId, setParentId] = useState<string | null>(
    folder?.parent_id ?? defaultParentId ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => invoke<Folder[]>('get_folders'),
  });

  const excludedParentIds = useMemo(
    () => (folder ? getDescendantFolderIds(folder.id, folders) : undefined),
    [folders, folder],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (folder) {
        return invoke('update_folder', {
          id: folder.id,
          name: folderName,
          color: folderColor,
          parentId,
        });
      }
      return invoke<string>('create_folder', {
        name: folderName,
        color: folderColor,
        parentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['timer_projects'] });
      setIsModalOpen(false);
    },
    onError: (err) => {
      setErrorMessage(String(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    mutation.mutate();
  };

  return (
    <Modal variant="default" scale="md" isOpen={isModalOpen} setIsOpen={setIsModalOpen}>
      <form onSubmit={handleSubmit} className="w-full">
        <fieldset className="flex flex-col items-center gap-5">
          <legend className="pb-6 text-3xl font-semibold text-white">
            {isEditing ? 'Edit Folder' : 'Create Folder'}
          </legend>

          {errorMessage && (
            <div className="w-full rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-left text-xs text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="grid w-full grid-cols-3 items-center gap-6 text-left">
            <label htmlFor="folder-name" className="col-span-1 text-lg text-white">
              Name
            </label>
            <TextInput
              className="col-span-2"
              type="text"
              name="folder-name"
              id="folder-name"
              placeholder="e.g. University, Semester 4"
              required
              minLength={1}
              maxLength={30}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
          </div>

          <div className="grid w-full grid-cols-3 items-center gap-6 text-left">
            <span className="col-span-1 text-lg text-white">Parent</span>
            <div className="col-span-2">
              <FolderSelect
                folders={folders}
                value={parentId}
                onChange={setParentId}
                excludeIds={excludedParentIds}
                emptyLabel="None (Top-level)"
                variant="form"
                ariaLabel="Parent folder"
              />
            </div>
          </div>

          <div className="grid w-full grid-cols-3 items-start gap-6 text-left">
            <label htmlFor="folder-color" className="col-span-1 pt-1 text-lg text-white">
              Color
            </label>
            <div className="col-span-2 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Select color ${preset}`}
                    onClick={() => setFolderColor(preset)}
                    className={`h-6 w-6 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 ${
                      folderColor.toLowerCase() === preset.toLowerCase()
                        ? 'scale-110 border-white'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
              <input
                className="h-9 w-full cursor-pointer rounded bg-transparent"
                type="color"
                name="folder-color"
                id="folder-color"
                value={folderColor}
                required
                onChange={(e) => setFolderColor(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={mutation.isPending} className="mt-2">
            {mutation.isPending
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
                ? 'Save Folder'
                : 'Create Folder'}
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
