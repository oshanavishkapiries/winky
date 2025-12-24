"""
Browser Automation Setup Script
===============================
This script creates a virtual environment and installs all dependencies.
Run: python setup.py
"""

import subprocess
import sys
import os
from pathlib import Path


def print_header(text: str) -> None:
    """Print a styled header."""
    print("\n" + "=" * 50)
    print(f"  {text}")
    print("=" * 50)


def print_step(step_num: int, total: int, message: str) -> None:
    """Print a step message."""
    print(f"\n[{step_num}/{total}] {message}")


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"✅ {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    print(f"❌ {message}")


def run_command(command: list, description: str) -> bool:
    """Run a command and return success status."""
    try:
        result = subprocess.run(command, check=True, capture_output=False)
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed: {description}")
        return False


def get_venv_python() -> str:
    """Get the path to the Python executable in the virtual environment."""
    if sys.platform == "win32":
        return str(Path("venv") / "Scripts" / "python.exe")
    return str(Path("venv") / "bin" / "python")


def get_venv_pip() -> str:
    """Get the path to pip in the virtual environment."""
    if sys.platform == "win32":
        return str(Path("venv") / "Scripts" / "pip.exe")
    return str(Path("venv") / "bin" / "pip")


def get_venv_playwright() -> str:
    """Get the path to playwright in the virtual environment."""
    if sys.platform == "win32":
        return str(Path("venv") / "Scripts" / "playwright.exe")
    return str(Path("venv") / "bin" / "playwright")


def main() -> None:
    """Main setup function."""
    print_header("Browser Automation Setup")
    
    total_steps = 4
    
    # Step 1: Create virtual environment
    print_step(1, total_steps, "Creating virtual environment...")
    if not run_command([sys.executable, "-m", "venv", "venv"], "create venv"):
        sys.exit(1)
    print_success("Virtual environment created!")
    
    # Step 2: Upgrade pip
    print_step(2, total_steps, "Upgrading pip...")
    venv_python = get_venv_python()
    if not run_command([venv_python, "-m", "pip", "install", "--upgrade", "pip"], "upgrade pip"):
        sys.exit(1)
    print_success("Pip upgraded!")
    
    # Step 3: Install dependencies
    print_step(3, total_steps, "Installing dependencies from requirements.txt...")
    venv_pip = get_venv_pip()
    if not run_command([venv_pip, "install", "-r", "requirements.txt"], "install requirements"):
        sys.exit(1)
    print_success("Dependencies installed!")
    
    # Step 4: Install Playwright browsers
    print_step(4, total_steps, "Installing Playwright browsers...")
    venv_playwright = get_venv_playwright()
    if not run_command([venv_playwright, "install", "chromium"], "install playwright browsers"):
        sys.exit(1)
    print_success("Playwright browsers installed!")
    
    # Done
    print_header("Setup Completed Successfully! 🎉")
    
    print("\n📌 Next steps:")
    print("-" * 40)
    
    if sys.platform == "win32":
        print("1. Activate virtual environment:")
        print("   .\\venv\\Scripts\\Activate.ps1")
    else:
        print("1. Activate virtual environment:")
        print("   source venv/bin/activate")
    
    print("\n2. Run the test script:")
    print("   python test_init.py")
    print()


if __name__ == "__main__":
    main()
