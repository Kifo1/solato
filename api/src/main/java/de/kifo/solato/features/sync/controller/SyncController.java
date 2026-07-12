package de.kifo.solato.features.sync.controller;

import de.kifo.solato.features.auth.model.User;
import de.kifo.solato.features.sync.dto.SyncRequest;
import de.kifo.solato.features.sync.dto.SyncResponse;
import de.kifo.solato.features.sync.service.SyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sync")
@RequiredArgsConstructor
public class SyncController {

    private final SyncService syncService;

    @PostMapping
    public ResponseEntity<SyncResponse> synchronize(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody SyncRequest requestDto) {
        Long userId = user.getId();

        SyncResponse responseDto = syncService.processSync(userId, requestDto);
        return ResponseEntity.ok(responseDto);
    }
}