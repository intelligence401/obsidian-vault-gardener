import { App, TFile } from 'obsidian';
import { FrontmatterSafeOps } from './FrontmatterSafeOps';
import { VaultGardenerSettings } from '../main';

export class AliasGenerator {
    app: App;
    fmOps: FrontmatterSafeOps;
    settings: VaultGardenerSettings;
    renameHistory: Map<string, string> = new Map();
    
    private greekMap: Record<string, string> = {
        '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', 
        '\\delta': 'delta', '\\epsilon': 'epsilon', '\\phi': 'phi',
        '\\mu': 'mu', '\\lambda': 'lambda'
    };

    private subMap: Record<string, string> = {
        '₀':'0', '₁':'1', '₂':'2', '₃':'3', '₄':'4', '₅':'5', '₆':'6', '₇':'7', '₈':'8', '₉':'9',
        '₊':'+', '₋':'-', '₌':'=', '₍':'(', '₎':')'
    };
    private supMap: Record<string, string> = {
        '⁰':'0', '¹':'1', '²':'2', '³':'3', '⁴':'4', '⁵':'5', '⁶':'6', '⁷':'7', '⁸':'8', '⁹':'9',
        '⁺':'+', '⁻':'-', '⁽':'(', '⁾':')'
    };

    private reverseSubMap: Record<string, string> = {
        '0':'_0', '1':'_1', '2':'_2', '3':'_3', '4':'_4', '5':'_5', '6':'_6', '7':'_7', '8':'_8', '9':'_9',
        '+':'_+', '-':'_-'
    };
    private reverseSupMap: Record<string, string> = {
        '+':'^+', '-':'^-'
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
            if (root.includes('$') || this.hasSpecialChars(root)) {
                finalAliases.add(root); 

                const ascii = this.normalizeScientificText(root);
                if (ascii !== root && ascii.length >= 2) {
                    finalAliases.add(ascii);
                    generationSeeds.add(ascii);
                }

                if (!root.includes('$') && this.hasSpecialChars(root)) {
                    const latex = this.unicodeToLatex(root);
                    if (latex !== root) finalAliases.add(latex);
                }
                
                continue;
            }

            let clean = root;
            if (clean.startsWith('_') && clean.endsWith('_')) {
                clean = clean.replace(/^_+|_+$/g, '');
            }
            if (/s{3,}$/.test(clean)) continue;

            if (clean.length >= 2) generationSeeds.add(clean);
        }

        for (const seed of generationSeeds) {
            finalAliases.add(seed);

            const isChemical = /\d$/.test(seed); 

            if (!isChemical) {
                // A. PLURALS
                if (!seed.endsWith('ss')) finalAliases.add(seed + 's');
                if (seed.endsWith('s') && !seed.endsWith('ss')) {
                    finalAliases.add(seed.slice(0, -1));
                }
            }

            if (this.settings.generateIons && seed.endsWith('ium')) {
                if (seed.toLowerCase() !== 'bacterium') {
                    finalAliases.add(`${seed} ion`);
                }
            }

            if (this.settings.generateScientificAbbreviations) {
                if (/^[A-Z][a-z]+\s[a-z]+$/.test(seed)) {
                    const parts = seed.split(' ');
                    if (parts.length === 2) {
                        const abbrev = `${parts[0].charAt(0)}. ${parts[1]}`;
                        finalAliases.add(abbrev);
                    }
                }
            }

            if (seed.endsWith('um')) finalAliases.add(seed.slice(0, -2) + 'a'); 
            if (seed.endsWith('us')) finalAliases.add(seed.slice(0, -2) + 'i'); 
            if (seed.endsWith('is')) finalAliases.add(seed.slice(0, -2) + 'es'); 
            if (seed.endsWith('a') && !seed.endsWith('ia')) finalAliases.add(seed + 'e'); 
        }

        const wrappers = new Set<string>();
        for (const item of finalAliases) {
            if (!item.includes('$') && !item.startsWith('_')) {
                wrappers.add(`_${item}_`);
            }
        }
        wrappers.forEach(w => finalAliases.add(w));

        for (const item of finalAliases) {
            if (!item || item.trim().length === 0) finalAliases.delete(item);
            if (/s{3,}$/.test(item) || /s{3,}_$/.test(item)) finalAliases.delete(item);
        }

        return finalAliases;
    }

    private hasSpecialChars(text: string): boolean {
        return /[₀-₉₊₋₌₍₎⁰-⁹⁺⁻⁽⁾]/.test(text);
    }

    private normalizeScientificText(text: string): string {
        let clean = text;
        if (clean.includes('$')) {
            clean = clean.replace(/\$/g, '');
            clean = clean.replace(/[_^{}]/g, ''); 
            for (const [key, val] of Object.entries(this.greekMap)) {
                const regex = new RegExp(key.replace(/\\/g, '\\\\'), 'g');
                clean = clean.replace(regex, val);
            }
            clean = clean.replace(/\\/g, '');
        }
        let ascii = '';
        for (const char of clean) {
            if (this.subMap[char]) ascii += this.subMap[char];
            else if (this.supMap[char]) ascii += this.supMap[char];
            else ascii += char;
        }
        return ascii.trim();
    }

    private unicodeToLatex(text: string): string {
        let latex = "";
        let hasSub = false;
        
        for (const char of text) {
            if (/[₀-₉]/.test(char)) {
                const num = this.subMap[char];
                latex += `_${num}`;
                hasSub = true;
            } else if (/[⁺⁻]/.test(char)) {
                const charge = this.supMap[char]; 
                latex += `^{${charge}}`;
                hasSub = true;
            } else {
                latex += char;
            }
        }
        
        if (hasSub) return `$${latex}$`;
        return text;
    }
}