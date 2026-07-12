package de.kifo.solato.features.sync.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public record SessionSync (

        @NotNull(message = "Session ID cannot be null")
        UUID id,

        @NotNull(message = "Associated Project ID cannot be null")
        UUID projectId,

        @NotNull(message = "Start time cannot be null")
        Instant startTime,

        Instant endTime,

        @NotBlank(message = "Session type cannot be empty")
        @Size(max = 50, message = "Session type is too long")
        String sessionType,

        @NotBlank(message = "Mode cannot be empty")
        @Size(max = 50, message = "Mode is too long")
        String mode,

        @NotNull(message = "Updated at timestamp cannot be null")
        Instant updatedAt,

        @NotNull(message = "isDeleted flag must be specified")
        Boolean isDeleted
) {}