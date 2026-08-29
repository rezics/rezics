use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

const MENU_EVENT: &str = "rezics-text-menu";

fn item(
    app: &AppHandle,
    id: &str,
    text: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<tauri::Wry>> {
    MenuItem::with_id(app, id, text, true, accelerator)
}

pub fn attach_application_menu(app: &AppHandle) -> tauri::Result<()> {
    let new_document = item(app, "new-document", "New", Some("CmdOrCtrl+N"))?;
    let new_folder = item(app, "new-folder", "New Folder", None)?;
    let open = item(app, "open", "Open…", Some("CmdOrCtrl+O"))?;
    let save = item(app, "save", "Save", Some("CmdOrCtrl+S"))?;
    let save_as = item(app, "save-as", "Save As…", Some("CmdOrCtrl+Shift+S"))?;
    let close = item(app, "close", "Close", Some("CmdOrCtrl+W"))?;
    let close_all = item(app, "close-all", "Close All", None)?;
    let toggle_sidebar = item(app, "toggle-sidebar", "Toggle Sidebar", Some("CmdOrCtrl+B"))?;
    let source = item(app, "source", "Source", None)?;
    let preview = item(app, "preview", "Live Preview", None)?;
    let about = item(app, "about", "About", None)?;
    let preferences = item(app, "preferences", "Preferences", Some("CmdOrCtrl+,"))?;

    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_document,
            &new_folder,
            &open,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &PredefinedMenuItem::separator(app)?,
            &close,
            &close_all,
            &PredefinedMenuItem::separator(app)?,
            &preferences,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quit"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Undo"))?,
            &PredefinedMenuItem::redo(app, Some("Redo"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Cut"))?,
            &PredefinedMenuItem::copy(app, Some("Copy"))?,
            &PredefinedMenuItem::paste(app, Some("Paste"))?,
            &PredefinedMenuItem::select_all(app, Some("Select All"))?,
        ],
    )?;
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &toggle_sidebar,
            &PredefinedMenuItem::separator(app)?,
            &source,
            &preview,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::minimize(app, Some("Minimize"))?,
            &PredefinedMenuItem::maximize(app, Some("Maximize"))?,
            &PredefinedMenuItem::fullscreen(app, Some("Full Screen"))?,
        ],
    )?;
    let help = Submenu::with_items(app, "Help", true, &[&about])?;

    let menu = Menu::with_items(app, &[&file, &edit, &view, &help])?;
    if let Some(window) = app.get_webview_window("main") {
        window.set_menu(menu)?;
    } else {
        app.set_menu(menu)?;
    }
    Ok(())
}

pub fn emit_menu_command(app: &AppHandle, id: &str) {
    let _ = app.emit(MENU_EVENT, id);
}
