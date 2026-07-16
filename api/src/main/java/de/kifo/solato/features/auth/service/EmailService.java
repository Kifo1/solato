package de.kifo.solato.features.auth.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final Resend resend;

    public EmailService(@Value("${solato.resend.api-key}") String apiKey) {
        this.resend = new Resend(apiKey);
    }

    public void sendVerificationCode(String toEmail, String code) {
        CreateEmailOptions params = CreateEmailOptions.builder()
                .from("Solato <noreply@solato.app>")
                .to(toEmail)
                .subject("Verification Code")
                .html("<p>Welcome to Solato!</p><p>Your verification code is: <strong>" + code + "</strong></p><p>This code is valid for 15 minutes.</p>")
                .build();

        try {
            resend.emails().send(params);
        } catch (ResendException e) {
            throw new RuntimeException("Verification E-Mail could not be sent.", e);
        }
    }
}