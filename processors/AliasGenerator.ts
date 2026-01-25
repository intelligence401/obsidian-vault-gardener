import { App, TFile, } from 'obsidian';
import { FrontmatterSafeOps } from './FrontmatterSafeOps';

export class AliasGenerator {
    app: App;
    fmOps: FrontmatterSafeOps;
    renameHistory: Map<string, string> = new Map();
    
    private greekMap: Record<string, string> = {
        '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', 
        '\\delta': 'delta', '\\epsilon': 'epsilon', '\\phi': 'phi',
        '\\mu': 'mu', '\\lambda': 'lambda'
    };

    constructor(app: App) {
        this.app = app;
        this.fmOps = new FrontmatterSafeOps(app);
    }

    async process(files: TFile[], history?: Map<string, string>): Promise<number> {
        if (history) this.renameHistory = history;

        let count = 0;
        for (const file of files) {
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
            if (root.includes('$')) {
                finalAliases.add(root); 

                let plain = root.replace(/\$/g, '');
                
                for (const [key, val] of Object.entries(this.greekMap)) {
                    const regex = new RegExp(key.replace(/\\/g, '\\\\'), 'g');
                    plain = plain.replace(regex, val);
                }
                
                plain = plain.replace(/\\/g, '');

                if (plain.length >= 2) generationSeeds.add(plain.trim());
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

            if (!seed.endsWith('ss')) finalAliases.add(seed + 's');
            if (!seed.endsWith('s'))  finalAliases.add(seed + 'ss');

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
}