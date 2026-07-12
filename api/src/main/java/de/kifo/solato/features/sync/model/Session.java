package de.kifo.solato.features.sync.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Getter
@Setter
@Table(name = "sessions", indexes = {
        @Index(name = "idx_session_owner_updated", columnList = "user_id, updated_at")
})
public class Session {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId; // No ManyToOne since business logic stays on client side

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "session_type", nullable = false)
    private String sessionType;

    @Column(nullable = false)
    private String mode;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;
}
