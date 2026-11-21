import Button from '@/shared/components/Button';
import { TextInput } from '@/shared/components/TextInput';
import { Folder } from '@/shared/lib/models/project';
import Modal from '@shared/components/Modal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import React, { useState } from 'react';
import { FolderSelect } from './FolderSelect';

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
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectColor, setProjectColor] = useState('#3B82F6');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(defaultFolderId);

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
      setIsModalOpen(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name: projectName,
      description: projectDescription,
      color: projectColor,
      folderId: selectedFolderId,
    });
  };

  return (
    <Modal variant={'default'} scale={'md'} isOpen={isModalOpen} setIsOpen={setIsModalOpen}>
      <form onSubmit={handleSubmit}>
        <fieldset className="flex flex-col items-center gap-5">
          <legend className="pb-10 text-4xl font-semibold text-white">Create Project</legend>
          <p className="grid w-full grid-cols-3 justify-between gap-10 text-left">
            <label htmlFor="name" className="col-span-1 text-xl text-white">
              Name
            </label>
            <TextInput
              className="col-span-2"
              type="text"
              name="name"
              id="name"
              placeholder="name"
              required
              minLength={1}
              maxLength={30}
              onChange={(e) => setProjectName(e.target.value)}
            ></TextInput>
          </p>
          <p className="grid w-full grid-cols-3 justify-between gap-10 text-left">
            <label htmlFor="description" className="col-span-1 text-xl text-white">
              Description
            </label>{' '}
            <TextInput
              className="col-span-2"
              type="text"
              name="description"
              id="description"
              placeholder="description"
              required
              minLength={1}
              maxLength={70}
              onChange={(e) => setProjectDescription(e.target.value)}
            ></TextInput>
          </p>
          <div className="grid w-full grid-cols-3 items-center justify-between gap-10 text-left">
            <span className="col-span-1 text-xl text-white">Folder</span>
            <div className="col-span-2">
              <FolderSelect
                folders={folders}
                value={selectedFolderId}
                onChange={setSelectedFolderId}
                emptyLabel="No folder"
                variant="form"
                ariaLabel="Project folder"
              />
            </div>
          </div>
          <p className="grid w-full grid-cols-3 justify-between gap-10 text-left">
            <label htmlFor="color" className="col-span-1 text-xl text-white">
              Color
            </label>
            <input
              className="col-span-2 h-full w-full cursor-pointer"
              type="color"
              name="color"
              id="color"
              defaultValue="#3B82F6"
              required
              onChange={(e) => setProjectColor(e.target.value)}
            ></input>
          </p>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Project'}
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
