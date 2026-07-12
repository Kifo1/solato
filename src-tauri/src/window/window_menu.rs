use tauri::{
    menu::{MenuBuilder, SubmenuBuilder},
    App,
};

use crate::log;

pub fn build_window_menu(app: &mut App) -> Result<(), tauri::Error> {
    let help_menu = SubmenuBuilder::new(app, "Help")
        .text("github", "Github")
        .build()?;

    let menu = MenuBuilder::new(app).items(&[&help_menu]).build()?;

    app.set_menu(menu)?;

    app.on_menu_event(
        move |_app_handle: &tauri::AppHandle, event| match event.id().0.as_str() {
            "github" => {
                let _ = open::that("https://github.com/Kifo1/solato");
            }
            _ => {
                log!(
                    "ERROR",
                    format!("Unknown menu item clicked: {}", event.id().0)
                );
            }
        },
    );

    Ok(())
}
