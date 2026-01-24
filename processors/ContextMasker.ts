import { REGEX_PATTERNS } from '../utils/RegexPatterns';

export class ContextMasker {
    private masks: string[] = [];

    mask(text: string, aliasMap?: Map<string, string>): string {
        this.masks = [];
        let workingText = text;

        const createMask = (match: string) => {
            if (aliasMap && match.startsWith('$')) {
                
                const cleanKey = match.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();
                
                if (aliasMap.has(cleanKey)) {
                    return match;
                }
            }

            this.masks.push(match);
            return `___MASK_${this.masks.length - 1}___`;
        };

        workingText = workingText.replace(REGEX_PATTERNS.MASK_YAML, createMask);
        
        workingText = workingText.replace(REGEX_PATTERNS.MASK_AREAS, createMask);

        return workingText;
    }

    unmask(text: string): string {
        return text.replace(/___MASK_(\d+)___/g, (match, indexStr) => {
            const index = parseInt(indexStr, 10);
            if (index >= 0 && index < this.masks.length) {
                return this.masks[index];
            }
            console.error(`ContextMasker: Could not restore mask ${index}`);
            return match;
        });
    }
}