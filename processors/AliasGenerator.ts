import { App, TFile } from 'obsidian';
import { FrontmatterSafeOps } from './FrontmatterSafeOps';
import { VaultGardenerSettings } from '../main';
import { ScientificTools } from '../utils/ScientificTools';

export class AliasGenerator {
    app: App;
    fmOps: FrontmatterSafeOps;
    settings: VaultGardenerSettings;
    renameHistory: Map<string, string> = new Map();

    constructor(app: App, settings: VaultGardenerSettings) {
        this.app = app;
        this.settings = settings;
        this.fmOps = new FrontmatterSafeOps(app);
    }

    async process(files: TFile[], history?: Map<string, string>): Promise<number> {
        if (history) this.renameHistory = history;

        let count = 0;
        for (const file of files) {
            if (file.basename.startsWith('Untitled')) continue;
            if (ScientificTools.isScientificSuffixFile(file.basename)) continue;

            const modified = await this.fmOps.updateAliases(file, (roots) => {
                return this.generateFromRoots(roots, file.path);
            });
            if (modified) count++;
        }
        return count;
    }

    private generateFromRoots(roots: Set<string>, filePath: string): Set<string> {
        if (this.renameHistory.has(filePath)) {
            const historyItem = this.renameHistory.get(filePath);
            if (historyItem) roots.add(historyItem);
        }

        const finalAliases = new Set<string>();
        const generationSeeds = new Set<string>();

        for (const root of roots) {
            finalAliases.add(root);

            if (root.includes('$') || ScientificTools.hasSpecialChars(root)) {
                const ascii = ScientificTools.normalize(root);
                if (ascii !== root && ascii.length >= 2) {
                    finalAliases.add(ascii);
                    generationSeeds.add(ascii);
                }
                if (!root.includes('$') && ScientificTools.hasSpecialChars(root)) {
                    const latex = ScientificTools.unicodeToLatex(root);
                    if (latex !== root) finalAliases.add(latex);
                }
                continue;
            }

            let greekExpanded = root;
            let hasGreek = false;
            for (const [char, name] of Object.entries(ScientificTools.unicodeGreekMap)) {
                if (greekExpanded.includes(char)) {
                    greekExpanded = greekExpanded.replace(new RegExp(char, 'g'), name);
                    hasGreek = true;
                }
            }
            if (hasGreek) {
                finalAliases.add(greekExpanded);
                generationSeeds.add(greekExpanded);
            }

            let clean = root;
            if (clean.startsWith('_') && clean.endsWith('_')) {
                clean = clean.replace(/^_+|_+$/g, '');
            }
            if (clean.includes('_')) {
                clean = clean.replace(/_/g, '');
            }
            
            if (/s{3,}$/.test(clean)) continue;
            generationSeeds.add(clean);
        }

        for (const seed of generationSeeds) {
            if (!finalAliases.has(seed)) finalAliases.add(seed);

            const isChemical = /\d$/.test(seed);
            const isPhrase = seed.includes(' ');
            
            const suffixMatch = seed.match(/^(.*)\s([a-zA-Z0-9])$/);
            const hasScientificSuffix = suffixMatch !== null;

            if (!isChemical && !hasScientificSuffix) {
                const isCaps = /^[A-Z0-9]+$/.test(seed);
                const endsInS = seed.endsWith('s');
                const endsInSS = seed.endsWith('ss');

                if (isCaps) {
                    if (!endsInS) finalAliases.add(seed + 's');
                } else {
                    if (!endsInSS) finalAliases.add(seed + 's');
                    
                    const isSpecies = seed.toLowerCase().endsWith('species');
                    if (endsInS && !endsInSS && seed.length > 3 && !isSpecies) {
                        finalAliases.add(seed.slice(0, -1));
                    }
                }
            }

            if (hasScientificSuffix) {
                const head = suffixMatch ? suffixMatch[1] : "";
                const suffix = suffixMatch ? suffixMatch[2] : "";
                
                if (head && suffix) {
                    finalAliases.add(`_${suffix}_`);
                    finalAliases.add(`$${suffix}$`);
                    finalAliases.add(`${head} _${suffix}_`);
                    finalAliases.add(`${head} $${suffix}$`);
                }
            }

            if (this.settings.generateIons && seed.endsWith('ium') && seed.toLowerCase() !== 'bacterium') {
                finalAliases.add(`${seed} ion`);
            }

            if (this.settings.generateScientificAbbreviations) {
                if (/^[A-Z][a-z]+\s[a-z]+$/.test(seed)) {
                    const parts = seed.split(' ');
                    if (parts.length === 2) {
                        finalAliases.add(`${parts[0].charAt(0)}. ${parts[1]}`);
                    }
                }
            }

            if (!isPhrase) {
                if (seed.endsWith('um')) finalAliases.add(seed.slice(0, -2) + 'a'); 
                if (seed.endsWith('us')) finalAliases.add(seed.slice(0, -2) + 'i'); 
                if (seed.endsWith('is')) finalAliases.add(seed.slice(0, -2) + 'es'); 
                if (seed.endsWith('a') && !seed.endsWith('ia') && seed.length > 3) {
                    finalAliases.add(seed + 'e'); 
                }
            }
        }

        const wrappers = new Set<string>();
        for (const item of finalAliases) {
            if (item.includes('$') || item.includes('_')) continue;
            if (ScientificTools.isGarbage(item)) continue;
            wrappers.add(`_${item}_`);
        }
        wrappers.forEach(w => finalAliases.add(w));

        for (const item of finalAliases) {
            if (!item || item.trim().length === 0) {
                finalAliases.delete(item);
                continue;
            }
            if (ScientificTools.isGarbage(item)) {
                if (this.renameHistory.has(filePath) && this.renameHistory.get(filePath) === item) {
                    continue; 
                }
                finalAliases.delete(item);
            }
        }

        return finalAliases;
    }
}