use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    time::SystemTime,
};

use actson::{tokio::AsyncBufReaderJsonFeeder, JsonEvent, JsonParser};
use serde::Serialize;
use serde_json::{Number, Value};
use tokio::{fs::File, io::BufReader};
use ts_rs::TS;

use crate::workspaces::fs_ops::{read_dir_recursive, DirEntry, WorkspaceConfig};

#[derive(thiserror::Error, Debug)]
pub enum WorkspaceStateError {
    #[error("Failed to read directory: {0}")]
    DirReadError(PathBuf),
    #[error("Failed to read directory: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Failed to parse workspace config: {0}")]
    TomlError(#[from] toml::de::Error),
    // #[error("Failed to parse workspace index: {0}")]
    // IndexError(#[from] crate::workspaces::index::WorkspaceIndexError),
    #[error("Failed to read workspace info: {0}")]
    WorkspaceReadError(#[from] crate::workspaces::fs_ops::FsOpsError),
    #[error("Invalid workspace manifest: expected ID {0}, found ID {1}")]
    InvalidWorkspaceManifest(String, String),
    #[error("Invalid ATRB file: {0}")]
    InvalidAtrbFile(PathBuf),
    #[error("Multiple files with duplicate runbook IDs: {0} and {1}")]
    DuplicateRunbook(PathBuf, PathBuf),
}

#[derive(thiserror::Error, Debug)]
pub enum JsonParseError {
    #[error("Failed to parse JSON: {0}")]
    JsonError(#[from] actson::parser::ParserError),
    #[error("Failed to parse number: {0}")]
    ParseFloatError(#[from] actson::parser::InvalidFloatValueError),
    #[error("Failed to parse number: {0}")]
    ParseIntError(#[from] actson::parser::InvalidIntValueError),
    #[error("Failed to parse string: {0}")]
    ParseStringError(#[from] actson::parser::InvalidStringValueError),
    #[error("Failed to read from file: {0}")]
    FillError(#[from] actson::feeder::FillError),
    #[error("Invalid float value: {0}")]
    InvalidFloatValueError(f64),
    #[error("Missing keys: {0:?} in {1}")]
    MissingKeysError(Vec<String>, PathBuf),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

#[derive(TS, Debug, Clone, Serialize)]
#[ts(export)]
pub struct WorkspaceState {
    pub id: String,
    pub name: String,
    pub root: PathBuf,
    pub entries: Vec<DirEntry>,
    pub runbooks: HashMap<String, WorkspaceRunbook>,
}

// TODO
// #[derive(TS, Debug, Clone, Serialize)]
// #[serde(tag = "type", content = "data")]
// #[ts(export)]
// pub enum WorkspaceStateChange {
//     WorkspaceNameChanged(String),
//     DirEntriesChanged(Vec<DirEntry>),
//     RunbookAdded(WorkspaceRunbook),
//     RunbookUpdated(WorkspaceRunbook),
//     RunbookDeleted(String),
// }

impl WorkspaceState {
    pub async fn new(id: &str, root: impl AsRef<Path>) -> Result<Self, WorkspaceStateError> {
        let config = WorkspaceConfig::from_file(root.as_ref().join("atuin.toml")).await?;
        if config.workspace.id != id {
            return Err(WorkspaceStateError::InvalidWorkspaceManifest(
                id.to_string(),
                config.workspace.id,
            ));
        }

        let entries = read_dir_recursive(root.as_ref()).await?;
        let runbooks = get_workspace_runbooks(&entries).await?;

        Ok(Self {
            id: id.to_string(),
            name: config.workspace.name,
            root: root.as_ref().to_path_buf(),
            entries,
            runbooks,
        })
    }

    /// Calculates the top-level paths from a list of item IDs.
    pub fn calculate_toplevel_paths(&self, item_ids: &[String]) -> Vec<PathBuf> {
        let mut result = Vec::new();

        for item_id in item_ids {
            // Check if this item is a child of any other item in the list
            let is_child = item_ids.iter().any(|other_id| {
                if other_id == item_id {
                    return false;
                }

                if let Some(ref current_path) = self.get_path_for_item(item_id) {
                    if let Some(ref other_path) = self.get_path_for_item(other_id) {
                        // Check if current_path is a child of other_path
                        return current_path.starts_with(other_path) && current_path != other_path;
                    }
                }

                false
            });

            // Only add if it's not a child of any other item
            if !is_child {
                result.push(self.get_path_for_item(item_id).unwrap());
            }
        }

        result
    }

    fn get_path_for_item(&self, item_id: &str) -> Option<PathBuf> {
        if let Some(runbook) = self.runbooks.get(item_id) {
            return Some(runbook.path.clone());
        }

        let path_buf = PathBuf::from(item_id);
        if self.entries.iter().any(|entry| entry.path == path_buf) {
            Some(path_buf)
        } else {
            None
        }
    }

    // TODO
    // pub fn update_runbook(&mut self, runbook: &WorkspaceRunbook) {
    //     self.runbooks
    //         .entry(runbook.id.clone())
    //         .and_modify(|r| {
    //             r.name = runbook.name.clone();
    //             r.version = runbook.version;
    //             r.path = runbook.path.clone();
    //             r.lastmod = runbook.lastmod;
    //         })
    //         .or_insert(runbook.clone());
    // }
}

#[derive(TS, Debug, Clone, Serialize, PartialEq)]
#[ts(export)]
pub struct WorkspaceRunbook {
    pub id: String,
    pub name: String,
    #[ts(type = "number")]
    pub version: u64,
    pub path: PathBuf,
    #[ts(type = "{ secs_since_epoch: number, nanos_since_epoch: number } | null")]
    pub lastmod: Option<SystemTime>,
}

impl WorkspaceRunbook {
    pub fn new(
        id: &str,
        name: &str,
        version: u64,
        path: impl AsRef<Path>,
        lastmod: Option<SystemTime>,
    ) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            version,
            path: path.as_ref().to_path_buf(),
            lastmod,
        }
    }

    /// Incrementally parses an .atrb file to find the ID and name of the runbook.
    /// Once these are found, the function returns and the rest of the file is ignored.
    pub async fn from_file(path: impl AsRef<Path>) -> Result<Self, WorkspaceStateError> {
        let file = File::open(&path).await?;
        let stats = File::metadata(&file).await?;
        drop(file);

        let info = get_json_keys(&path, &["id", "name", "version"])
            .await
            .map_err(|_| WorkspaceStateError::InvalidAtrbFile(path.as_ref().to_path_buf()))?;
        let id = info
            .get("id")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .ok_or_else(|| WorkspaceStateError::InvalidAtrbFile(path.as_ref().to_path_buf()))?;
        let name = info
            .get("name")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .ok_or_else(|| WorkspaceStateError::InvalidAtrbFile(path.as_ref().to_path_buf()))?;
        let version = info
            .get("version")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| WorkspaceStateError::InvalidAtrbFile(path.as_ref().to_path_buf()))?;

        Ok(Self::new(
            &id,
            &name,
            version,
            path.as_ref(),
            stats.modified().ok(),
        ))
    }
}

enum ParseState {
    None,
    Expecting(String),
}

async fn get_workspace_runbooks(
    dir_entries: &[DirEntry],
) -> Result<HashMap<String, WorkspaceRunbook>, WorkspaceStateError> {
    let mut runbooks: HashMap<String, WorkspaceRunbook> = HashMap::new();
    for entry in dir_entries {
        let name = entry
            .path
            .file_name()
            .ok_or_else(|| WorkspaceStateError::DirReadError(entry.path.clone()))?
            .to_string_lossy()
            .to_string();

        if name.ends_with(".atrb") {
            let runbook = WorkspaceRunbook::from_file(entry.path.clone()).await?;
            if runbooks.contains_key(&runbook.id) {
                return Err(WorkspaceStateError::DuplicateRunbook(
                    entry.path.clone(),
                    runbooks.get(&runbook.id).unwrap().path.clone(),
                ));
            }

            runbooks.insert(runbook.id.clone(), runbook);
        }
    }
    Ok(runbooks)
}

/// Incrementally parses a JSON file to find the values of the given keys.
/// The keys must be present in the JSON file, and must exist at the top level of the JSON object.
/// The value of the key must be a primitive type: string, number, boolean, or null.
/// The function returns a map of the keys to their values.
async fn get_json_keys(
    atrb_path: impl AsRef<Path>,
    keys: &[&str],
) -> Result<HashMap<String, Value>, JsonParseError> {
    let file = File::open(&atrb_path).await?;
    let reader = BufReader::with_capacity(1024, file);
    let feeder = AsyncBufReaderJsonFeeder::new(reader);

    let mut result = HashMap::with_capacity(keys.len());

    let mut parser = JsonParser::new(feeder);
    let mut state = ParseState::None;
    let mut obj_level = 0;

    while let Some(event) = parser.next_event()? {
        match event {
            JsonEvent::NeedMoreInput => {
                parser.feeder.fill_buf().await?;
            }
            JsonEvent::StartObject => {
                obj_level += 1;
                state = ParseState::None;
            }
            JsonEvent::EndObject => {
                obj_level -= 1;
                state = ParseState::None;
            }
            JsonEvent::FieldName => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                let field_name = parser.current_str()?;

                if keys.contains(&field_name) {
                    state = ParseState::Expecting(field_name.to_string());
                } else {
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueString => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = parser.current_str()?.to_string();
                    let value = Value::String(value);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueFloat => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = parser.current_float()?;
                    let value = Number::from_f64(value)
                        .ok_or(JsonParseError::InvalidFloatValueError(value))?;
                    let value = Value::Number(value);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueInt => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value: i64 = parser.current_int()?;
                    let value = Value::Number(value.into());
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueNull => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = Value::Null;
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueTrue => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = Value::Bool(true);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueFalse => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = Value::Bool(false);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            _ => {
                state = ParseState::None;
            }
        }

        if result.len() == keys.len() {
            break;
        }
    }

    if result.len() != keys.len() {
        return Err(JsonParseError::MissingKeysError(
            keys.iter().map(|k| k.to_string()).collect(),
            atrb_path.as_ref().to_path_buf(),
        ));
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use tempfile::TempDir;

    use crate::workspaces::fs_ops::WorkspaceConfigDetails;

    use super::*;

    async fn setup() -> TempDir {
        let root = tempfile::tempdir().unwrap();
        tokio::fs::create_dir_all(&root).await.unwrap();

        let config = toml::to_string(&WorkspaceConfig {
            workspace: WorkspaceConfigDetails {
                id: "test".to_string(),
                name: "Test Workspace".to_string(),
            },
        })
        .unwrap();

        let config_path = root.path().join("atuin.toml");
        tokio::fs::write(&config_path, config).await.unwrap();

        let rb1 = json!({
            "id": "rb1",
            "name": "Runbook 1",
            "version": 1,
        });

        let rb1_path = root.path().join("rb1.atrb");
        tokio::fs::write(&rb1_path, rb1.to_string()).await.unwrap();

        let rb2 = json!({
            "id": "rb2",
            "name": "Runbook 2",
            "version": 2,
        });

        let rb2_path = root.path().join("rb2.atrb");
        tokio::fs::write(&rb2_path, rb2.to_string()).await.unwrap();

        root
    }

    #[tokio::test]
    async fn test_workspace_state() {
        let root = setup().await;
        let state = WorkspaceState::new("test", root.path()).await.unwrap();

        assert_eq!(state.id, "test");

        assert_eq!(state.runbooks.len(), 2);

        let rb1 = state.runbooks.get("rb1").unwrap();
        assert_eq!(rb1.id, "rb1");
        assert_eq!(rb1.name, "Runbook 1");
        assert_eq!(rb1.version, 1);

        let rb2 = state.runbooks.get("rb2").unwrap();
        assert_eq!(rb2.id, "rb2");
        assert_eq!(rb2.name, "Runbook 2");
        assert_eq!(rb2.version, 2);
    }
}
