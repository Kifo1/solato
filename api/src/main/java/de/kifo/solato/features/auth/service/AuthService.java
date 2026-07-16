package de.kifo.solato.features.auth.service;

import de.kifo.solato.features.auth.dto.AuthResponse;
import de.kifo.solato.features.auth.dto.LoginRequest;
import de.kifo.solato.features.auth.dto.RegisterRequest;
import de.kifo.solato.features.auth.dto.VerifyRequest;
import de.kifo.solato.features.auth.model.PendingRegistration;
import de.kifo.solato.features.auth.model.RefreshToken;
import de.kifo.solato.features.auth.model.User;
import de.kifo.solato.features.auth.repository.PendingRegistrationRepository;
import de.kifo.solato.features.auth.repository.RefreshTokenRepository;
import de.kifo.solato.features.auth.repository.UserRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final JwtService jwtService;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            return new AuthResponse("E-Mail already in use.", false);
        }

        String email = request.email();

        String verifyCode = generateVerifyCode();
        pendingRegistrationRepository.findByEmail(email)
                .ifPresent(pendingRegistrationRepository::delete);

        PendingRegistration pendingRegistration = new PendingRegistration();
        pendingRegistration.setEmail(email);
        pendingRegistration.setPassword(passwordEncoder.encode(request.password()));
        pendingRegistration.setVerificationCode(verifyCode);

        pendingRegistrationRepository.save(pendingRegistration);

        emailService.sendVerificationCode(email, verifyCode);

        return new AuthResponse("User successful registered", true);
    }

    @Transactional
    public AuthResponse verifyAndRegister(VerifyRequest request) {
        Optional<PendingRegistration> pendingRegistrationOptional = pendingRegistrationRepository.findByEmail(request.email());

        if (pendingRegistrationOptional.isEmpty()) {
            return new AuthResponse("No pending verification found for this E-Mail.", false);
        }

        PendingRegistration pendingRegistration = pendingRegistrationOptional.get();

        if (Instant.now().isAfter(pendingRegistration.getExpiryDate())) {
            pendingRegistrationRepository.delete(pendingRegistration);
            return new AuthResponse("Verification code expired. Please register again.", false);
        }

        if (!pendingRegistration.getVerificationCode().equals(request.code())) {
            return new AuthResponse("Invalid verification code.", false);
        }

        User user = new User();
        user.setEmail(pendingRegistration.getEmail());
        user.setPassword(pendingRegistration.getPassword());
        userRepository.save(user);

        pendingRegistrationRepository.delete(pendingRegistration);

        String accessToken = jwtService.generateToken(user.getEmail());
        String refreshToken = createRefreshToken(user);

        return new AuthResponse("Registration completed.", true, accessToken, refreshToken);
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

    private String generateVerifyCode() {
        SecureRandom random = new SecureRandom();
        int num = random.nextInt(1000000);
        return String.format("%06d", num);
    }
}
