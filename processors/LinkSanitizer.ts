import { App, TFile } from 'obsidian';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';
import { VaultIndexData } from '../utils/AsyncVaultIndex';

export class LinkSanitizer {
    app: App;
    combinedMap: Map<string, string[]>;

    constructor(app: App, indexData: VaultIndexData) { 
        this.app = app; 
        this.combinedMap = new Map();

        for (const [key, val] of indexData.uniqueMap.entries()) {
            this.combinedMap.set(key, [val]);
        }
        for (const [key, vals] of indexData.multiMap.entries()) {
            this.combinedMap.set(key, vals);
        }
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;
        for (const file of files) {
            if (file.extension !== 'md') continue;
            try {
                const originalContent = await this.app.vault.read(file);
                const clean = this.sanitizeContent(originalContent);
                
                if (clean !== originalContent) {
                    await this.app.vault.process(file, () => clean);
                    count++;
                }
            } catch {
                // Ignore
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
        working = working.replace(/\[\[(.*?)\s*\|\s*/g, '[[$1|');

        const ulvaRegex = /_(\[\[[^\]]+\]\])_(\s*[^_\n\r]+_)/g;
        working = working.replace(ulvaRegex, '_$1$2');

        working = working.replace(REGEX_PATTERNS.LINK_WITH_UNDERSCORE_ALIAS, (match: string, target: string, alias: string) => {
            const inner = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            if (target.toLowerCase() === inner.toLowerCase()) return `_[[${target}]]_`;
            return `_[[${target}|${inner}]]_`;
        });

        const VALIDATION_REGEX = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
        working = working.replace(VALIDATION_REGEX, (match: string, targetRaw: string, aliasRaw: string) => {
            const target = targetRaw.trim();
            const alias = aliasRaw.trim();
            
            if (alias.includes('$')) return match; 
            if (target.toLowerCase() === alias.toLowerCase()) return `[[${target}]]`;

            const aliasLower = alias.toLowerCase();

            if (this.combinedMap.has(aliasLower)) {
                 const registered = this.combinedMap.get(aliasLower);
                 if (registered && registered.some(t => t.toLowerCase() === target.toLowerCase())) {
                     return match; 
                 }
            }

            const cleanAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();
            
            if (!this.combinedMap.has(cleanAlias)) {
                const wrappedAlias = `_${cleanAlias}_`;
                if (this.combinedMap.has(wrappedAlias)) {
                     const registered = this.combinedMap.get(wrappedAlias);
                     if (registered && registered.some(t => t.toLowerCase() === target.toLowerCase())) {
                         return match; 
                     }
                }

                if (alias.includes('_') && alias.includes(' ')) return match; 
                
                return alias; 
            }

            const registeredTargets = this.combinedMap.get(cleanAlias);
            if (registeredTargets && !registeredTargets.some(t => t.toLowerCase() === target.toLowerCase())) {
                return match; 
            }
            return match;
        });

        return working.replace(/___MASK_(\d+)___/g, (m: string, i: string) => masks[parseInt(String(i), 10)] || m);
    }
}