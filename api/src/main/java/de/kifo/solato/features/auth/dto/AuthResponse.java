package de.kifo.solato.features.auth.dto;

public record AuthResponse(
        String message,
        boolean success,
        String accessToken,
        String refreshToken
) {
    public AuthResponse(String message, boolean success) {
        this(message, success, null, null);
    }
}