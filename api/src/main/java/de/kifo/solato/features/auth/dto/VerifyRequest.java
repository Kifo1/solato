package de.kifo.solato.features.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record VerifyRequest(
        @NotBlank(message = "E-Mail cannot be empty")
        @Email(message = "E-Mail is not valid")
        String email,

        @NotBlank(message = "Verification code cannot be empty")
        String code
) {}
