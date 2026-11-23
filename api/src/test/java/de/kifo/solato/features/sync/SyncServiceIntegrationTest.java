package de.kifo.solato.features.sync;

import de.kifo.solato.features.sync.dto.FolderSync;
import de.kifo.solato.features.sync.dto.ProjectSync;
import de.kifo.solato.features.sync.dto.SyncRequest;
import de.kifo.solato.features.sync.dto.SyncResponse;
import de.kifo.solato.features.sync.model.Folder;
import de.kifo.solato.features.sync.model.Project;
import de.kifo.solato.features.sync.repository.FolderRepository;
import de.kifo.solato.features.sync.repository.ProjectRepository;
import de.kifo.solato.features.sync.service.SyncService;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class SyncServiceIntegrationTest {

    @Autowired
    private SyncService syncService;

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private Validator validator;

    @Test
    void syncPersistsNestedFoldersAndProjectFolderAssignmentsAcrossDevices() throws Exception {
        long userId = 900_001L;
        UUID rootFolderId = UUID.randomUUID();
        UUID subFolderId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Instant created = Instant.now().minusSeconds(60);

        // Device A uploads nested folders and a project inside the subfolder
        SyncRequest deviceARequest = new SyncRequest(
                null,
                List.of(
                        new FolderSync(rootFolderId, "DHBW", "#3B82F6", null, created, created, false),
                        new FolderSync(subFolderId, "Semester 3", "#10B981", rootFolderId, created, created, false)
                ),
                List.of(
                        new ProjectSync(projectId, "Numerik", "Math", "#8B5CF6", subFolderId, created, created, false)
                ),
                List.of()
        );

        SyncResponse deviceAResponse = syncService.processSync(userId, deviceARequest);
        assertThat(deviceAResponse.folders()).isEmpty();
        assertThat(deviceAResponse.projects()).isEmpty();

        // Ensure clock advances past Device A's syncTimestamp before Device B syncs
        Thread.sleep(2);

        // Device B performs an initial sync and receives both folders and the project with folderId
        SyncResponse deviceBResponse = syncService.processSync(
                userId,
                new SyncRequest(null, List.of(), List.of(), List.of())
        );

        assertThat(deviceBResponse.folders()).hasSize(2);
        FolderSync syncedRoot = deviceBResponse.folders().stream()
                .filter(f -> f.id().equals(rootFolderId))
                .findFirst()
                .orElseThrow();
        FolderSync syncedSub = deviceBResponse.folders().stream()
                .filter(f -> f.id().equals(subFolderId))
                .findFirst()
                .orElseThrow();
        assertThat(syncedRoot.name()).isEqualTo("DHBW");
        assertThat(syncedRoot.parentId()).isNull();
        assertThat(syncedSub.name()).isEqualTo("Semester 3");
        assertThat(syncedSub.parentId()).isEqualTo(rootFolderId);

        assertThat(deviceBResponse.projects()).hasSize(1);
        ProjectSync syncedProject = deviceBResponse.projects().getFirst();
        assertThat(syncedProject.id()).isEqualTo(projectId);
        assertThat(syncedProject.folderId()).isEqualTo(subFolderId);

        // Verify JSON wire format matches Rust client expectations (explicit null for parentId/folderId)
        String json = jsonMapper.writeValueAsString(deviceBResponse);
        JsonNode rootNode = jsonMapper.readTree(json);
        assertThat(rootNode.has("folders")).isTrue();
        assertThat(rootNode.get("folders").size()).isEqualTo(2);
        JsonNode rootFolderJson = null;
        for (JsonNode node : rootNode.get("folders")) {
            if (rootFolderId.toString().equals(node.get("id").asString())) {
                rootFolderJson = node;
            }
        }
        assertThat(rootFolderJson).isNotNull();
        assertThat(rootFolderJson.has("parentId")).isTrue();
        assertThat(rootFolderJson.get("parentId").isNull()).isTrue();
        assertThat(rootNode.get("projects").get(0).get("folderId").asString()).isEqualTo(subFolderId.toString());
    }

    @Test
    void deserializesAndValidatesBothModernAndLegacySyncRequests() {
        UUID folderId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        String modernJson = """
                {
                  "lastSyncedAt": "2026-11-21T13:00:00Z",
                  "folders": [
                    {
                      "id": "%s",
                      "name": "DHBW",
                      "color": "#3B82F6",
                      "parentId": null,
                      "createdAt": "2026-11-21T12:00:00Z",
                      "updatedAt": "2026-11-21T12:30:00Z",
                      "isDeleted": false
                    }
                  ],
                  "projects": [
                    {
                      "id": "%s",
                      "name": "Linux",
                      "description": "OS",
                      "color": "#10B981",
                      "folderId": "%s",
                      "createdAt": "2026-11-21T12:00:00Z",
                      "updatedAt": "2026-11-21T12:30:00Z",
                      "isDeleted": false
                    }
                  ],
                  "sessions": []
                }
                """.formatted(folderId, projectId, folderId);

        SyncRequest modernRequest = jsonMapper.readValue(modernJson, SyncRequest.class);
        assertThat(validator.validate(modernRequest)).isEmpty();
        assertThat(modernRequest.folders()).hasSize(1);
        assertThat(modernRequest.folders().getFirst().id()).isEqualTo(folderId);
        assertThat(modernRequest.folders().getFirst().parentId()).isNull();
        assertThat(modernRequest.projects().getFirst().folderId()).isEqualTo(folderId);

        String legacyJson = """
                {
                  "lastSyncedAt": "2026-11-21T13:00:00Z",
                  "projects": [
                    {
                      "id": "%s",
                      "name": "Linux",
                      "description": "OS",
                      "color": "#10B981",
                      "createdAt": "2026-11-21T12:00:00Z",
                      "updatedAt": "2026-11-21T12:30:00Z",
                      "isDeleted": false
                    }
                  ],
                  "sessions": []
                }
                """.formatted(projectId);

        SyncRequest legacyRequest = jsonMapper.readValue(legacyJson, SyncRequest.class);
        assertThat(validator.validate(legacyRequest)).isEmpty();
        assertThat(legacyRequest.folders()).isNull();
        assertThat(legacyRequest.projects().getFirst().folderId()).isNull();
    }

    @Test
    void folderAwareClientCanExplicitlyUnassignProjectFolder() throws Exception {
        long userId = 900_002L;
        UUID folderId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Instant t1 = Instant.now().minusSeconds(60);

        syncService.processSync(userId, new SyncRequest(
                null,
                List.of(new FolderSync(folderId, "Work", "#3B82F6", null, t1, t1, false)),
                List.of(new ProjectSync(projectId, "Solato", "App", "#10B981", folderId, t1, t1, false)),
                List.of()
        ));

        Instant t2 = Instant.now().plusSeconds(5);
        syncService.processSync(userId, new SyncRequest(
                null,
                List.of(),
                List.of(new ProjectSync(projectId, "Solato", "App", "#10B981", null, t1, t2, false)),
                List.of()
        ));

        Project updated = projectRepository.findById(projectId).orElseThrow();
        assertThat(updated.getFolderId()).isNull();

        Thread.sleep(2);
        SyncResponse deviceBResponse = syncService.processSync(
                userId,
                new SyncRequest(null, List.of(), List.of(), List.of())
        );

        String json = jsonMapper.writeValueAsString(deviceBResponse);
        JsonNode projectNode = jsonMapper.readTree(json).get("projects").get(0);
        assertThat(projectNode.has("folderId")).isTrue();
        assertThat(projectNode.get("folderId").isNull()).isTrue();
    }

    @Test
    void legacyClientOmittingFoldersPreservesExistingProjectFolderId() {
        long userId = 900_003L;
        UUID folderId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Instant t1 = Instant.now().minusSeconds(60);

        syncService.processSync(userId, new SyncRequest(
                null,
                List.of(new FolderSync(folderId, "Uni", "#3B82F6", null, t1, t1, false)),
                List.of(new ProjectSync(projectId, "Linux", "OS", "#10B981", folderId, t1, t1, false)),
                List.of()
        ));

        // Legacy client omits "folders" (null) and "folderId" (null) when renaming project
        Instant t2 = Instant.now().plusSeconds(5);
        syncService.processSync(userId, new SyncRequest(
                null,
                null,
                List.of(new ProjectSync(projectId, "Linux Advanced", "OS", "#10B981", null, t1, t2, false)),
                List.of()
        ));

        Project updated = projectRepository.findById(projectId).orElseThrow();
        assertThat(updated.getName()).isEqualTo("Linux Advanced");
        assertThat(updated.getFolderId()).isEqualTo(folderId);
    }

    @Test
    void folderUpdatesRespectLastWriteWinsAndUserIsolation() {
        long userA = 900_004L;
        long userB = 900_005L;
        UUID folderId = UUID.randomUUID();
        UUID newParentId = UUID.randomUUID();
        Instant t1 = Instant.now().minusSeconds(60);

        syncService.processSync(userA, new SyncRequest(
                null,
                List.of(new FolderSync(folderId, "Original", "#3B82F6", null, t1, t1, false)),
                List.of(),
                List.of()
        ));

        // Stale update from userA is ignored
        Instant stale = t1.minusSeconds(10);
        syncService.processSync(userA, new SyncRequest(
                null,
                List.of(new FolderSync(folderId, "Stale", "#000000", null, t1, stale, true)),
                List.of(),
                List.of()
        ));
        Folder afterStale = folderRepository.findById(folderId).orElseThrow();
        assertThat(afterStale.getName()).isEqualTo("Original");
        assertThat(afterStale.isDeleted()).isFalse();

        // Update from userB with the same UUID is ignored and userB never sees userA's folder
        Instant newer = Instant.now().plusSeconds(10);
        SyncResponse userBResponse = syncService.processSync(userB, new SyncRequest(
                null,
                List.of(new FolderSync(folderId, "Hijacked", "#FF0000", null, t1, newer, true)),
                List.of(),
                List.of()
        ));
        assertThat(userBResponse.folders()).isEmpty();
        Folder afterUserB = folderRepository.findById(folderId).orElseThrow();
        assertThat(afterUserB.getUserId()).isEqualTo(userA);
        assertThat(afterUserB.getName()).isEqualTo("Original");

        // Newer update from userA applies rename, reparent, and soft-delete
        syncService.processSync(userA, new SyncRequest(
                null,
                List.of(new FolderSync(folderId, "Renamed", "#EC4899", newParentId, t1, newer, true)),
                List.of(),
                List.of()
        ));
        Folder afterUpdate = folderRepository.findById(folderId).orElseThrow();
        assertThat(afterUpdate.getName()).isEqualTo("Renamed");
        assertThat(afterUpdate.getColor()).isEqualTo("#EC4899");
        assertThat(afterUpdate.getParentId()).isEqualTo(newParentId);
        assertThat(afterUpdate.isDeleted()).isTrue();
    }
}
