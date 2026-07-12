package de.kifo.solato.features.sync.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public record SyncRequest (

        Instant lastSyncedAt,

        @NotNull(message = "Projects list cannot be null")
        @Valid
        List<ProjectSync> projects,

        @NotNull(message = "Sessions list cannot be null")
        @Valid
        List<SessionSync> sessions
) {}