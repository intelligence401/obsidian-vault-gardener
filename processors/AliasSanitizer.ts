import { App, TFile } from 'obsidian';
import { FrontmatterSafeOps } from './FrontmatterSafeOps';
import { ScientificTools } from '../utils/ScientificTools';

export class AliasSanitizer {
    app: App;
    fmOps: FrontmatterSafeOps;

    constructor(app: App) {
        this.app = app;
        this.fmOps = new FrontmatterSafeOps(app);
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;
        
        for (const file of files) {
            if (file.extension !== 'md') continue;

            if (ScientificTools.isScientificSuffixFile(file.basename)) continue;
            
            const modified = await this.fmOps.updateAliases(file, (aliases) => {
                const cleanSet = new Set<string>();
                for (const alias of aliases) {
                    if (!ScientificTools.isGarbage(alias)) {
                        cleanSet.add(alias);
                    }
                }
                return cleanSet;
            });

            if (modified) count++;
        }
        
        return count;
    }
}