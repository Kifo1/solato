package de.kifo.solato;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class SolatoApplication {

	public static void main(String[] args) {
		SpringApplication.run(SolatoApplication.class, args);
	}

}
