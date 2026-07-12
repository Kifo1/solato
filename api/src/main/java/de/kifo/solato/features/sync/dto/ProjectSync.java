package de.kifo.solato.features.sync.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public record ProjectSync (

        @NotNull(message = "Project ID cannot be null")
        UUID id,

        @NotBlank(message = "Project name cannot be empty")
        @Size(max = 100, message = "Project name cannot exceed 100 characters")
        String name,

        @NotNull(message = "Description cannot be null")
        @Size(max = 500, message = "Description cannot exceed 500 characters")
        String description,

        @NotBlank(message = "Color cannot be empty")
        @Size(max = 9, message = "Color string is too long")
        String color,

        @NotNull(message = "Created at timestamp cannot be null")
        Instant createdAt,

        @NotNull(message = "Updated at timestamp cannot be null")
        Instant updatedAt,

        @NotNull(message = "isDeleted flag must be specified")
        Boolean isDeleted
) {}