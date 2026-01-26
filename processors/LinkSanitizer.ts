import { App, TFile } from 'obsidian';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';
import { VaultIndexData } from '../utils/AsyncVaultIndex';

export class LinkSanitizer {
    app: App;
    combinedMap: Map<string, string[]>;
    shortFormRegistry: Map<string, Set<string>>;

    constructor(app: App, indexData: VaultIndexData) { 
        this.app = app; 
        this.combinedMap = new Map();

        for (const [key, val] of indexData.uniqueMap.entries()) {
            this.combinedMap.set(key, [val]);
        }
        for (const [key, vals] of indexData.multiMap.entries()) {
            this.combinedMap.set(key, vals);
        }

        this.shortFormRegistry = indexData.shortFormRegistry;
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;
        for (const file of files) {
            if (file.extension !== 'md') continue;

            try {
                await this.app.vault.process(file, (text) => {
                    const clean = this.sanitizeContent(text);
                    if (clean !== text) {
                        count++;
                        return clean;
                    }
                    return text;
                });
            } catch (e) {
                console.error(`Sanitizer failed: ${file.path}`, e);
            }
        }
        return count;
    }

    sanitizeContent(text: string): string {
        const masks: string[] = [];
        const createMask = (match: string) => {
            masks.push(match);
            return `___MASK_${masks.length - 1}___`;
        };

        let working = text;
        working = working.replace(REGEX_PATTERNS.MASK_YAML, createMask);
        working = working.replace(REGEX_PATTERNS.MASK_CODE, createMask);
        
        working = working.replace(/\[\[(.*?)\\+\|\s*/g, '[[$1\\|');

        working = working.replace(REGEX_PATTERNS.LINK_WITH_UNDERSCORE_ALIAS, (match, target, alias) => {
            const inner = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            if (target.toLowerCase() === inner.toLowerCase()) return `_[[${target}]]_`;
            return `_[[${target}|${inner}]]_`;
        });

        const VALIDATION_REGEX = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
        working = working.replace(VALIDATION_REGEX, (match, targetRaw, aliasRaw) => {
            const target = targetRaw.trim();
            const alias = aliasRaw.trim();
            
            if (alias.includes('$')) return alias; 

            if (target.toLowerCase() === alias.toLowerCase()) {
                return `[[${target}]]`;
            }

            const cleanAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();
            
            if (!this.combinedMap.has(cleanAlias)) return alias; 

            const registeredTargets = this.combinedMap.get(cleanAlias);
            if (registeredTargets && !registeredTargets.some(t => t.toLowerCase() === target.toLowerCase())) {
                return match; 
            }

            return match;
        });

        return working.replace(/___MASK_(\d+)___/g, (m, i) => masks[parseInt(i, 10)] || m);
    }
}