use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub is_deleted: i64,
}
