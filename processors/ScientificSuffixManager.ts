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
            
            try {
                const content = await this.app.vault.read(file);
                const monstrosityPattern = /(\[\[[^\]]+\]\])(\|\1)+/g;
                if (monstrosityPattern.test(content)) {
                    const cleanContent = content.replace(monstrosityPattern, "$1");
                    await this.app.vault.process(file, () => cleanContent);
                    count++;
                }
            } catch { /* ignore */ }

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
                        
                        if (ScientificTools.isGarbage(alias)) continue;

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
        
        for (const file of files) {
            if (file.extension !== 'md') continue;
            try {
                const original = await this.app.vault.read(file);
                let working = original;
                const lowerContent = working.toLowerCase(); 

                const cleanupPattern = /([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*\s+\$[a-zA-Z][0-9]?\$)(\s*\[\[[^\]]+\]\])+/g;
                if (cleanupPattern.test(working)) working = working.replace(cleanupPattern, "$1");

                const masks: string[] = [];
                const maskText = (text: string, regex: RegExp) => {
                    return text.replace(regex, (m) => { masks.push(m); return `___SUFFIXMASK_${masks.length - 1}___`; });
                };

                working = maskText(working, REGEX_PATTERNS.MASK_YAML);
                working = maskText(working, REGEX_PATTERNS.MASK_CODE);
                working = maskText(working, /\[\[[^\]]+\]\]/g);

                const adjacentPattern = /\b([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)*)(\s+)([_$])([a-zA-Z][0-9]?)\3/g;
                
                working = working.replace(adjacentPattern, (
                    match: string, 
                    head: string, 
                    space: string, 
                    wrapper: string, 
                    char: string, 
                    offset: number, 
                    fullString: string
                ) => {
                    if (fullString[offset + match.length] === '/') return match;
                    
                    let singularHead = head;
                    if (head.endsWith('s') && !head.endsWith('ss')) singularHead = head.slice(0, -1);
                    
                    const candidateTarget = `${singularHead} ${char}`.toLowerCase();
                    const trueTarget = this.resolveTarget(candidateTarget, indexData, lowerContent);
                    
                    if (trueTarget) {
                        if (head.endsWith('s') && !head.endsWith('ss')) return `[[${trueTarget}|${head} ${char}]]`;
                        if (wrapper === '$') {
                            const cleanAlias = `${head} ${char}`;
                            return (cleanAlias.toLowerCase() === trueTarget.toLowerCase()) ? `[[${trueTarget}]]` : `[[${trueTarget}|${cleanAlias}]]`;
                        } 
                        return `[[${trueTarget}|${match}]]`;
                    }
                    return match;
                });

                const leafPattern = /(^|[\s(])([_$])([a-zA-Z][0-9]?)\2(?=[.,)\s]|$)/g;
                
                working = working.replace(leafPattern, (
                    match: string, 
                    prefix: string, 
                    wrapper: string, 
                    char: string, 
                    offset: number, 
                    fullString: string
                ) => {
                    if (fullString[offset + match.length] === '/') return match;
                    
                    const leafKey = `${wrapper}${char}${wrapper}`;
                    const trueTarget = this.resolveTarget(leafKey.toLowerCase(), indexData, lowerContent);
                    
                    if (trueTarget) {
                        return (wrapper === '_') ? `${prefix}_[[${trueTarget}|${char}]]_` : `${prefix}[[${trueTarget}|${leafKey}]]`;
                    }
                    return match;
                });

                working = working.replace(/___SUFFIXMASK_(\d+)___/g, (m, i) => masks[parseInt(String(i), 10)] || m);
                if (working !== original) {
                    await this.app.vault.process(file, () => working);
                    count++;
                }
            } catch { 
                // Ignore
            }
        }
        return count;
    }

    private resolveTarget(key: string, data: VaultIndexData, fileContent: string): string | null {
        const lowerKey = key.toLowerCase();
        
        // Safely access map
        const uniqueMatch = data.uniqueMap.get(lowerKey);
        if (uniqueMatch) return uniqueMatch;

        if (data.multiMap.has(lowerKey)) {
            const candidates = data.multiMap.get(lowerKey);
            if (!candidates) return null;
            const sorted = [...candidates].sort((a, b) => b.length - a.length);
            for (const candidate of sorted) {
                const parts = candidate.split(' ');
                if (parts.length > 2) {
                    const modifier = parts[0]; 
                    if (fileContent.includes(modifier.toLowerCase())) return candidate;
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
        
        const isUppercase = /^[A-Z]/.test(suffix);

        if (!isUppercase) {
            finalAliases.add(`_${suffix}_`);
            finalAliases.add(`$${suffix}$`);
            finalAliases.add(`${head} _${suffix}_`);
            finalAliases.add(`${head} $${suffix}$`);
        }

        const words = head.split(' ');
        const lastWord = words[words.length - 1];
        if (!lastWord.endsWith('s')) {
            const pluralLast = lastWord + 's';
            const pluralHead = [...words.slice(0, -1), pluralLast].join(' ');
            finalAliases.add(`${pluralHead} ${suffix}`);
            if (!isUppercase) {
                finalAliases.add(`${pluralHead} _${suffix}_`);
                finalAliases.add(`${pluralHead} $${suffix}$`);
            }
        }

        for (const old of existing) {
            if (finalAliases.has(old)) continue;
            
            if (ScientificTools.isGarbage(old)) continue;

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