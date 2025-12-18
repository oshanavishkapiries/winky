
/**
 * NetworkMonitor - Captures and analyzes network traffic
 */
class NetworkMonitor {
    constructor(page) {
        this.page = page;
        this.isMonitoring = false;
        this.requests = [];
        this.maxRequests = 500;

        // Bind handlers
        this.onRequest = this.onRequest.bind(this);
        this.onResponse = this.onResponse.bind(this);
    }

    /**
     * Start monitoring network traffic
     */
    start() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.page.on('request', this.onRequest);
        this.page.on('response', this.onResponse);
        console.log('[NetworkMonitor] Started monitoring');
    }

    /**
     * Stop monitoring network traffic
     */
    stop() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        this.page.off('request', this.onRequest);
        this.page.off('response', this.onResponse);
        console.log('[NetworkMonitor] Stopped monitoring');
    }

    /**
     * Clear captured requests
     */
    clear() {
        this.requests = [];
    }

    /**
     * Get captured requests
     * @param {Object} options
     * @param {string} options.filter - 'all', 'xhr', 'doc', 'image', 'graphql'
     * @returns {Array}
     */
    getTraffic(options = {}) {
        const filter = options.filter || 'xhr'; // Default to interesting stuff

        return this.requests.filter(req => {
            // Filter by resource type
            if (filter === 'xhr') {
                return ['fetch', 'xhr'].includes(req.resourceType);
            }
            if (filter === 'doc') {
                return ['document', 'script', 'stylesheet'].includes(req.resourceType);
            }
            if (filter === 'image') {
                return ['image', 'media', 'font'].includes(req.resourceType);
            }
            if (filter === 'graphql') {
                // Heuristic for GraphQL
                return req.url.includes('graphql') || (req.postData && req.postData.includes('query'));
            }
            return true; // 'all'
        });
    }

    /**
     * Request handler
     */
    onRequest(request) {
        if (this.requests.length >= this.maxRequests) {
            this.requests.shift(); // Keep buffer size manageable
        }

        this.requests.push({
            id: request._guid || Date.now().toString() + Math.random(), // Fallback ID
            url: request.url(),
            method: request.method(),
            resourceType: request.resourceType(),
            postData: request.postData(),
            headers: request.headers(),
            timestamp: new Date().toISOString(),
            response: null // Will be filled later
        });
    }

    /**
     * Response handler
     */
    async onResponse(response) {
        const requestUrl = response.request().url();

        // Find matching request in buffer (search from end is faster)
        // Note: usage of request object comparison would be better if we stored the object, 
        // but keeping it simple with URL matching for the buffer
        const entry = this.requests.slice().reverse().find(r => r.url === requestUrl && !r.response);

        if (entry) {
            let body = null;
            try {
                // Only try to get body for text/json types to avoid performance hit on binary
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml')) {
                    body = await response.text();
                }
            } catch (e) {
                body = '[Error reading body]';
            }

            entry.response = {
                status: response.status(),
                headers: response.headers(),
                body: body
            };
        }
    }
}

module.exports = { NetworkMonitor };
