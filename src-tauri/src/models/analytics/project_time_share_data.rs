use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectTimeShare {
    pub project_id: String,
    pub name: String,
    pub color: String,
    pub total_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectTimeShareData {
    pub total_seconds: u64,
    pub entries: Vec<ProjectTimeShare>,
}
