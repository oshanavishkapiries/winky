/**
 * Keypress Action Plugin
 */
const { BaseAction } = require('../base-action');

class KeypressAction extends BaseAction {
    static type = 'keypress';
    static requiresElement = false;
    static description = 'Press a keyboard key (Enter, Escape, Tab, etc)';
    static inputSchema = {
        type: 'object',
        properties: {
            key: {
                type: 'string',
                description: 'Key to press (Enter, Tab, Escape, etc)'
            }
        },
        required: ['key']
    };

    async execute({ key }) {
        try {
            // Map common key names
            const keyMap = {
                'enter': 'Enter',
                'return': 'Enter',
                'tab': 'Tab',
                'escape': 'Escape',
                'esc': 'Escape',
                'backspace': 'Backspace',
                'delete': 'Delete',
                'arrowup': 'ArrowUp',
                'arrowdown': 'ArrowDown',
                'arrowleft': 'ArrowLeft',
                'arrowright': 'ArrowRight',
                'space': ' ',
                'home': 'Home',
                'end': 'End',
                'pageup': 'PageUp',
                'pagedown': 'PageDown'
            };

            const normalizedKey = keyMap[key?.toLowerCase()] || key;
            this.log(`keypress ${normalizedKey}`);
            await this.page.keyboard.press(normalizedKey);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = KeypressAction;
