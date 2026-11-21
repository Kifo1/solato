use keyring::Entry;

pub const KEYRING_SERVICE: &str = "de.kifo.solato";
pub const KEYRING_USER: &str = if cfg!(debug_assertions) {
    "refresh_token_dev"
} else {
    "refresh_token"
};

/// Persistent storage abstraction for the long-lived refresh token.
/// Implementations must not cache tokens in memory beyond the duration of a single call.
pub trait TokenStore: Send + Sync {
    fn get_refresh_token(&self) -> Result<Option<String>, String>;
    fn set_refresh_token(&self, token: &str) -> Result<(), String>;
    fn delete_refresh_token(&self) -> Result<(), String>;
}

/// OS keyring backed token store storing only the entry identifiers in memory.
pub struct KeyringTokenStore {
    service: String,
    username: String,
}

impl KeyringTokenStore {
    pub fn default_solato() -> Self {
        Self {
            service: KEYRING_SERVICE.to_string(),
            username: KEYRING_USER.to_string(),
        }
    }
}

impl TokenStore for KeyringTokenStore {
    fn get_refresh_token(&self) -> Result<Option<String>, String> {
        let entry = Entry::new(&self.service, &self.username).map_err(|e| format!("{:?}", e))?;
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("{:?}", e)),
        }
    }

    fn set_refresh_token(&self, token: &str) -> Result<(), String> {
        let entry = Entry::new(&self.service, &self.username).map_err(|e| format!("{:?}", e))?;
        entry.set_password(token).map_err(|e| format!("{:?}", e))
    }

    fn delete_refresh_token(&self) -> Result<(), String> {
        let entry = Entry::new(&self.service, &self.username).map_err(|e| format!("{:?}", e))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("{:?}", e)),
        }
    }
}
