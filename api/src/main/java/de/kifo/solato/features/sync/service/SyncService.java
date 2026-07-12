package de.kifo.solato.features.sync.service;

import de.kifo.solato.features.sync.dto.*;
import de.kifo.solato.features.sync.model.Project;
import de.kifo.solato.features.sync.model.Session;
import de.kifo.solato.features.sync.repository.ProjectRepository;
import de.kifo.solato.features.sync.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SyncService {

    private final ProjectRepository projectRepository;
    private final SessionRepository sessionRepository;

    @Transactional
    public SyncResponse processSync(Long userId, SyncRequest request) {
        Instant syncTimestamp = Instant.now();

        if (request.projects() != null) {
            request.projects().forEach(dto -> upsertProject(userId, dto));
        }
        if (request.sessions() != null) {
            request.sessions().forEach(dto -> upsertSession(userId, dto));
        }

        Instant lastSynced = request.lastSyncedAt() != null ? request.lastSyncedAt() : Instant.EPOCH;

        List<ProjectSync> dbProjects = projectRepository.findByUserIdAndUpdatedAtAfter(userId, lastSynced)
                .stream().map(this::mapToProject).toList();

        List<SessionSync> dbSessions = sessionRepository.findByUserIdAndUpdatedAtAfter(userId, lastSynced)
                .stream().map(this::mapToSession).toList();

        return new SyncResponse(syncTimestamp, dbProjects, dbSessions);
    }

    private void upsertProject(Long userId, ProjectSync dto) {
        projectRepository.findById(dto.id()).ifPresentOrElse(
                existing -> {
                    if (dto.updatedAt().isAfter(existing.getUpdatedAt())) {
                        existing.setName(dto.name());
                        existing.setDescription(dto.description());
                        existing.setColor(dto.color());
                        existing.setUpdatedAt(dto.updatedAt());
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
                    newProject.setCreatedAt(dto.createdAt());
                    newProject.setUpdatedAt(dto.updatedAt());
                    newProject.setDeleted(dto.isDeleted());
                    projectRepository.save(newProject);
                }
        );
    }

    private void upsertSession(Long userId, SessionSync dto) {
        sessionRepository.findById(dto.id()).ifPresentOrElse(
                existing -> {
                    if (dto.updatedAt().isAfter(existing.getUpdatedAt())) {
                        existing.setProjectId(dto.projectId());
                        existing.setStartTime(dto.startTime());
                        existing.setEndTime(dto.endTime());
                        existing.setSessionType(dto.sessionType());
                        existing.setMode(dto.mode());
                        existing.setUpdatedAt(dto.updatedAt());
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
                    newSession.setUpdatedAt(dto.updatedAt());
                    newSession.setDeleted(dto.isDeleted());
                    sessionRepository.save(newSession);
                }
        );
    }

    private ProjectSync mapToProject(Project project) {
        return new ProjectSync(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getColor(),
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