package de.kifo.solato.features.sync.service;

import de.kifo.solato.features.sync.dto.*;
import de.kifo.solato.features.sync.model.Folder;
import de.kifo.solato.features.sync.model.Project;
import de.kifo.solato.features.sync.model.Session;
import de.kifo.solato.features.sync.repository.FolderRepository;
import de.kifo.solato.features.sync.repository.ProjectRepository;
import de.kifo.solato.features.sync.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SyncService {

    private final FolderRepository folderRepository;
    private final ProjectRepository projectRepository;
    private final SessionRepository sessionRepository;

    @Transactional
    public SyncResponse processSync(Long userId, SyncRequest request) {
        Instant syncTimestamp = Instant.now().truncatedTo(ChronoUnit.MICROS);
        boolean folderAwareClient = request.folders() != null;

        if (request.folders() != null) {
            request.folders().forEach(dto -> upsertFolder(userId, dto, syncTimestamp));
        }
        if (request.projects() != null) {
            request.projects().forEach(dto -> upsertProject(userId, dto, syncTimestamp, folderAwareClient));
        }
        if (request.sessions() != null) {
            request.sessions().forEach(dto -> upsertSession(userId, dto, syncTimestamp));
        }

        Instant lastSynced = request.lastSyncedAt() != null ? request.lastSyncedAt() : Instant.EPOCH;

        List<FolderSync> dbFolders = folderRepository.findByUserIdAndUpdatedAtAfter(userId, lastSynced)
                .stream()
                .filter(f -> f.getUpdatedAt().isBefore(syncTimestamp))
                .map(this::mapToFolder)
                .toList();

        List<ProjectSync> dbProjects = projectRepository.findByUserIdAndUpdatedAtAfter(userId, lastSynced)
                .stream()
                .filter(p -> p.getUpdatedAt().isBefore(syncTimestamp))
                .map(this::mapToProject)
                .toList();

        List<SessionSync> dbSessions = sessionRepository.findByUserIdAndUpdatedAtAfter(userId, lastSynced)
                .stream()
                .filter(s -> s.getUpdatedAt().isBefore(syncTimestamp))
                .map(this::mapToSession)
                .toList();

        return new SyncResponse(syncTimestamp, dbFolders, dbProjects, dbSessions);
    }

    private void upsertFolder(Long userId, FolderSync dto, Instant syncTimestamp) {
        folderRepository.findById(dto.id()).ifPresentOrElse(
                existing -> {
                    if (existing.getUserId().equals(userId) && dto.updatedAt().isAfter(existing.getUpdatedAt())) {
                        existing.setName(dto.name());
                        existing.setColor(dto.color());
                        existing.setParentId(dto.parentId());
                        existing.setUpdatedAt(syncTimestamp);
                        existing.setDeleted(dto.isDeleted());
                        folderRepository.save(existing);
                    }
                },
                () -> {
                    Folder newFolder = new Folder();
                    newFolder.setId(dto.id());
                    newFolder.setUserId(userId);
                    newFolder.setName(dto.name());
                    newFolder.setColor(dto.color());
                    newFolder.setParentId(dto.parentId());
                    newFolder.setCreatedAt(dto.createdAt());
                    newFolder.setUpdatedAt(syncTimestamp);
                    newFolder.setDeleted(dto.isDeleted());
                    folderRepository.save(newFolder);
                }
        );
    }

    private void upsertProject(Long userId, ProjectSync dto, Instant syncTimestamp, boolean folderAwareClient) {
        projectRepository.findById(dto.id()).ifPresentOrElse(
                existing -> {
                    if (existing.getUserId().equals(userId) && dto.updatedAt().isAfter(existing.getUpdatedAt())) {
                        existing.setName(dto.name());
                        existing.setDescription(dto.description());
                        existing.setColor(dto.color());
                        if (folderAwareClient) {
                            existing.setFolderId(dto.folderId());
                        }
                        existing.setUpdatedAt(syncTimestamp);
                        existing.setDeleted(dto.isDeleted());
                        projectRepository.save(existing);
                    }
                },
                () -> {
                    Project newProject = new Project();
                    newProject.setId(dto.id());
                    newProject.setUserId(userId);
                    newProject.setName(dto.name());
                    newProject.setDescription(dto.description());
                    newProject.setColor(dto.color());
                    newProject.setFolderId(dto.folderId());
                    newProject.setCreatedAt(dto.createdAt());
                    newProject.setUpdatedAt(syncTimestamp);
                    newProject.setDeleted(dto.isDeleted());
                    projectRepository.save(newProject);
                }
        );
    }

    private void upsertSession(Long userId, SessionSync dto, Instant syncTimestamp) {
        sessionRepository.findById(dto.id()).ifPresentOrElse(
                existing -> {
                    if (existing.getUserId().equals(userId) && dto.updatedAt().isAfter(existing.getUpdatedAt())) {
                        existing.setProjectId(dto.projectId());
                        existing.setStartTime(dto.startTime());
                        existing.setEndTime(dto.endTime());
                        existing.setSessionType(dto.sessionType());
                        existing.setMode(dto.mode());
                        existing.setUpdatedAt(syncTimestamp);
                        existing.setDeleted(dto.isDeleted());
                        sessionRepository.save(existing);
                    }
                },
                () -> {
                    Session newSession = new Session();
                    newSession.setId(dto.id());
                    newSession.setUserId(userId);
                    newSession.setProjectId(dto.projectId());
                    newSession.setStartTime(dto.startTime());
                    newSession.setEndTime(dto.endTime());
                    newSession.setSessionType(dto.sessionType());
                    newSession.setMode(dto.mode());
                    newSession.setUpdatedAt(syncTimestamp);
                    newSession.setDeleted(dto.isDeleted());
                    sessionRepository.save(newSession);
                }
        );
    }

    private FolderSync mapToFolder(Folder folder) {
        return new FolderSync(
                folder.getId(),
                folder.getName(),
                folder.getColor(),
                folder.getParentId(),
                folder.getCreatedAt(),
                folder.getUpdatedAt(),
                folder.isDeleted()
        );
    }

    private ProjectSync mapToProject(Project project) {
        return new ProjectSync(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getColor(),
                project.getFolderId(),
                project.getCreatedAt(),
                project.getUpdatedAt(),
                project.isDeleted()
        );
    }

    private SessionSync mapToSession(Session session) {
        return new SessionSync(
                session.getId(),
                session.getProjectId(),
                session.getStartTime(),
                session.getEndTime(),
                session.getSessionType(),
                session.getMode(),
                session.getUpdatedAt(),
                session.isDeleted()
        );
    }
}
