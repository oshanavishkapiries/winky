/**
 * Agent TUI - Terminal User Interface
 * Clean, minimal display for browser automation agent
 */

const readline = require('readline');

class AgentTUI {
    constructor() {
        this.currentStep = 0;
        this.maxSteps = 50;
        this.status = 'idle';
        this.startTime = null;
    }

    // Colors
    colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        red: '\x1b[31m',
        white: '\x1b[37m',
        bgGreen: '\x1b[42m'
    };

    // Print header - minimal
    printHeader(url, goal) {
        const c = this.colors;
        console.log(`\n${c.bright}[agent]${c.reset} Browser Automation Agent`);
        console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);
        console.log(`[url]  ${url.substring(0, 60)}${url.length > 60 ? '...' : ''}`);
        console.log(`[goal] ${goal.substring(0, 60)}${goal.length > 60 ? '...' : ''}`);
        console.log(`${c.dim}${'─'.repeat(50)}${c.reset}\n`);
    }

    // Simple log - no emojis, no timestamps
    log(message, type = 'info') {
        const c = this.colors;
        const prefixes = {
            'info': `${c.dim}[info]${c.reset}`,
            'success': `${c.green}[done]${c.reset}`,
            'warning': `${c.yellow}[warn]${c.reset}`,
            'error': `${c.red}[error]${c.reset}`,
            'llm': `${c.magenta}[llm]${c.reset}`,
            'cookie': `${c.yellow}[cookies]${c.reset}`,
            'nav': `${c.blue}[nav]${c.reset}`
        };
        const prefix = prefixes[type] || prefixes['info'];
        console.log(`${prefix} ${message}`);
    }

    // Print action box - clean style
    printAction(action, reasoning) {
        const c = this.colors;
        console.log(`\n${c.bgGreen}${c.white}${c.bright} ACTION ${c.reset} ${c.green}${action}${c.reset}`);
        if (reasoning) {
            const shortReason = reasoning.length > 80 ? reasoning.substring(0, 80) + '...' : reasoning;
            console.log(`${c.dim}└─ ${shortReason}${c.reset}`);
        }
    }

    // Print element info
    printElements(count) {
        const c = this.colors;
        console.log(`${c.dim}   Elements found: ${c.cyan}${count}${c.reset}`);
    }

    // Print final results
    printResults(results) {
        const c = this.colors;
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);

        console.log(`\n${c.dim}${'═'.repeat(50)}${c.reset}`);
        console.log(`${c.bright}[results]${c.reset}`);
        console.log(`  status: ${results.status}`);
        console.log(`  steps:  ${results.totalSteps}`);
        console.log(`  time:   ${elapsed}s`);

        if (results.outputFiles && results.outputFiles.length > 0) {
            console.log(`  output:`);
            results.outputFiles.forEach(f => {
                console.log(`    - ${f.path}`);
            });
        }

        if (results.extractedData?.summary) {
            console.log(`  summary: ${results.extractedData.summary}`);
        }

        console.log(`${c.dim}${'═'.repeat(50)}${c.reset}\n`);
    }

    // Start the TUI
    start(url, goal) {
        this.startTime = Date.now();
        this.status = 'initializing';
        this.printHeader(url, goal);
    }

    // Update step
    updateStep(step) {
        this.currentStep = step;
    }

    // Set status
    setStatus(status) {
        this.status = status;
    }

    // Interactive prompt
    async prompt(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            rl.question(question, answer => {
                rl.close();
                resolve(answer);
            });
        });
    }
}

module.exports = { AgentTUI };

