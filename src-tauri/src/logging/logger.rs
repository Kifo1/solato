#[macro_export]
macro_rules! log {
    ($level:expr, $msg:expr) => {{
        let color = match $level {
            "DEBUG" => "\x1b[94m", // Blue
            "INFO" => "\x1b[32m",  // Green
            "WARN" => "\x1b[33m",  // Yellow
            "ERROR" => "\x1b[31m", // Red
            _ => "\x1b[0m",        // Reset
        };
        match $level {
            "DEBUG" => println!("{}[DEBUG] {}\x1b[0m", color, $msg),
            "INFO" => println!("{}[INFO] {}\x1b[0m", color, $msg),
            "WARN" => println!("{}[WARN] {}\x1b[0m", color, $msg),
            "ERROR" => println!("{}[ERROR] {}\x1b[0m", color, $msg),
            _ => println!("{}{}\x1b[0m", color, $msg),
        }
    }};
}
