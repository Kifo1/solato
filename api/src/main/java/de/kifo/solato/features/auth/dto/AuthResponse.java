package de.kifo.solato.features.auth.dto;

//TODO Send JWT instead of message
public record AuthResponse(String message, boolean success) {}
