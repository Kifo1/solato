# Solato API

The remote backend service for **Solato**, responsible for user authentication, cloud data synchronization, and account management. Built with Spring Boot, Java 25, and Gradle (Kotlin DSL).

## 🛠️ Tech Stack

* **Framework:** Spring Boot 3.x
* **Language:** Java 25
* **Build Tool:** Gradle (Kotlin DSL)
* **Database:** MariaDB
* **ORM:** Spring Data JPA (Hibernate)

---

## 🚀 Getting Started (Development)

### 1. Prerequisites
Ensure you have the following installed on your local machine:
* **Java 25 JDK**
* **Docker Desktop** (for running the database container)
* **IntelliJ IDEA** (recommended IDE)

### 2. Run the Development Database
The project utilizes Docker Compose to provision an isolated MariaDB database instance locally. Spin up the container by running this command from the `api/` root directory:

```bash
docker compose up -d