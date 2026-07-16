package de.kifo.solato.features.auth.repository;

import de.kifo.solato.features.auth.model.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, Long> {

    Optional<PendingRegistration> findByEmail(String email);

    void deleteByEmail(String email);
}