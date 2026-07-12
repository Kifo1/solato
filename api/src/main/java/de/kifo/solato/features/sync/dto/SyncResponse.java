package de.kifo.solato.features.sync.dto;

import java.time.Instant;
import java.util.List;

public record SyncResponse (
        Instant syncTimestamp,
        List<ProjectSync> projects,
        List<SessionSync> sessions
) {}
