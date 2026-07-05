package de.kifo.solato.features.auth.dto;

public record AuthResponse(String message, boolean success, String token) {

    public AuthResponse(String message, boolean success) {
        this(message, success, null);
    }
}
