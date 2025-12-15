/**
 * Clean Data Script
 * Removes all generated files from the data folder
 * Run with: npm run clean
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Folders to clean (remove all contents but keep the folder)
const foldersToClean = [
    'action-logs',
    'element-map',
    'simplified-html',
    'output',
    'temp',
    'token-reports'
];

// Folders to keep with their contents
const foldersToKeep = [
    'html-pages'  // Keep original HTML samples
];

function cleanFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return 0;
    }

    let count = 0;
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            count += cleanFolder(filePath);
            fs.rmdirSync(filePath);
        } else {
            fs.unlinkSync(filePath);
            count++;
        }
    }

    return count;
}

function main() {
    console.log('[start] clean-data');

    let totalCleaned = 0;

    for (const folder of foldersToClean) {
        const folderPath = path.join(dataDir, folder);

        if (fs.existsSync(folderPath)) {
            const count = cleanFolder(folderPath);
            console.log(`[cleaned] ${folder}: ${count} files`);
            totalCleaned += count;
        } else {
            console.log(`[skipped] ${folder}: not found`);
        }
    }

    console.log(`[total] ${totalCleaned} files removed`);
    console.log('[done] clean-data');
}

main();
