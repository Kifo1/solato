package de.kifo.solato.features.sync.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Getter
@Setter
@Table(name = "folders", indexes = {
        @Index(name = "idx_folder_owner_updated", columnList = "user_id, updated_at")
})
public class Folder {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name;

    private String color = "#3B82F6";

    @Column(name = "parent_id")
    private UUID parentId; // No ManyToOne since business logic stays on client side

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;
}
