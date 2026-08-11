use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tempfile::NamedTempFile;
use thiserror::Error;
use uuid::Uuid;

const MAX_DOCUMENT_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Default)]
struct DocumentRegistry {
    paths: Mutex<HashMap<String, PathBuf>>,
}

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
enum CommandError {
    #[error("the file changed outside the editor")]
    Conflict,
    #[error("the document is not valid UTF-8")]
    InvalidEncoding,
    #[error("the file operation failed")]
    Io,
    #[error("the file is no longer available")]
    NotFound,
    #[error("the document exceeds the local size limit")]
    TooLarge,
    #[error("the selected extension is unsupported")]
    UnsupportedExtension,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedDocument {
    storage_id: String,
    name: String,
    source: String,
    fingerprint: String,
    can_overwrite: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedDocument {
    storage_id: String,
    name: String,
    fingerprint: String,
    can_overwrite: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SaveDocumentRequest {
    storage_id: String,
    expected_fingerprint: String,
    source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SaveDocumentAsRequest {
    suggested_name: String,
    source: String,
}

struct ReadDocument {
    name: String,
    source: String,
    fingerprint: String,
}

fn command_error_for_io(error: &std::io::Error) -> CommandError {
    if error.kind() == std::io::ErrorKind::NotFound {
        CommandError::NotFound
    } else {
        CommandError::Io
    }
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown")
        })
}

fn is_content_fingerprint(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_suggested_name(value: String) -> Result<String, CommandError> {
    if value.is_empty()
        || value.len() > 255
        || value == "."
        || value == ".."
        || value.contains(['/', '\\', '\0'])
    {
        return Err(CommandError::Io);
    }
    Ok(value)
}

fn normalize_save_path(mut path: PathBuf) -> Result<PathBuf, CommandError> {
    if path.extension().is_none() {
        path.set_extension("md");
    }
    if !is_markdown_path(&path) {
        return Err(CommandError::UnsupportedExtension);
    }
    Ok(path)
}

fn read_document(path: &Path) -> Result<ReadDocument, CommandError> {
    if !is_markdown_path(path) {
        return Err(CommandError::UnsupportedExtension);
    }
    let file = File::open(path).map_err(|error| command_error_for_io(&error))?;
    let metadata = file
        .metadata()
        .map_err(|error| command_error_for_io(&error))?;
    if !metadata.is_file() {
        return Err(CommandError::Io);
    }
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err(CommandError::TooLarge);
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(MAX_DOCUMENT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| command_error_for_io(&error))?;
    if bytes.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err(CommandError::TooLarge);
    }
    let fingerprint = blake3::hash(&bytes).to_hex().to_string();
    let source = String::from_utf8(bytes).map_err(|_| CommandError::InvalidEncoding)?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(CommandError::Io)?
        .to_owned();
    Ok(ReadDocument {
        name,
        source,
        fingerprint,
    })
}

fn write_document_atomically(
    path: &Path,
    source: &str,
    expected_fingerprint: Option<&str>,
) -> Result<String, CommandError> {
    if !is_markdown_path(path) {
        return Err(CommandError::UnsupportedExtension);
    }
    if source.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err(CommandError::TooLarge);
    }
    let parent = path.parent().ok_or(CommandError::Io)?;
    let previous_permissions = fs::metadata(path)
        .ok()
        .map(|metadata| metadata.permissions());
    let mut temporary = NamedTempFile::new_in(parent).map_err(|_| CommandError::Io)?;
    if let Some(permissions) = previous_permissions {
        temporary
            .as_file()
            .set_permissions(permissions)
            .map_err(|_| CommandError::Io)?;
    }
    temporary
        .write_all(source.as_bytes())
        .and_then(|()| temporary.as_file().sync_all())
        .map_err(|_| CommandError::Io)?;
    if let Some(expected_fingerprint) = expected_fingerprint {
        let latest = read_document(path)?;
        if latest.fingerprint != expected_fingerprint {
            return Err(CommandError::Conflict);
        }
    }
    temporary.persist(path).map_err(|_| CommandError::Io)?;
    #[cfg(unix)]
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|_| CommandError::Io)?;
    Ok(blake3::hash(source.as_bytes()).to_hex().to_string())
}

fn path_from_dialog(value: FilePath) -> Result<PathBuf, CommandError> {
    value.into_path().map_err(|_| CommandError::Io)
}

async fn choose_open_path(app: AppHandle) -> Result<Option<PathBuf>, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("*.md, *.markdown", &["md", "markdown"])
            .blocking_pick_file()
            .map(path_from_dialog)
            .transpose()
    })
    .await
    .map_err(|_| CommandError::Io)?
}

async fn choose_save_path(
    app: AppHandle,
    suggested_name: String,
) -> Result<Option<PathBuf>, CommandError> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("*.md, *.markdown", &["md", "markdown"])
            .set_file_name(suggested_name)
            .blocking_save_file()
            .map(path_from_dialog)
            .transpose()
    })
    .await
    .map_err(|_| CommandError::Io)?
}

#[tauri::command]
async fn open_markdown_document(
    app: AppHandle,
    registry: State<'_, DocumentRegistry>,
) -> Result<Option<OpenedDocument>, CommandError> {
    let Some(path) = choose_open_path(app).await? else {
        return Ok(None);
    };
    let read_path = path.clone();
    let document = tauri::async_runtime::spawn_blocking(move || read_document(&read_path))
        .await
        .map_err(|_| CommandError::Io)??;
    let storage_id = Uuid::new_v4().to_string();
    let mut paths = registry.paths.lock().map_err(|_| CommandError::Io)?;
    paths.clear();
    paths.insert(storage_id.clone(), path);
    Ok(Some(OpenedDocument {
        storage_id,
        name: document.name,
        source: document.source,
        fingerprint: document.fingerprint,
        can_overwrite: true,
    }))
}

#[tauri::command]
async fn save_markdown_document(
    registry: State<'_, DocumentRegistry>,
    request: SaveDocumentRequest,
) -> Result<SavedDocument, CommandError> {
    if request.source.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err(CommandError::TooLarge);
    }
    if Uuid::parse_str(&request.storage_id).is_err() {
        return Err(CommandError::NotFound);
    }
    if !is_content_fingerprint(&request.expected_fingerprint) {
        return Err(CommandError::Conflict);
    }
    let path = registry
        .paths
        .lock()
        .map_err(|_| CommandError::Io)?
        .get(&request.storage_id)
        .cloned()
        .ok_or(CommandError::NotFound)?;
    let storage_id = request.storage_id;
    let expected_fingerprint = request.expected_fingerprint;
    let source = request.source;
    let (name, fingerprint) = tauri::async_runtime::spawn_blocking(move || {
        let current = read_document(&path)?;
        if current.fingerprint != expected_fingerprint {
            return Err(CommandError::Conflict);
        }
        let fingerprint = write_document_atomically(&path, &source, Some(&expected_fingerprint))?;
        Ok((current.name, fingerprint))
    })
    .await
    .map_err(|_| CommandError::Io)??;
    Ok(SavedDocument {
        storage_id,
        name,
        fingerprint,
        can_overwrite: true,
    })
}

#[tauri::command]
async fn save_markdown_document_as(
    app: AppHandle,
    registry: State<'_, DocumentRegistry>,
    request: SaveDocumentAsRequest,
) -> Result<Option<SavedDocument>, CommandError> {
    if request.source.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err(CommandError::TooLarge);
    }
    let suggested_name = validate_suggested_name(request.suggested_name)?;
    let Some(path) = choose_save_path(app, suggested_name).await? else {
        return Ok(None);
    };
    let path = normalize_save_path(path)?;
    let write_path = path.clone();
    let source = request.source;
    let fingerprint = tauri::async_runtime::spawn_blocking(move || {
        write_document_atomically(&write_path, &source, None)
    })
    .await
    .map_err(|_| CommandError::Io)??;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(CommandError::Io)?
        .to_owned();
    let storage_id = Uuid::new_v4().to_string();
    let mut paths = registry.paths.lock().map_err(|_| CommandError::Io)?;
    paths.clear();
    paths.insert(storage_id.clone(), path);
    Ok(Some(SavedDocument {
        storage_id,
        name,
        fingerprint,
        can_overwrite: true,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DocumentRegistry::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_markdown_document,
            save_markdown_document,
            save_markdown_document_as
        ])
        .run(tauri::generate_context!())
        .expect("failed to run the REZICS Markdown editor");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_round_trips_and_preserves_conflict_fingerprint() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("document.md");
        fs::write(&path, "before").expect("fixture write");
        let before = read_document(&path).expect("fixture read");
        assert_eq!(before.source, "before");

        let fingerprint = write_document_atomically(&path, "after", Some(&before.fingerprint))
            .expect("atomic write");
        let after = read_document(&path).expect("saved read");
        assert_eq!(after.source, "after");
        assert_eq!(after.fingerprint, fingerprint);
        assert_ne!(before.fingerprint, after.fingerprint);
    }

    #[test]
    fn atomic_write_does_not_replace_an_external_change() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("document.md");
        fs::write(&path, "before").expect("fixture write");
        let before = read_document(&path).expect("fixture read");
        fs::write(&path, "external change").expect("external fixture write");

        assert!(matches!(
            write_document_atomically(&path, "editor change", Some(&before.fingerprint)),
            Err(CommandError::Conflict)
        ));
        assert_eq!(
            fs::read_to_string(&path).expect("preserved external file"),
            "external change"
        );
    }

    #[test]
    fn rejects_non_utf8_and_unsupported_extensions() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let binary_path = directory.path().join("binary.md");
        fs::write(&binary_path, [0xff, 0xfe]).expect("binary fixture write");
        assert!(matches!(
            read_document(&binary_path),
            Err(CommandError::InvalidEncoding)
        ));

        let text_path = directory.path().join("document.txt");
        fs::write(&text_path, "text").expect("text fixture write");
        assert!(matches!(
            read_document(&text_path),
            Err(CommandError::UnsupportedExtension)
        ));
    }

    #[test]
    fn rejects_files_larger_than_the_bounded_document_limit() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("large.md");
        let file = File::create(&path).expect("large fixture create");
        file.set_len(MAX_DOCUMENT_BYTES + 1)
            .expect("large fixture size");

        assert!(matches!(read_document(&path), Err(CommandError::TooLarge)));
    }

    #[test]
    fn validates_opaque_request_identifiers_and_save_suggestions() {
        assert!(is_content_fingerprint(&"a".repeat(64)));
        assert!(!is_content_fingerprint(&"g".repeat(64)));
        assert!(!is_content_fingerprint("short"));
        assert!(validate_suggested_name("document.md".to_owned()).is_ok());
        assert!(validate_suggested_name("../document.md".to_owned()).is_err());
        assert!(validate_suggested_name("folder\\document.md".to_owned()).is_err());
    }
}
