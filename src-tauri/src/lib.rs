use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn authorize_workspace_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
  app
    .fs_scope()
    .allow_directory(path, true)
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_default_workspace_directory(app: tauri::AppHandle) -> Result<String, String> {
  let path = app
    .path()
    .data_dir()
    .map_err(|error| error.to_string())?
    .join("shotAgent");

  std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
  app
    .fs_scope()
    .allow_directory(&path, true)
    .map_err(|error| error.to_string())?;

  Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      authorize_workspace_directory,
      get_default_workspace_directory,
    ])
    .run(tauri::generate_context!())
    .expect("failed to run shot-agent desktop shell");
}

