// Sem isto o Windows abre um terminal atrás da janela do app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    acutis_desktop_lib::run()
}
