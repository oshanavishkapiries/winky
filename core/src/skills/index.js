/**
 * Skills Module - Export all skill-related classes
 */

const { BaseSkill } = require('./base-skill');
const { SkillOrchestrator } = require('./skill-orchestrator');

// Load all skill plugins
const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, 'plugins');
const skills = {};

// Auto-load plugins
if (fs.existsSync(pluginsDir)) {
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.skill.js'));
    for (const file of files) {
        try {
            const SkillClass = require(path.join(pluginsDir, file));
            if (SkillClass.type && SkillClass.type !== 'unknown') {
                skills[SkillClass.type] = SkillClass;
            }
        } catch (e) {
            console.error(`[skills] Failed to load ${file}:`, e.message);
        }
    }
}

module.exports = {
    BaseSkill,
    SkillOrchestrator,
    skills,
    // Re-export individual skills for convenience
    MapsScraperSkill: skills.maps_scraper
};
