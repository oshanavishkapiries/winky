/**
 * WKY Converter - Convert between .json and .wky formats
 * 
 * .wky (Winky) format - JSON with .wky extension 🐕
 * 
 * Usage:
 *   npm run wky:convert <file> [--to-wky | --to-json]
 * 
 * Examples:
 *   npm run wky:convert data/logs/log_20251216.json --to-wky
 *   npm run wky:convert data/workflows/login.wky --to-json
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert JSON log to WKY workflow
 */
function jsonToWky(jsonPath, outputPath = null) {
    const absolutePath = path.isAbsolute(jsonPath)
        ? jsonPath
        : path.join(process.cwd(), jsonPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    // Read JSON
    const content = fs.readFileSync(absolutePath, 'utf8');
    const data = JSON.parse(content);

    // Output path: same name but .wky extension
    const outPath = outputPath || absolutePath.replace(/\.json$/, '.wky');

    // Write WKY (same content, different extension)
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`✓ Converted: ${path.basename(absolutePath)} → ${path.basename(outPath)}`);
    return outPath;
}

/**
 * Convert WKY workflow to JSON
 */
function wkyToJson(wkyPath, outputPath = null) {
    const absolutePath = path.isAbsolute(wkyPath)
        ? wkyPath
        : path.join(process.cwd(), wkyPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    // Read WKY
    const content = fs.readFileSync(absolutePath, 'utf8');
    const data = JSON.parse(content);

    // Output path: same name but .json extension
    const outPath = outputPath || absolutePath.replace(/\.wky$/, '.json');

    // Write JSON
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`✓ Converted: ${path.basename(absolutePath)} → ${path.basename(outPath)}`);
    return outPath;
}

// CLI entry point
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('🐕 WKY Converter - Convert between .json and .wky\n');
        console.log('Usage: npm run wky:convert <file> [--to-wky | --to-json] [--output <path>]');
        console.log('\nExamples:');
        console.log('  npm run wky:convert data/logs/log_20251216.json --to-wky');
        console.log('  npm run wky:convert data/workflows/login.wky --to-json');
        console.log('  npm run wky:convert log.json --to-wky --output workflows/my-flow.wky');
        process.exit(1);
    }

    let filePath = null;
    let toWky = false;
    let toJson = false;
    let outputPath = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--to-wky') {
            toWky = true;
        } else if (args[i] === '--to-json') {
            toJson = true;
        } else if (args[i] === '--output' && args[i + 1]) {
            outputPath = args[i + 1];
            i++;
        } else if (!args[i].startsWith('--')) {
            filePath = args[i];
        }
    }

    if (!filePath) {
        console.error('Error: No file specified');
        process.exit(1);
    }

    try {
        // Auto-detect direction if not specified
        if (!toWky && !toJson) {
            if (filePath.endsWith('.json')) {
                toWky = true;
            } else if (filePath.endsWith('.wky')) {
                toJson = true;
            } else {
                console.error('Error: Cannot auto-detect format. Use --to-wky or --to-json');
                process.exit(1);
            }
        }

        if (toWky) {
            jsonToWky(filePath, outputPath);
        } else if (toJson) {
            wkyToJson(filePath, outputPath);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

main();

module.exports = { jsonToWky, wkyToJson };
