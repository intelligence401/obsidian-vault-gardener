import { App, TFile, Notice } from 'obsidian';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';
import { VaultIndexData } from '../utils/AsyncVaultIndex';

export class LinkSanitizer {
    app: App;
    aliasMap: Map<string, string>;
    shortFormRegistry: Map<string, Set<string>>;

    constructor(app: App, indexData: VaultIndexData) { 
        this.app = app; 
        this.aliasMap = indexData.map;
        this.shortFormRegistry = indexData.shortFormRegistry;
    }

    async process(files: TFile[]) {
        let count = 0;
        for (const file of files) {
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
        if (count > 0) new Notice(`Sanitizer: Fixed/Pruned ${count} files.`);
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

        working = working.replace(REGEX_PATTERNS.LINK_WITH_UNDERSCORE_ALIAS, (match, target, alias) => {
            const inner = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            if (target.toLowerCase() === inner.toLowerCase()) return `_[[${target}]]_`;
            return `_[[${target}|${inner}]]_`;
        });

        const VALIDATION_REGEX = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

        working = working.replace(VALIDATION_REGEX, (match, targetRaw, aliasRaw) => {
            const target = targetRaw.trim();
            const alias = aliasRaw.trim();
            
            if (alias.includes('$')) {
                return alias; 
            }

            const cleanAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();

            if (!this.aliasMap.has(cleanAlias)) return alias; 

            const exactAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            if (exactAlias.length <= 3) {
                const allowedForms = this.shortFormRegistry.get(cleanAlias);
                if (allowedForms && !allowedForms.has(exactAlias)) {
                    return alias; 
                }
            }

            const registeredTarget = this.aliasMap.get(cleanAlias);
            if (registeredTarget && registeredTarget.toLowerCase() !== target.toLowerCase()) {
                return match; 
            }

            return match;
        });

        return working.replace(/___MASK_(\d+)___/g, (m, i) => masks[parseInt(i, 10)] || m);
    }
}