/**
 * Action Executor
 * Execute parsed actions using Playwright
 * Supports element-based, coordinate-based, and keyboard actions
 */
const { ActionType } = require('./action-types');

class ActionExecutor {
    constructor(page, elementMap = {}) {
        this.page = page;
        this.elementMap = elementMap;
    }

    setElementMap(elementMap) {
        this.elementMap = elementMap;
    }

    async getElement(elementId) {
        const elementInfo = this.elementMap[elementId];
        if (!elementInfo) {
            throw new Error(`Element not found: ${elementId}`);
        }

        let element = this.page.locator(`[data-uuid="${elementId}"]`);
        if (await element.count() > 0) {
            return element.first();
        }

        if (elementInfo.xpath) {
            element = this.page.locator(`xpath=${elementInfo.xpath}`);
            if (await element.count() > 0) {
                return element.first();
            }
        }

        throw new Error(`Could not locate element: ${elementId}`);
    }

    async getElementCenter(elementId) {
        const element = await this.getElement(elementId);
        const box = await element.boundingBox();
        if (!box) {
            throw new Error(`Element ${elementId} has no bounding box`);
        }
        return {
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2)
        };
    }

    async execute(action) {
        const result = {
            action_type: action.action_type,
            element_id: action.element_id,
            success: false,
            timestamp: new Date().toISOString(),
            error: null
        };

        try {
            switch (action.action_type) {
                case ActionType.CLICK:
                    await this.executeClick(action);
                    break;
                case ActionType.INPUT_TEXT:
                    await this.executeInputText(action);
                    break;
                case ActionType.SELECT_OPTION:
                    await this.executeSelectOption(action);
                    break;
                case ActionType.HOVER:
                    await this.executeHover(action);
                    break;
                case ActionType.UPLOAD_FILE:
                    await this.executeUploadFile(action);
                    break;
                case ActionType.CLICK_COORDS:
                    await this.executeClickCoords(action);
                    break;
                case ActionType.MOVE_MOUSE:
                    await this.executeMoveMouse(action);
                    break;
                case ActionType.DRAG:
                    await this.executeDrag(action);
                    break;
                case ActionType.KEYPRESS:
                    await this.executeKeypress(action);
                    break;
                case ActionType.TYPE_TEXT:
                    await this.executeTypeText(action);
                    break;
                case ActionType.SCROLL:
                    await this.executeScroll(action);
                    break;
                case ActionType.GOTO_URL:
                    await this.executeGotoUrl(action);
                    break;
                case ActionType.RELOAD:
                    await this.page.reload({ waitUntil: 'domcontentloaded' });
                    break;
                case ActionType.GO_BACK:
                    await this.page.goBack({ waitUntil: 'domcontentloaded' });
                    break;
                case ActionType.GO_FORWARD:
                    await this.page.goForward({ waitUntil: 'domcontentloaded' });
                    break;
                case ActionType.WAIT:
                    await this.executeWait(action);
                    break;
                case ActionType.EXTRACT:
                    result.extracted_data = action.extracted_data;
                    break;
                case ActionType.COMPLETE:
                    result.extracted_data = action.extracted_data;
                    break;
                case ActionType.TERMINATE:
                    result.errors = action.errors;
                    break;
                default:
                    throw new Error(`Unknown action type: ${action.action_type}`);
            }
            result.success = true;
        } catch (error) {
            result.success = false;
            result.error = error.message;
            console.error(`  [error] ${error.message}`);
        }

        return result;
    }

    // Element-based actions
    async executeClick(action) {
        const element = await this.getElement(action.element_id);
        await element.click({ button: action.button || 'left' });
    }

    async executeInputText(action) {
        const element = await this.getElement(action.element_id);
        await element.fill('');
        await element.fill(action.text);
    }

    async executeSelectOption(action) {
        const element = await this.getElement(action.element_id);
        const option = action.option;
        if (option.value) {
            await element.selectOption({ value: option.value });
        } else if (option.label) {
            await element.selectOption({ label: option.label });
        } else if (option.index !== undefined) {
            await element.selectOption({ index: option.index });
        }
    }

    async executeHover(action) {
        const element = await this.getElement(action.element_id);
        await element.hover();
        if (action.hold_seconds > 0) {
            await this.page.waitForTimeout(action.hold_seconds * 1000);
        }
    }

    async executeUploadFile(action) {
        const element = await this.getElement(action.element_id);
        await element.setInputFiles(action.file_path);
    }

    // Coordinate-based actions
    async executeClickCoords(action) {
        await this.page.mouse.click(action.x, action.y, {
            button: action.button || 'left',
            clickCount: action.click_count || 1
        });
    }

    async executeMoveMouse(action) {
        await this.page.mouse.move(action.x, action.y, { steps: action.steps || 10 });
    }

    async executeDrag(action) {
        await this.page.mouse.move(action.start_x, action.start_y);
        await this.page.mouse.down();
        await this.page.mouse.move(action.end_x, action.end_y, { steps: 20 });
        await this.page.mouse.up();
    }

    // Keyboard actions
    async executeKeypress(action) {
        const keys = action.keys || ['Enter'];
        if (action.combo) {
            for (const key of keys) {
                await this.page.keyboard.down(key);
            }
            for (const key of keys.reverse()) {
                await this.page.keyboard.up(key);
            }
        } else {
            for (const key of keys) {
                await this.page.keyboard.press(key);
            }
        }
    }

    async executeTypeText(action) {
        await this.page.keyboard.type(action.text || '', { delay: action.delay || 50 });
    }

    // Navigation actions
    async executeScroll(action) {
        const direction = action.direction || 'down';
        const amount = action.amount || 300;

        if (action.x !== undefined && action.y !== undefined) {
            await this.page.mouse.move(action.x, action.y);
        }

        let deltaX = 0, deltaY = 0;
        switch (direction) {
            case 'up': deltaY = -amount; break;
            case 'down': deltaY = amount; break;
            case 'left': deltaX = -amount; break;
            case 'right': deltaX = amount; break;
        }

        await this.page.mouse.wheel(deltaX, deltaY);
    }

    async executeGotoUrl(action) {
        await this.page.goto(action.url, { waitUntil: 'domcontentloaded' });
    }

    // Control actions
    async executeWait(action) {
        await this.page.waitForTimeout((action.seconds || 2) * 1000);
    }
}

module.exports = { ActionExecutor };
