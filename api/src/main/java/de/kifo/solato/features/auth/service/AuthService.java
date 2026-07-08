package de.kifo.solato.features.auth.service;

import de.kifo.solato.features.auth.dto.AuthResponse;
import de.kifo.solato.features.auth.dto.LoginRequest;
import de.kifo.solato.features.auth.dto.RegisterRequest;
import de.kifo.solato.features.auth.model.RefreshToken;
import de.kifo.solato.features.auth.model.User;
import de.kifo.solato.features.auth.repository.RefreshTokenRepository;
import de.kifo.solato.features.auth.repository.UserRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalUnit;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    //TODO Add email service for registration

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            return new AuthResponse("E-Mail already in use.", false);
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));

        userRepository.save(user);

        String accessToken = jwtService.generateToken(user.getEmail());
        String refreshToken = createRefreshToken(user);

        return new AuthResponse("User successful registered", true, accessToken, refreshToken);
    }

    public AuthResponse login(LoginRequest request) {
        Optional<User> userOptional = userRepository.findByEmail(request.email());

        if (userOptional.isEmpty()) {
            return new AuthResponse("Invalid E-Mail", false);
        }

        User user = userOptional.get();

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            return new AuthResponse("Invalid E-Mail or password", false);
        }

        String accessToken = jwtService.generateToken(user.getEmail());
        String refreshToken = createRefreshToken(user);

        return new AuthResponse("Login successful", true, accessToken, refreshToken);
    }

    @Transactional
    public AuthResponse refreshAuthentication(String oldRefreshTokenStr) {
        Optional<RefreshToken> refreshTokenOptional = refreshTokenRepository.findByToken(oldRefreshTokenStr);
        if (refreshTokenOptional.isEmpty()) {
            return new AuthResponse("Refresh token not found", false);
        }

        RefreshToken oldRefreshToken = refreshTokenOptional.get();
        if (oldRefreshToken.isRevoked()) {
            return new AuthResponse("Refresh token has been revoked and therefor is invalid.", false);
        }

        if (Instant.now().isAfter(oldRefreshToken.getExpiryDate())) {
            return new AuthResponse("Refresh token expired", false);
        }

        if (Instant.now().isAfter(oldRefreshToken.getLastUsedAt().plus(60, ChronoUnit.DAYS))) {
            return new AuthResponse("Session expired due to 60 days of inactivity", false);
        }

        oldRefreshToken.setRevoked(true);
        refreshTokenRepository.save(oldRefreshToken);

        User user = oldRefreshToken.getUser();
        String newAccessToken = jwtService.generateToken(user.getEmail());
        String newRefreshToken = createRefreshToken(user);

        return new AuthResponse("Token refreshed", true, newAccessToken, newRefreshToken);
    }

    private String createRefreshToken(@NotNull User user) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setExpiryDate(Instant.now().plus(365, ChronoUnit.DAYS)); // Refresh token expires after one year
        refreshTokenRepository.save(refreshToken);
        return refreshToken.getToken();
    }
}
