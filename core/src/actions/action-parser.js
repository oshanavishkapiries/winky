/**
 * Action Parser
 * Validate and parse LLM responses into action objects
 */
const { ActionType, requiresElement, isCoordinateAction } = require('./action-types');

/**
 * Validate and parse an action from LLM response
 * @param {Object} rawAction - Raw action object from LLM
 * @param {Object} elementMap - UUID to element info mapping
 * @returns {Object} - Validated action object
 */
function parseAction(rawAction, elementMap = {}) {
    const action = {
        action_type: rawAction.action_type?.toLowerCase() || 'wait',
        reasoning: rawAction.reasoning || 'No reasoning provided',
        timestamp: new Date().toISOString(),
        raw: rawAction,
        // Preserve LLM data for logging
        _llmData: rawAction._llmData || null
    };

    // Normalize aliases
    if (action.action_type === 'type_text') action.action_type = ActionType.INPUT_TEXT;
    if (action.action_type === 'click_element') action.action_type = ActionType.CLICK;
    if (action.action_type === 'scroll_page') action.action_type = ActionType.SCROLL;

    // Validate action type
    if (!Object.values(ActionType).includes(action.action_type)) {
        console.warn(`⚠️ Unknown action type: ${action.action_type}, defaulting to wait`);
        action.action_type = ActionType.WAIT;
        action.seconds = 2;
        return action;
    }

    // Parse action-specific fields
    switch (action.action_type) {
        // Element-based actions
        case ActionType.CLICK:
            action.element_id = rawAction.element_id;
            action.button = rawAction.button || 'left';
            break;

        case ActionType.INPUT_TEXT:
            action.element_id = rawAction.element_id;
            action.text = rawAction.text || '';
            break;

        case ActionType.SELECT_OPTION:
            action.element_id = rawAction.element_id;
            action.option = rawAction.option || {};
            break;

        case ActionType.HOVER:
            action.element_id = rawAction.element_id;
            action.hold_seconds = rawAction.hold_seconds || 0.5;
            break;

        case ActionType.UPLOAD_FILE:
            action.element_id = rawAction.element_id;
            action.file_path = rawAction.file_path || rawAction.file_url || '';
            break;

        // Coordinate-based actions
        case ActionType.CLICK_COORDS:
            action.x = rawAction.x || 0;
            action.y = rawAction.y || 0;
            action.button = rawAction.button || 'left';
            action.click_count = rawAction.click_count || 1;
            break;

        case ActionType.MOVE_MOUSE:
            action.x = rawAction.x || 0;
            action.y = rawAction.y || 0;
            action.steps = rawAction.steps || 10;
            break;

        case ActionType.DRAG:
            action.start_x = rawAction.start_x || 0;
            action.start_y = rawAction.start_y || 0;
            action.end_x = rawAction.end_x || 0;
            action.end_y = rawAction.end_y || 0;
            break;

        // Keyboard actions
        case ActionType.KEYPRESS:
            action.keys = rawAction.keys || ['Enter'];
            action.combo = rawAction.combo || false; // If true, press all keys together
            break;

        case ActionType.TYPE_TEXT:
            action.text = rawAction.text || '';
            action.delay = rawAction.delay || 50; // ms between keystrokes
            break;

        // Navigation actions
        case ActionType.SCROLL:
            action.direction = rawAction.direction || 'down';
            action.amount = rawAction.amount || 300;
            action.x = rawAction.x; // Optional scroll position
            action.y = rawAction.y;
            break;

        case ActionType.GOTO_URL:
            action.url = rawAction.url || '';
            break;

        case ActionType.RELOAD:
        case ActionType.GO_BACK:
        case ActionType.GO_FORWARD:
            // No additional fields needed
            break;

        // Control actions
        case ActionType.WAIT:
            action.seconds = rawAction.seconds || 2;
            break;

        // Data actions
        case ActionType.EXTRACT:
            action.extraction_goal = rawAction.extraction_goal || '';
            action.extracted_data = rawAction.extracted_data || null;
            break;

        case ActionType.COMPLETE:
            action.extracted_data = rawAction.extracted_data || null;
            break;

        case ActionType.TERMINATE:
            action.errors = rawAction.errors || [];
            break;
    }

    // Validate element ID for element actions
    if (requiresElement(action.action_type)) {
        if (!action.element_id) {
            console.warn(`⚠️ Action ${action.action_type} requires element_id but none provided`);
            action.valid = false;
            action.error = 'Missing element_id';
        } else if (elementMap && !elementMap[action.element_id]) {
            console.warn(`⚠️ Element ID ${action.element_id} not found in element map`);
            action.valid = false;
            action.error = `Unknown element_id: ${action.element_id}`;
        } else {
            action.valid = true;
            action.element_info = elementMap[action.element_id] || null;
        }
    } else if (isCoordinateAction(action.action_type)) {
        // Validate coordinates
        if (action.x === undefined || action.y === undefined) {
            console.warn(`⚠️ Coordinate action ${action.action_type} missing x or y coordinates`);
            action.valid = false;
            action.error = 'Missing coordinates';
        } else {
            action.valid = true;
        }
    } else {
        action.valid = true;
    }

    return action;
}

/**
 * Parse multiple actions from LLM response
 * @param {Array|Object} rawActions - Raw actions from LLM
 * @param {Object} elementMap - UUID to element info mapping
 * @returns {Array} - Array of validated actions
 */
function parseActions(rawActions, elementMap = {}) {
    const actions = Array.isArray(rawActions) ? rawActions : [rawActions];
    return actions.map(action => parseAction(action, elementMap));
}

module.exports = {
    parseAction,
    parseActions
};
