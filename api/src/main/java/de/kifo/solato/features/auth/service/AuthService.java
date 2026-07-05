package de.kifo.solato.features.auth.service;

import de.kifo.solato.features.auth.dto.AuthResponse;
import de.kifo.solato.features.auth.dto.LoginRequest;
import de.kifo.solato.features.auth.dto.RegisterRequest;
import de.kifo.solato.features.auth.model.User;
import de.kifo.solato.features.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {
    //TODO Add validation
    //TODO Add email service for registration

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            return new AuthResponse("E-Mail already in use.", false);
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));

        userRepository.save(user);

        return new AuthResponse("User registered", true); //TODO Return JWT
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

        return new AuthResponse("Login", true); //TODO Return JWT
    }
}
