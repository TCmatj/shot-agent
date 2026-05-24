fn main() {
  let app_manifest =
    tauri_build::AppManifest::new().commands(&["authorize_workspace_directory"]);
  let attributes = tauri_build::Attributes::new().app_manifest(app_manifest);

  tauri_build::try_build(attributes).expect("failed to run tauri build script");
}

