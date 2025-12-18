
const { BaseAction } = require('../base-action');

class MonitorNetworkAction extends BaseAction {
    static type = 'monitor_network';
    static requiresElement = false;
    static description = 'Capture and analyze network traffic (API, XHR, GraphQL).';
    static inputSchema = {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                enum: ['start', 'stop', 'clear', 'get'],
                description: 'Command to execute',
                default: 'get'
            },
            filter: {
                type: 'string',
                enum: ['all', 'xhr', 'doc', 'image', 'graphql'],
                description: 'Filter for traffic retrieval (default: xhr)',
                default: 'xhr'
            }
        },
        required: ['command']
    };

    async execute(action) {
        // Access the monitor from the page object (will be attached by BrowserManager)
        const monitor = this.page._networkMonitor;

        if (!monitor) {
            return {
                success: false,
                error: 'NetworkMonitor is not initialized. Please restart the browser session.'
            };
        }

        const command = action.command || 'get';
        const filter = action.filter || 'xhr';

        try {
            switch (command) {
                case 'start':
                    monitor.start();
                    return { success: true, message: 'Network monitoring started.' };

                case 'stop':
                    monitor.stop();
                    return { success: true, message: 'Network monitoring stopped.' };

                case 'clear':
                    monitor.clear();
                    return { success: true, message: 'Network log cleared.' };

                case 'get':
                    const traffic = monitor.getTraffic({ filter });
                    const summary = traffic.map(t => ({
                        method: t.method,
                        url: t.url,
                        status: t.response ? t.response.status : 'pending',
                        type: t.resourceType,
                        // Truncate large bodies
                        requestBody: t.postData ? (t.postData.length > 200 ? t.postData.substring(0, 200) + '...' : t.postData) : null,
                        responseBody: t.response && t.response.body ? (t.response.body.length > 500 ? t.response.body.substring(0, 500) + '...' : t.response.body) : null
                    }));

                    return {
                        success: true,
                        message: `Retrieved ${traffic.length} requests (filter: ${filter})`,
                        data: summary
                    };

                default:
                    return { success: false, error: `Unknown command: ${command}` };
            }
        } catch (error) {
            return { success: false, error: `Monitor action failed: ${error.message}` };
        }
    }
}

module.exports = MonitorNetworkAction;
