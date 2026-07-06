package de.kifo.solato.features.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "E-Mail cannot be empty")
        @Email(message = "E-Mail is not valid")
        String email,

        @NotBlank(message = "Password cannot be empty")
        @Size(min = 8, max = 64, message = "Password must have between 8 and 64 characters")
        @Pattern(
                regexp = "^(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!.*_]).*$",
                message = "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character."
        )
        String password
) {}
