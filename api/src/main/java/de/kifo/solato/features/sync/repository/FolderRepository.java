package de.kifo.solato.features.sync.repository;

import de.kifo.solato.features.sync.model.Folder;
import lombok.NonNull;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<@NonNull Folder, @NonNull UUID> {

    List<Folder> findByUserIdAndUpdatedAtAfter(Long userId, Instant lastSyncedAt);
}
