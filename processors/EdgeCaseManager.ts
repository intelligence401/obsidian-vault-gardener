import { App, TFile } from 'obsidian';
import { VaultIndexData } from '../utils/AsyncVaultIndex';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';

export class EdgeCaseManager {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    async process(files: TFile[], indexData: VaultIndexData): Promise<number> {
        let count = 0;
        const greekKeys = new Set<string>();
        for (const key of indexData.uniqueMap.keys()) {
            if (key.startsWith('$') || key.includes('\\')) {
                greekKeys.add(key);
            }
        }

        for (const file of files) {
            if (file.extension !== 'md') continue;
            try {
                const originalContent = await this.app.vault.read(file);
                let working = originalContent;
                
                const unbalancedEnd = /(_\[\[[^\]]+\]\])(?=[^_\n]|$)/g;
                if (unbalancedEnd.test(working)) {
                    working = working.replace(unbalancedEnd, "$1_");
                }

                const slashPattern = /\[\[(?:[^|\]]+\|)?([^\]]+)\]\](\/[a-zA-Z0-9]+_)/g;
                
                if (slashPattern.test(working)) {
                    working = working.replace(slashPattern, "$1$2");
                }

                const masks: string[] = [];
                const maskText = (text: string, regex: RegExp) => {
                    return text.replace(regex, (m) => {
                        masks.push(m);
                        return `___EDGE_MASK_${masks.length - 1}___`;
                    });
                };

                working = maskText(working, REGEX_PATTERNS.MASK_YAML);
                working = maskText(working, REGEX_PATTERNS.MASK_CODE);
                working = maskText(working, /\[\[[^\]]+\]\]/g);

                const greekPattern = /(\$\\[a-zA-Z]+(?:\$)?-[a-zA-Z0-9]+)/g;
                working = working.replace(greekPattern, (match) => {
                    const key = match.toLowerCase();
                    if (greekKeys.has(key)) {
                        const target = indexData.uniqueMap.get(key) || indexData.multiMap.get(key)?.[0];
                        if (target) {
                            return `[[${target}|${match}]]`;
                        }
                    }
                    return match;
                });

                working = working.replace(/___EDGE_MASK_(\d+)___/g, (m, i) => masks[parseInt(String(i), 10)] || m);

                if (working !== originalContent) {
                    await this.app.vault.process(file, () => working);
                    count++;
                }

            } catch {
                // Ignore
            }
        }
        
        return count;
    }
}