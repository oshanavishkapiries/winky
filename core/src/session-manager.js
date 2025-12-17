/**
 * SessionManager - Handles session ID, action logging, and results (Single Responsibility)
 */
const fs = require('fs');
const path = require('path');

class SessionManager {
    constructor(outputDirs = {}) {
        this.outputDirs = {
            logs: outputDirs.logs || path.join(__dirname, '..', '..', 'data', 'logs'),
            output: outputDirs.output || path.join(__dirname, '..', '..', 'data', 'output')
        };

        this.sessionId = this.generateId();
        this.actionLog = [];
        this.extractedData = null;
        this.startTime = Date.now();
    }

    /**
     * Generate a timestamp-based session ID
     * @returns {string}
     */
    generateId() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    }

    /**
     * Get session ID
     * @returns {string}
     */
    getId() {
        return this.sessionId;
    }

    /**
     * Log an action
     * @param {Object} action
     */
    logAction(action) {
        this.actionLog.push({
            timestamp: new Date().toISOString(),
            ...action
        });
    }

    /**
     * Get action log
     * @returns {Array}
     */
    getActionLog() {
        return this.actionLog;
    }

    /**
     * Get last N actions for context
     * @param {number} n
     * @returns {Array}
     */
    getLastActions(n = 5) {
        return this.actionLog.slice(-n);
    }

    /**
     * Set extracted data
     * @param {Object} data
     */
    setExtractedData(data) {
        this.extractedData = data;
    }

    /**
     * Get extracted data
     * @returns {Object}
     */
    getExtractedData() {
        return this.extractedData;
    }

    /**
     * Ensure output directories exist
     */
    ensureDirs() {
        Object.values(this.outputDirs).forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, {recursive: true});
            }
        });
    }

    /**
     * Save results to files
     * @param {Object} status - Status info
     * @returns {Object} - Saved file paths
     */
    async saveResults(status) {
        this.ensureDirs();

        const endTime = Date.now();
        const duration = Math.round((endTime - this.startTime) / 1000);

        // Build results object
        const results = {
            sessionId: this.sessionId,
            status: status.status || 'completed',
            totalSteps: this.actionLog.length,
            duration: `${duration}s`,
            startTime: new Date(this.startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            actionLog: this.actionLog,
            extractedData: this.extractedData,
            outputFiles: []
        };

        // Save action log
        const logFilename = `log_${this.sessionId}.json`;
        const logPath = path.join(this.outputDirs.logs, logFilename);
        fs.writeFileSync(logPath, JSON.stringify(this.actionLog, null, 2));
        results.outputFiles.push({type: 'log', path: logPath});

        // Save extracted data if present
        if (this.extractedData) {
            const outputFilename = `output_${this.sessionId}_${this.sessionId}.json`;
            const outputPath = path.join(this.outputDirs.output, outputFilename);
            fs.writeFileSync(outputPath, JSON.stringify(this.extractedData, null, 2));
            console.log(`📋 Saved JSON: ${outputFilename}`);
            results.outputFiles.push({type: 'output', path: outputPath});
        }

        return results;
    }

    /**
     * Get session status
     * @returns {Object}
     */
    getStatus() {
        return {
            sessionId: this.sessionId,
            steps: this.actionLog.length,
            duration: Math.round((Date.now() - this.startTime) / 1000),
            hasData: !!this.extractedData
        };
    }
}

module.exports = {SessionManager};
