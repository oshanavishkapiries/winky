/**
 * Generate CSV Action Plugin
 */
const { BaseAction } = require('../base-action');
const fs = require('fs');
const path = require('path');

class GenerateCSVAction extends BaseAction {
    static type = 'generate_csv';
    static requiresElement = false;
    static isTerminal = false; // It's a helper action, not necessarily a terminal one
    static description = 'Save data to a CSV file';
    static inputSchema = {
        type: 'object',
        properties: {
            filename: {
                type: 'string',
                description: 'Name of the file (e.g. products.csv)'
            },
            data: {
                type: 'array',
                description: 'Array of objects to write to CSV',
                items: {
                    type: 'object'
                }
            },
            headers: {
                type: 'array',
                description: 'Optional list of headers (if not provided, keys from first object are used)',
                items: {
                    type: 'string'
                }
            },
            append: {
                type: 'boolean',
                description: 'If true, append to existing file instead of overwriting'
            }
        },
        required: ['filename', 'data']
    };

    /**
     * Convert array of objects to CSV string
     * @param {Array<Object>} data 
     * @param {Array<string>} headers 
     * @returns {string}
     */
    convertToCSV(data, headers) {
        if (!data || data.length === 0) {
            return '';
        }

        // If headers not provided, infer from first object
        if (!headers) {
            headers = Object.keys(data[0]);
        }

        const csvRows = [];

        // Add headers row
        csvRows.push(headers.join(','));

        // Add data rows
        for (const row of data) {
            const values = headers.map(header => {
                const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    /**
     * Convert data frame-like output (just values) for appending
     * @param {Array<Object>} data 
     * @param {Array<string>} headers 
     */
    convertToCSVRows(data, headers) {
        if (!data || data.length === 0) return '';

        // If appending, we need to know the headers of the existing file or the target structure
        // If not provided, we infer from first object, but this assumes consistency with existing file
        if (!headers) {
            headers = Object.keys(data[0]);
        }

        const csvRows = [];
        for (const row of data) {
            const values = headers.map(header => {
                const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }

    async execute({ filename, data, headers, append = false }) {
        if (!filename) {
            return { success: false, error: 'Filename is required' };
        }
        if (!data || !Array.isArray(data)) {
            return { success: false, error: 'Data must be an array of objects' };
        }

        try {
            // Determine output path (safe sandbox in data/output)
            // We assume a DATA_DIR or default to valid relative path
            const baseDir = process.env.DATA_DIR
                ? path.join(path.resolve(process.env.DATA_DIR), 'output')
                : path.join(__dirname, '..', '..', '..', '..', 'data', 'output');

            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }

            const filePath = path.join(baseDir, filename);
            let csvContent = '';

            // Logic for append vs new
            if (append && fs.existsSync(filePath)) {
                // precise header matching is hard without reading the file, 
                // so we trust the agent/user to provide consistent data structures.
                // We only generate rows, no header.
                // However, we still need 'headers' array to order the keys correctly.
                // If headers arg is missing, we infer from data[0].
                csvContent = '\n' + this.convertToCSVRows(data, headers);
                fs.appendFileSync(filePath, csvContent);
            } else {
                csvContent = this.convertToCSV(data, headers);
                fs.writeFileSync(filePath, csvContent);
            }

            return {
                success: true,
                data: {
                    path: filePath,
                    rows: data.length,
                    message: `Saved ${data.length} rows to ${filename}`
                }
            };
        } catch (error) {
            return { success: false, error: `Failed to write CSV: ${error.message}` };
        }
    }
}

module.exports = GenerateCSVAction;
