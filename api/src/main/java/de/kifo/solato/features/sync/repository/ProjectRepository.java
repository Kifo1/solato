package de.kifo.solato.features.sync.repository;

import de.kifo.solato.features.sync.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {

    List<Project> findByUserIdAndUpdatedAtAfter(Long userId, Instant lastSyncedAt);
}
