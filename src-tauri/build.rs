fn main() {
  let app_manifest = tauri_build::AppManifest::new().commands(&[
    "authorize_workspace_directory",
    "get_default_workspace_directory",
    "download_generated_media_to_canvas_folder",
  ]);
  let attributes = tauri_build::Attributes::new().app_manifest(app_manifest);

  tauri_build::try_build(attributes).expect("failed to run tauri build script");
}

