use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedGeneratedMedia {
  asset_name: String,
  asset_path: String,
  mime_type: String,
}

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

#[tauri::command]
async fn download_generated_media_to_canvas_folder(
  root_path: String,
  canvas_folder_name: String,
  url: String,
  file_name: String,
  kind: String,
) -> Result<SavedGeneratedMedia, String> {
  tauri::async_runtime::spawn_blocking(move || {
    download_generated_media_to_canvas_folder_blocking(
      root_path,
      canvas_folder_name,
      url,
      file_name,
      kind,
    )
  })
  .await
  .map_err(|error| error.to_string())?
}

fn download_generated_media_to_canvas_folder_blocking(
  root_path: String,
  canvas_folder_name: String,
  url: String,
  file_name: String,
  kind: String,
) -> Result<SavedGeneratedMedia, String> {
  let media_dir_name = match kind.as_str() {
    "video" => "videos",
    "cover" => "covers",
    "image" => "images",
    _ => return Err("unsupported generated media kind".to_string()),
  };
  let fallback_mime_type = if kind == "video" { "video/mp4" } else { "image/png" };
  let target_dir = std::path::PathBuf::from(root_path)
    .join(sanitize_path_segment(&canvas_folder_name))
    .join("assets")
    .join(media_dir_name);

  std::fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

  let response = reqwest::blocking::Client::new()
    .get(url)
    .send()
    .map_err(|error| error.to_string())?
    .error_for_status()
    .map_err(|error| error.to_string())?;
  let mime_type = response
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .map(|value| value.split(';').next().unwrap_or(value).trim().to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| fallback_mime_type.to_string());
  let extension = extension_for_mime_type(&mime_type, &kind);
  let asset_name = make_unique_file_name(
    &target_dir,
    &ensure_file_extension(&sanitize_file_name(&file_name), extension),
  );
  let bytes = response.bytes().map_err(|error| error.to_string())?;

  std::fs::write(target_dir.join(&asset_name), bytes).map_err(|error| error.to_string())?;

  let asset_path = format!("assets/{}/{}", media_dir_name, asset_name);

  Ok(SavedGeneratedMedia {
    asset_name,
    asset_path,
    mime_type,
  })
}

fn sanitize_path_segment(input: &str) -> String {
  let sanitized = input
    .chars()
    .map(|character| match character {
      '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
      _ => character,
    })
    .collect::<String>()
    .trim()
    .to_string();

  if sanitized.is_empty() {
    "canvas".to_string()
  } else {
    sanitized
  }
}

fn sanitize_file_name(input: &str) -> String {
  let file_name = std::path::Path::new(input)
    .file_name()
    .and_then(|value| value.to_str())
    .unwrap_or("generated");
  sanitize_path_segment(file_name)
}

fn ensure_file_extension(file_name: &str, extension: &str) -> String {
  if file_name.to_lowercase().ends_with(extension) {
    file_name.to_string()
  } else {
    format!("{}{}", file_name, extension)
  }
}

fn extension_for_mime_type(mime_type: &str, kind: &str) -> &'static str {
  match mime_type {
    "video/webm" => ".webm",
    "video/quicktime" => ".mov",
    "image/jpeg" => ".jpg",
    "image/webp" => ".webp",
    "image/gif" => ".gif",
    "image/png" => ".png",
    _ if kind == "video" => ".mp4",
    _ => ".png",
  }
}

fn make_unique_file_name(directory: &std::path::Path, file_name: &str) -> String {
  let path = std::path::Path::new(file_name);
  let stem = path
    .file_stem()
    .and_then(|value| value.to_str())
    .filter(|value| !value.is_empty())
    .unwrap_or("generated");
  let extension = path.extension().and_then(|value| value.to_str());
  let mut candidate = file_name.to_string();
  let mut index = 1;

  while directory.join(&candidate).exists() {
    candidate = match extension {
      Some(extension) if !extension.is_empty() => format!("{}-{}.{}", stem, index, extension),
      _ => format!("{}-{}", stem, index),
    };
    index += 1;
  }

  candidate
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
      download_generated_media_to_canvas_folder,
    ])
    .run(tauri::generate_context!())
    .expect("failed to run shot-agent desktop shell");
}

