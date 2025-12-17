/**
 * Select Option Action Plugin
 */
const { BaseAction } = require('../base-action');

class SelectOptionAction extends BaseAction {
    static type = 'select_option';
    static requiresElement = true;
    static description = 'Select an option from a dropdown';
    static inputSchema = {
        type: 'object',
        properties: {
            element_id: {
                type: 'string',
                description: 'UUID of the select element'
            },
            value: {
                type: 'string',
                description: 'Value to select'
            }
        },
        required: ['element_id', 'value']
    };

    async execute({ element_id, value }) {
        try {
            const element = await this.getElement(element_id);
            await element.selectOption(value);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = SelectOptionAction;
