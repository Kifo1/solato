package de.kifo.solato.features.auth.repository;

import de.kifo.solato.features.auth.model.RefreshToken;
import lombok.NonNull;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<@NonNull RefreshToken, @NonNull Long> {

    Optional<RefreshToken> findByToken(String token);
}
