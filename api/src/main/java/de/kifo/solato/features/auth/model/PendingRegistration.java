package de.kifo.solato.features.auth.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Getter
@Setter
@Table(name = "pending_registrations")
public class PendingRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "verification_code", nullable = false)
    private String verificationCode;

    @Column(name = "expire_date", nullable = false)
    private Instant expiryDate;

    @PrePersist
    protected void onCreate() {
        this.expiryDate = Instant.now().plusSeconds(15 * 60); // Code expires after 15 minutes
    }
}