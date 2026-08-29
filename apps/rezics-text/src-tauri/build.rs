fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "open_markdown_document",
            "save_markdown_document",
            "save_markdown_document_as",
        ]),
    ))
    .expect("failed to prepare the REZICS Text build");
}
