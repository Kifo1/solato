package de.kifo.solato.features.sync.repository;

import de.kifo.solato.features.sync.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, UUID> {

    List<Session> findByUserIdAndUpdatedAtAfter(Long userId, Instant lastSyncedAt);
}
