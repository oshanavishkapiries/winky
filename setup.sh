#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "Setting up Winky Playwright Scraper"
echo "========================================="
echo ""

echo "[1/2] Installing Node.js dependencies..."
npm install

echo ""
echo "[2/2] Installing Playwright Chromium browser..."
npx playwright install chromium

echo ""
echo "========================================="
echo "Setup completed successfully!"
echo "You can now run the scraper using: npm run dev"
echo "========================================="
