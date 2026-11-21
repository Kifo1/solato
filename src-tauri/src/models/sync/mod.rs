use serde::{Deserialize, Deserializer};
use uuid::Uuid;

pub mod folder_sync;
pub mod project_sync;
pub mod session_sync;
pub mod sync_request;
pub mod sync_response;

/// Deserializes an optional nullable UUID field while distinguishing:
/// - field omitted in JSON -> `None` (via `#[serde(default)]`)
/// - field present with `null` -> `Some(None)`
/// - field present with UUID -> `Some(Some(uuid))`
pub fn deserialize_present_option_uuid<'de, D>(
    deserializer: D,
) -> Result<Option<Option<Uuid>>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<Uuid>::deserialize(deserializer).map(Some)
}
