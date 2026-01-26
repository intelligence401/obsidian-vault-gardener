import { App, TFile } from 'obsidian';

export class RedundantLinkPatternSanitizer {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;
        
        for (const file of files) {
            if (file.extension !== 'md') continue;
            
            try {
                const originalContent = await this.app.vault.read(file);
                const newContent = this.fixRedundantPatterns(originalContent, file.path);
                
                if (newContent !== originalContent) {
                    await this.app.vault.process(file, () => newContent);
                    count++;
                }
            } catch (e) {
                console.error(`PatternSanitizer failed: ${file.path}`, e);
            }
        }
        
        return count;
    }

    private fixRedundantPatterns(text: string, filePath: string): string {
        const pattern = /(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])\s*\(\s*(\$[^$]+\$)\s*(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])\s*\)/g;

        return text.replace(pattern, (match, outerFull, outerTarget, mathBlock, innerFull, innerTarget) => {
            
            const t1 = outerTarget.trim().toLowerCase();
            const t2 = innerTarget.trim().toLowerCase();

            if (t1 !== t2) return match;
            
            const fixed = `${outerFull} (${mathBlock})`;
            
            console.info(`[PatternSanitizer] Fixed in ${filePath}:`);
            console.info(`   From: ${match}`);
            console.info(`   To:   ${fixed}`);

            return fixed;
        });
    }
}