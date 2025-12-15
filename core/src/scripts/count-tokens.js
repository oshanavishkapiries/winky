const fs = require('fs');
const path = require('path');

/**
 * Token Counter for HTML Pages
 * 
 * Estimates token count using different methods:
 * 1. Simple word-based estimation
 * 2. Character-based estimation (roughly 4 chars = 1 token for English)
 * 3. GPT-style tokenization approximation
 */

// ============================================================================
// TOKEN COUNTING FUNCTIONS
// ============================================================================

/**
 * Simple word-based token estimation
 * Roughly 1 word ≈ 1.3 tokens for English text
 */
function countTokensWordBased(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return Math.ceil(words.length * 1.3);
}

/**
 * Character-based token estimation
 * Roughly 4 characters ≈ 1 token for English text
 * For code/HTML, it's closer to 3.5 characters per token
 */
function countTokensCharBased(text) {
    return Math.ceil(text.length / 3.5);
}

/**
 * GPT-style tokenization approximation
 * This simulates BPE (Byte Pair Encoding) tokenization used by GPT models
 * More accurate than simple word/char counting
 */
function countTokensGPTStyle(text) {
    let tokenCount = 0;

    // Split into chunks that would typically be tokenized together
    const chunks = text.split(/(\s+|[<>\/="'`{}()\[\];:,.])/);

    for (const chunk of chunks) {
        if (!chunk || chunk.length === 0) continue;

        // Whitespace is usually 1 token
        if (/^\s+$/.test(chunk)) {
            tokenCount += 1;
            continue;
        }

        // Single punctuation is usually 1 token
        if (chunk.length === 1 && /[<>\/="'`{}()\[\];:,.]/.test(chunk)) {
            tokenCount += 1;
            continue;
        }

        // For words/identifiers, estimate based on length
        if (chunk.length <= 4) {
            tokenCount += 1;
        } else {
            tokenCount += Math.ceil(chunk.length / 4);
        }
    }

    return tokenCount;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Count tokens in an HTML file
 */
function countHTMLTokens(filePath, options = {}) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`[error] file not found: ${absolutePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(absolutePath, 'utf8');

    // Get file stats
    const stats = fs.statSync(absolutePath);
    const fileSizeBytes = stats.size;
    const fileSizeKB = (fileSizeBytes / 1024).toFixed(2);

    // Count tokens using different methods
    const wordBasedTokens = countTokensWordBased(content);
    const charBasedTokens = countTokensCharBased(content);
    const gptStyleTokens = countTokensGPTStyle(content);

    // Count HTML-specific metrics
    const lineCount = content.split('\n').length;
    const charCount = content.length;
    const tagCount = (content.match(/<[^>]+>/g) || []).length;
    const elementCount = (content.match(/<[a-zA-Z][^>]*>/g) || []).length;

    // Generate timestamp ID
    const now = new Date();
    const timestampId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    console.log('[start] token-count');
    console.log(`[file] ${path.basename(absolutePath)}`);
    console.log(`[session] ${timestampId}`);
    console.log(`[path] ${absolutePath}`);

    console.log(`[size] ${fileSizeKB} KB (${fileSizeBytes.toLocaleString()} bytes)`);
    console.log(`[chars] ${charCount.toLocaleString()}`);
    console.log(`[lines] ${lineCount.toLocaleString()}`);
    console.log(`[tags] ${tagCount.toLocaleString()}`);
    console.log(`[elements] ${elementCount.toLocaleString()}`);

    console.log(`[tokens-word] ${wordBasedTokens.toLocaleString()}`);
    console.log(`[tokens-char] ${charBasedTokens.toLocaleString()}`);
    console.log(`[tokens-gpt] ${gptStyleTokens.toLocaleString()}`);
    console.log(`[tokens-recommended] ${gptStyleTokens.toLocaleString()}`);

    console.log('[context-usage]');
    const models = [
        { name: 'GPT-3.5 (4K)', limit: 4096 },
        { name: 'GPT-3.5 (16K)', limit: 16384 },
        { name: 'GPT-4 (8K)', limit: 8192 },
        { name: 'GPT-4 (32K)', limit: 32768 },
        { name: 'GPT-4 Turbo (128K)', limit: 128000 },
        { name: 'Claude 3 (200K)', limit: 200000 },
        { name: 'Gemini Pro (1M)', limit: 1000000 }
    ];

    models.forEach(model => {
        const usage = ((gptStyleTokens / model.limit) * 100).toFixed(1);
        const fits = gptStyleTokens <= model.limit;
        const status = fits ? 'ok' : 'exceed';
        console.log(`[${status}] ${model.name}: ${usage}%`);
    });

    console.log('[done] token-count');

    // Optionally save report to file
    if (options.saveReport) {
        const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
        const reportDir = path.join(projectRoot, 'data', 'token-reports');

        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const inputName = path.basename(absolutePath, path.extname(absolutePath));
        const reportPath = path.join(reportDir, `${inputName}_${timestampId}.json`);

        const report = {
            analysisId: timestampId,
            file: path.basename(absolutePath),
            filePath: absolutePath,
            metrics: {
                fileSize: fileSizeBytes,
                characters: charCount,
                lines: lineCount,
                htmlTags: tagCount,
                htmlElements: elementCount
            },
            tokens: {
                wordBased: wordBasedTokens,
                charBased: charBasedTokens,
                gptStyle: gptStyleTokens,
                recommended: gptStyleTokens
            }
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(`[saved] ${path.relative(projectRoot, reportPath)}`);
    }

    return {
        analysisId: timestampId,
        filePath: absolutePath,
        fileSize: fileSizeBytes,
        characters: charCount,
        lines: lineCount,
        htmlTags: tagCount,
        htmlElements: elementCount,
        tokens: {
            wordBased: wordBasedTokens,
            charBased: charBasedTokens,
            gptStyle: gptStyleTokens,
            recommended: gptStyleTokens
        }
    };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node src/count-tokens.js <path-to-html-file> [--save]');
        console.log('Example: node src/count-tokens.js data/html-pages/s01.html');
        console.log('         node src/count-tokens.js data/html-pages/s01.html --save');
        process.exit(1);
    }

    const saveReport = args.includes('--save');
    const filePath = args.find(arg => !arg.startsWith('--'));

    countHTMLTokens(filePath, { saveReport });
}

module.exports = { countHTMLTokens, countTokensGPTStyle };
