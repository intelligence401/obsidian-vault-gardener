import { App, TFile, normalizePath } from 'obsidian';
import { FrontmatterSafeOps } from './FrontmatterSafeOps';
import { ScientificTools } from '../utils/ScientificTools';
import { VaultIndexData } from '../utils/AsyncVaultIndex';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';

export class ScientificSuffixManager {
    app: App;
    fmOps: FrontmatterSafeOps;

    constructor(app: App) {
        this.app = app;
        this.fmOps = new FrontmatterSafeOps(app);
    }

    async processMaintenance(files: TFile[]): Promise<number> {
        let count = 0;
        
        for (const file of files) {
            if (file.extension !== 'md') continue;
            if (!ScientificTools.isScientificSuffixFile(file.basename)) continue;

            try {
                const originalBasename = file.basename;
                let workingName = originalBasename;

                if (/[_$][a-zA-Z][0-9]?[_$]$/.test(workingName)) {
                    const cleanName = workingName.replace(/([_$])([a-zA-Z][0-9]?)([_$])$/, '$2');
                    if (cleanName !== workingName) {
                        const newPath = normalizePath(file.parent ? `${file.parent.path}/${cleanName}.md` : `${cleanName}.md`);
                        if (!(await this.app.vault.adapter.exists(newPath))) {
                            await this.app.fileManager.renameFile(file, newPath);
                            workingName = cleanName; 
                            count++;
                        }
                    }
                }

                const modified = await this.fmOps.updateAliases(file, (existingAliases) => {
                    const cleanExisting = new Set<string>();
                    for (const alias of existingAliases) {
                        if (alias.includes('[[') || alias.includes('|')) continue; 
                        cleanExisting.add(alias);
                    }
                    return this.generateSpecificAliases(workingName, originalBasename, cleanExisting);
                });
                
                if (modified) count++;

            } catch {
                // Ignore error
            }
        }
        return count;
    }

    async linkContent(files: TFile[], indexData: VaultIndexData): Promise<number> {
        let count = 0;
        const validTargets = new Set<string>();
        for (const target of indexData.uniqueMap.values()) {
            validTargets.add(target.toLowerCase());
        }

        for (const file of files) {
            if (file.extension !== 'md') continue;
            try {
                const original = await this.app.vault.read(file);
                let working = original;
                const lowerContent = working.toLowerCase(); 

                const cleanupPattern = /([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*\s+\$[a-zA-Z][0-9]?\$)(\s*\[\[[^\]]+\]\])+/g;
                if (cleanupPattern.test(working)) {
                    working = working.replace(cleanupPattern, "$1");
                }

                const masks: string[] = [];
                const maskText = (text: string, regex: RegExp) => {
                    return text.replace(regex, (m) => {
                        masks.push(m);
                        return `___SUFFIXMASK_${masks.length - 1}___`;
                    });
                };

                working = maskText(working, REGEX_PATTERNS.MASK_YAML);
                working = maskText(working, REGEX_PATTERNS.MASK_CODE);
                working = maskText(working, /\[\[[^\]]+\]\]/g);

                const adjacentPattern = /\b([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*)(\s+)([_$])([a-zA-Z][0-9]?)\3/g;
                
                working = working.replace(adjacentPattern, (match: string, head: string, space: string, wrapper: string, char: string) => {
                    let singularHead = head;
                    const isPlural = head.endsWith('s') && !head.endsWith('ss');
                    if (isPlural) {
                        singularHead = head.slice(0, -1);
                    }
                    
                    const candidateTarget = `${singularHead} ${char}`.toLowerCase();
                    const trueTarget = this.resolveTarget(candidateTarget, indexData, lowerContent);
                    
                    if (trueTarget) {
                        if (isPlural) {
                            return `[[${trueTarget}|${head} ${char}]]`;
                        }

                        if (wrapper === '$') {
                            const cleanAlias = `${head} ${char}`;
                            if (cleanAlias.toLowerCase() === trueTarget.toLowerCase()) {
                                return `[[${trueTarget}]]`;
                            } else {
                                return `[[${trueTarget}|${cleanAlias}]]`;
                            }
                        } 
                        else {
                            return `[[${trueTarget}|${match}]]`;
                        }
                    }
                    return match;
                });

                const leafPattern = /(^|[\s(])([_$])([a-zA-Z][0-9]?)\2(?=[.,)\s]|$)/g;
                
                working = working.replace(leafPattern, (match: string, prefix: string, wrapper: string, char: string) => {
                    const leafKey = `${wrapper}${char}${wrapper}`;
                    const trueTarget = this.resolveTarget(leafKey.toLowerCase(), indexData, lowerContent);

                    if (trueTarget) {
                        if (wrapper === '_') {
                             return `${prefix}_[[${trueTarget}|${char}]]_`;
                        } else {
                             return `${prefix}[[${trueTarget}|${leafKey}]]`;
                        }
                    }
                    return match;
                });

                working = working.replace(/___SUFFIXMASK_(\d+)___/g, (m: string, i: string) => masks[parseInt(String(i), 10)] || m);

                if (working !== original) {
                    await this.app.vault.process(file, () => working);
                    count++;
                }

            } catch {
                // Ignore error
            }
        }
        return count;
    }

    private resolveTarget(key: string, data: VaultIndexData, fileContent: string): string | null {
        const lowerKey = key.toLowerCase();
        
        const exactMatch = data.uniqueMap.get(lowerKey);
        if (exactMatch) return exactMatch;

        if (data.multiMap.has(lowerKey)) {
            const candidates = data.multiMap.get(lowerKey);
            if (!candidates) return null;

            const sorted = [...candidates].sort((a, b) => b.length - a.length);

            for (const candidate of sorted) {
                const parts = candidate.split(' ');
                if (parts.length > 2) {
                    const modifier = parts[0]; 
                    if (fileContent.includes(modifier.toLowerCase())) {
                        return candidate;
                    }
                }
            }
            return sorted[sorted.length - 1];
        }
        return null;
    }

    private generateSpecificAliases(cleanName: string, originalName: string, existing: Set<string>): Set<string> {
        const finalAliases = new Set<string>();
        const match = cleanName.match(/^(.*)\s([a-zA-Z][0-9]?)$/);
        if (!match) return existing; 

        const head = match[1];
        const suffix = match[2];

        if (originalName !== cleanName) finalAliases.add(originalName);
        finalAliases.add(`_${suffix}_`);
        finalAliases.add(`$${suffix}$`);
        finalAliases.add(`${head} _${suffix}_`);
        finalAliases.add(`${head} $${suffix}$`);

        const words = head.split(' ');
        const lastWord = words[words.length - 1];
        if (!lastWord.endsWith('s')) {
            const pluralLast = lastWord + 's';
            const pluralHead = [...words.slice(0, -1), pluralLast].join(' ');
            finalAliases.add(`${pluralHead} ${suffix}`);
            finalAliases.add(`${pluralHead} _${suffix}_`);
            finalAliases.add(`${pluralHead} $${suffix}$`);
        }

        for (const old of existing) {
            if (finalAliases.has(old)) continue;
            if (old === suffix) continue;
            if (old.startsWith(suffix) && /^[a-zA-Z0-9]s+$/.test(old)) continue;
            if (old === `_${cleanName}_`) continue;
            if (old === cleanName) continue;
            if (old.endsWith('ae') || old.endsWith('aes') || old.endsWith('aess')) {
                 if (old.startsWith(head)) continue;
            }
            finalAliases.add(old);
        }
        return finalAliases;
    }
}