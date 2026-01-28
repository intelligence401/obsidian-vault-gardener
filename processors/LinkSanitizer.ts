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
                // Ignore errors
            }
        }
        return count;
    }

    sanitizeContent(text: string): string {
        let working = text;
        const masks: string[] = [];
        const createMask = (match: string) => {
            masks.push(match);
            return `___MASK_${masks.length - 1}___`;
        };

        working = working.replace(REGEX_PATTERNS.MASK_YAML, createMask);
        working = working.replace(REGEX_PATTERNS.MASK_CODE, createMask);
        
        working = working.replace(/\$\\beta\$\s+\$a\$/g, 'β');
        working = working.replace(/\$\\alpha\$\s+\$a\$/g, 'α');

        working = working.replace(/([^-\s]):\|/g, '$1:\n\n|');

        working = working.replace(/\[\[((?:[^|\]]|\\\|)+?)\s*\|\s*/g, '[[$1|');

        working = working.replace(/\\\]\]/g, ']]');

        working = this.fixUnbalancedUnderscores(working);

        working = working.replace(REGEX_PATTERNS.LINK_WITH_UNDERSCORE_ALIAS, (match: string, target: string, alias: string) => {
            if (/^_[a-zA-Z][0-9]?_$/.test(alias)) {
                return match; 
            }
            const inner = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            if (target.toLowerCase() === inner.toLowerCase()) return `_[[${target}]]_`;
            return `_[[${target}|${inner}]]_`;
        });

        const doubleWrapperRegex = /_(\[\[[^|]+\|_[a-zA-Z][0-9]?_\]\])_/g;
        working = working.replace(doubleWrapperRegex, "$1");

        const precedingContextRegex = /([a-zA-Z0-9]+)[ \t]+\[\[([^\]|]+)\|([^\]]+)\]\]/g;
        working = working.replace(precedingContextRegex, (match: string, word: string, target: string, alias: string) => {
            const potentialKey = `${word} ${alias}`.toLowerCase();
            const potentialTarget = `${word} ${alias}`;
            
            if (potentialTarget.toLowerCase() === target.toLowerCase()) {
                return `[[${target}]]`;
            }
            if (this.combinedMap.has(potentialKey)) {
                const mapTargets = this.combinedMap.get(potentialKey);
                if (mapTargets && mapTargets.length > 0) {
                    return `[[${mapTargets[0]}]]`; 
                }
            }
            return match;
        });

        const forwardContextRegex = /\[\[([^\]|]+)\]\][ \t]+([a-zA-Z0-9]+)/g;
        working = working.replace(forwardContextRegex, (match: string, target: string, word: string) => {
            const potentialKey = `${target} ${word}`.toLowerCase();
            if (this.combinedMap.has(potentialKey)) {
                const mapTargets = this.combinedMap.get(potentialKey);
                if (mapTargets && mapTargets.some(t => t.toLowerCase() === potentialKey)) {
                    const canonical = mapTargets.find(t => t.toLowerCase() === potentialKey) || `${target} ${word}`;
                    return `[[${canonical}]]`;
                }
            }
            return match;
        });

        const redundantContextRegex = /([a-zA-Z0-9]+)[ \t]+\[\[([^\]|]+)\]\]/g;
        working = working.replace(redundantContextRegex, (match: string, word: string, target: string) => {
             if (target.toLowerCase().startsWith(word.toLowerCase())) {
                 return `[[${target}]]`;
             }
             return match;
        });

        const ghostRegex = /\[\[([^\]|]+)\]\]/g;
        working = working.replace(ghostRegex, (match: string, content: string) => {
            if (content.includes('/')) return match; 
            const key = content.toLowerCase();
            if (this.combinedMap.has(key)) {
                const targets = this.combinedMap.get(key);
                if (targets && !targets.includes(content)) {
                     return `[[${targets[0]}|${content}]]`;
                }
            }
            return match;
        });

        const VALIDATION_REGEX = /\[\[((?:[^|\]]|\\\|)+?)\|([^\]]+)\]\]/g;
        working = working.replace(VALIDATION_REGEX, (match: string, targetRaw: string, aliasRaw: string) => {
            const target = targetRaw.trim();
            const alias = aliasRaw.trim();
            
            let effectiveTarget = target;
            if (effectiveTarget.endsWith('\\')) {
                effectiveTarget = effectiveTarget.slice(0, -1);
            }

            const aliasLower = alias.toLowerCase();
            const cleanAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();

            if (effectiveTarget.toLowerCase() === alias.toLowerCase()) return `[[${effectiveTarget}]]`;

            let isValid = false;
            
            if (this.combinedMap.has(aliasLower)) {
                 const registered = this.combinedMap.get(aliasLower);
                 if (registered && registered.some(t => t.toLowerCase() === effectiveTarget.toLowerCase())) isValid = true;
            }

            if (!isValid && this.combinedMap.has(cleanAlias)) {
                const registered = this.combinedMap.get(cleanAlias);
                if (registered && registered.some(t => t.toLowerCase() === effectiveTarget.toLowerCase())) isValid = true;
            }

            if (!isValid) {
                const wrappedAlias = `_${cleanAlias}_`;
                if (this.combinedMap.has(wrappedAlias)) {
                    const registered = this.combinedMap.get(wrappedAlias);
                    if (registered && registered.some(t => t.toLowerCase() === effectiveTarget.toLowerCase())) isValid = true;
                }
            }

            if (isValid) return match;

            if (/^\$?[a-zA-Z][0-9]?\$?$/.test(alias) || /^\$[a-zA-Z]+\$$/.test(alias)) {
                return ""; 
            }

            return `[[${effectiveTarget}]]`;
        });

        return working.replace(/___MASK_(\d+)___/g, (m, i) => masks[parseInt(String(i), 10)] || m);
    }

    private fixUnbalancedUnderscores(text: string): string {
        return text.replace(/(_\[\[[^\]]+\]\])(?=[^_\n]|$)/g, "$1_");
    }
}