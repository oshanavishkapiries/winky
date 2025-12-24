"""
Playwright Configuration Module
Loads settings from .env file and provides configuration for browser automation.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class PlaywrightConfig:
    """Configuration class for Playwright browser automation."""
    
    # Browser type: "local" or "playwright"
    BROWSER_TYPE: str = os.getenv("BROWSER_TYPE", "playwright")
    
    # Browser executable path (only for local browser)
    CHROME_EXECUTABLE_PATH: str = os.getenv(
        "CHROME_EXECUTABLE_PATH", 
        r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    )
    
    # Browser profile settings
    USE_BROWSER_PROFILE: bool = os.getenv("USE_BROWSER_PROFILE", "false").lower() == "true"
    BROWSER_PROFILE_PATH: str = os.getenv("BROWSER_PROFILE_PATH", "./browser_data")
    
    # Browser settings
    HEADLESS: bool = os.getenv("HEADLESS", "false").lower() == "true"
    SLOW_MO: int = int(os.getenv("SLOW_MO", "100"))
    
    # Viewport settings
    VIEWPORT_WIDTH: int = int(os.getenv("VIEWPORT_WIDTH", "1280"))
    VIEWPORT_HEIGHT: int = int(os.getenv("VIEWPORT_HEIGHT", "720"))
    
    # Timeout settings
    DEFAULT_TIMEOUT: int = int(os.getenv("DEFAULT_TIMEOUT", "30000"))
    NAVIGATION_TIMEOUT: int = int(os.getenv("NAVIGATION_TIMEOUT", "60000"))
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    @classmethod
    def is_local_browser(cls) -> bool:
        """Check if using local browser."""
        return cls.BROWSER_TYPE.lower() == "local"
    
    @classmethod
    def get_browser_args(cls) -> list:
        """Get browser launch arguments for stealth mode."""
        args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--start-maximized",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-translate",
            "--disable-features=IsolateOrigins,site-per-process",
        ]
        
        # Add profile if enabled
        if cls.USE_BROWSER_PROFILE:
            profile_path = os.path.abspath(cls.BROWSER_PROFILE_PATH)
            args.append(f"--user-data-dir={profile_path}")
        
        return args
    
    @classmethod
    def get_launch_options(cls) -> dict:
        """Get Playwright launch options based on browser type."""
        options = {
            "headless": cls.HEADLESS,
            "slow_mo": cls.SLOW_MO,
            "args": cls.get_browser_args(),
            # Exclude automation flags to bypass bot detection
            "ignore_default_args": [
                "--enable-automation",
                "--enable-blink-features=AutomationControlled",
            ],
        }
        
        # Add executable path only for local browser
        if cls.is_local_browser():
            options["executable_path"] = cls.CHROME_EXECUTABLE_PATH
            options["channel"] = None  # Don't use channel with custom executable
        
        return options
    
    @classmethod
    def get_context_options(cls) -> dict:
        """Get browser context options."""
        return {
            "viewport": {
                "width": cls.VIEWPORT_WIDTH,
                "height": cls.VIEWPORT_HEIGHT,
            },
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        }
    
    @classmethod
    def print_config(cls) -> None:
        """Print current configuration."""
        browser_info = (
            f"Local Chrome ({cls.CHROME_EXECUTABLE_PATH})" 
            if cls.is_local_browser() 
            else "Playwright Chromium"
        )
        print(f"🌐 Browser: {browser_info}")
        print(f"👁️ Headless: {cls.HEADLESS}")
        if cls.USE_BROWSER_PROFILE:
            print(f"📁 Profile: {os.path.abspath(cls.BROWSER_PROFILE_PATH)}")
        print(f"📍 Environment: {cls.ENVIRONMENT}")
