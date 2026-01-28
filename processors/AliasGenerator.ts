import { App, TFile } from 'obsidian';
import { FrontmatterSafeOps } from './FrontmatterSafeOps';
import { VaultGardenerSettings } from '../main';
import { ScientificTools } from '../utils/ScientificTools';

export class AliasGenerator {
    app: App;
    fmOps: FrontmatterSafeOps;
    settings: VaultGardenerSettings;
    renameHistory: Map<string, string> = new Map();

    private englishGreekMap: Record<string, string> = {
        'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 
        'ε': 'epsilon', 'φ': 'phi', 'μ': 'mu', 'λ': 'lambda'
    };

    private latexGreekMap: Record<string, string> = {
        'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 
        'ε': '\\epsilon', 'φ': '\\phi', 'μ': '\\mu', 'λ': '\\lambda'
    };

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
                const cleanName = file.basename;
                roots.add(cleanName);
                
                for (const r of roots) {
                    if (ScientificTools.isGarbage(r)) {
                        roots.delete(r);
                    }
                }
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
            if (ScientificTools.isGarbage(root)) continue;

            finalAliases.add(root);

            let hasGreek = false;
            for (const char of Object.keys(this.englishGreekMap)) {
                if (root.includes(char)) {
                    hasGreek = true;
                    break;
                }
            }

            if (hasGreek) {
                let englishExpanded = root;
                for (const [char, name] of Object.entries(this.englishGreekMap)) {
                    englishExpanded = englishExpanded.replace(new RegExp(char, 'g'), name);
                }
                finalAliases.add(englishExpanded);
                generationSeeds.add(englishExpanded);

                let latexExpanded = root;
                for (const [char, macro] of Object.entries(this.latexGreekMap)) {
                    latexExpanded = latexExpanded.replace(new RegExp(char, 'g'), macro);
                }
                if (!latexExpanded.includes('$')) {
                    latexExpanded = `$${latexExpanded}$`;
                }
                finalAliases.add(latexExpanded);
            }

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

            let clean = root;
            if (clean.startsWith('_') && clean.endsWith('_')) {
                clean = clean.replace(/^_+|_+$/g, '');
            }
            if (clean.includes('_')) {
                clean = clean.replace(/_/g, '');
            }
            generationSeeds.add(clean);
        }

        for (const seed of generationSeeds) {
            if (ScientificTools.isGarbage(seed)) continue;
            if (!finalAliases.has(seed)) finalAliases.add(seed);

            const isChemical = /[A-Za-z]+[0-9]+$/.test(seed);
            const isPhrase = seed.includes(' ');
            
            const suffixMatch = seed.match(/^(.*)\s([a-zA-Z][0-9]?)$/);
            const hasScientificSuffix = suffixMatch !== null;

            if (!isChemical && !hasScientificSuffix) {
                const isCaps = /^[A-Z0-9]+$/.test(seed);
                const endsInS = seed.endsWith('s');

                if (!isChemical && !endsInS) {
                    if (isCaps) {
                         finalAliases.add(seed + 's');
                    } else {
                        const isSpecies = seed.toLowerCase().endsWith('species');
                        if (!isSpecies) {
                            finalAliases.add(seed + 's');
                        }
                    }
                }
            }

            if (hasScientificSuffix && suffixMatch) {
                const head = suffixMatch[1];
                const suffix = suffixMatch[2];
                
                const isUppercase = /^[A-Z]/.test(suffix);
                
                if (head && suffix && !isUppercase) {
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
                finalAliases.delete(item);
            }
        }

        return finalAliases;
    }
}