"""
Browser Manager
===============
Manages browser lifecycle with undetected-playwright for stealth mode.
"""

import asyncio
import os
from typing import Optional

# Try undetected-playwright first, fallback to regular playwright
try:
    from undetected_playwright.async_api import async_playwright, Browser, BrowserContext, Page
    USING_UNDETECTED = True
except ImportError:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    USING_UNDETECTED = False

from playwright_stealth import stealth_async

import sys
sys.path.insert(0, '..')
from config import PlaywrightConfig


# Advanced stealth scripts to inject
STEALTH_SCRIPTS = """
// Hide webdriver property
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
});

// Override the navigator.plugins to have length > 0
Object.defineProperty(navigator, 'plugins', {
    get: () => {
        return [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
    },
    configurable: true
});

// Override navigator.languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    configurable: true
});

// Fix Chrome detection
window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {}
};
"""


class BrowserManager:
    """Manages browser with undetected-playwright for stealth."""
    
    def __init__(self):
        """Initialize browser manager."""
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._is_initialized = False
    
    async def initialize(self) -> Page:
        """
        Initialize browser and return page.
        
        Returns:
            Playwright Page instance
        """
        if self._is_initialized:
            return self.page
        
        print("🌐 Initializing browser...")
        if USING_UNDETECTED:
            print("🛡️ Using undetected-playwright for stealth")
        PlaywrightConfig.print_config()
        
        # Create profile directory if using profiles
        if PlaywrightConfig.USE_BROWSER_PROFILE:
            profile_path = os.path.abspath(PlaywrightConfig.BROWSER_PROFILE_PATH)
            os.makedirs(profile_path, exist_ok=True)
            print(f"📂 Using persistent profile: {profile_path}")
        
        # Start Playwright
        self.playwright = await async_playwright().start()
        
        # Get launch options
        launch_options = PlaywrightConfig.get_launch_options()
        
        # Use persistent context if profile enabled
        if PlaywrightConfig.USE_BROWSER_PROFILE:
            profile_path = os.path.abspath(PlaywrightConfig.BROWSER_PROFILE_PATH)
            
            context_options = PlaywrightConfig.get_context_options()
            context_options.update({
                "permissions": ["geolocation"],
                "geolocation": {"latitude": 51.5074, "longitude": -0.1278},
                "locale": "en-US",
            })
            
            # Remove user_data_dir from args
            args = [a for a in launch_options.get("args", []) if not a.startswith("--user-data-dir")]
            ignore_defaults = launch_options.get("ignore_default_args", [])
            
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=profile_path,
                headless=launch_options.get("headless", False),
                slow_mo=launch_options.get("slow_mo", 100),
                args=args,
                ignore_default_args=ignore_defaults,
                executable_path=launch_options.get("executable_path"),
                **context_options
            )
            
            self.browser = self.context
            
            # Apply stealth scripts
            await self.context.add_init_script(STEALTH_SCRIPTS)
            
            # Get the default page or create new one
            pages = self.context.pages
            self.page = pages[0] if pages else await self.context.new_page()
            
        else:
            # Normal browser launch without profile
            self.browser = await self.playwright.chromium.launch(**launch_options)
            
            context_options = PlaywrightConfig.get_context_options()
            context_options.update({
                "permissions": ["geolocation"],
                "geolocation": {"latitude": 51.5074, "longitude": -0.1278},
                "locale": "en-US",
            })
            
            self.context = await self.browser.new_context(**context_options)
            await self.context.add_init_script(STEALTH_SCRIPTS)
            self.page = await self.context.new_page()
        
        # Set timeouts
        self.context.set_default_timeout(PlaywrightConfig.DEFAULT_TIMEOUT)
        
        # Apply playwright-stealth
        await stealth_async(self.page)
        
        self._is_initialized = True
        print("✅ Browser initialized with stealth mode!")
        
        return self.page
    
    async def new_page(self) -> Page:
        """Create a new page in the current context."""
        if not self._is_initialized:
            return await self.initialize()
        
        page = await self.context.new_page()
        await stealth_async(page)
        return page
    
    async def get_page(self) -> Page:
        """Get the current page or initialize if needed."""
        if not self._is_initialized:
            return await self.initialize()
        return self.page
    
    async def screenshot(self, path: str = "screenshot.png") -> str:
        """Take a screenshot of the current page."""
        if self.page:
            await self.page.screenshot(path=path)
            print(f"📸 Screenshot saved: {path}")
        return path
    
    async def close(self) -> None:
        """Close browser and cleanup resources."""
        if PlaywrightConfig.USE_BROWSER_PROFILE:
            if self.context:
                await self.context.close()
                print("👋 Browser closed (profile saved)")
        else:
            if self.browser:
                await self.browser.close()
                print("👋 Browser closed")
        
        if self.playwright:
            await self.playwright.stop()
        
        self._is_initialized = False
        self.browser = None
        self.context = None
        self.page = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()


# Singleton instance
_browser_manager: Optional[BrowserManager] = None


async def get_browser_manager() -> BrowserManager:
    """Get or create the browser manager singleton."""
    global _browser_manager
    if _browser_manager is None:
        _browser_manager = BrowserManager()
    return _browser_manager
