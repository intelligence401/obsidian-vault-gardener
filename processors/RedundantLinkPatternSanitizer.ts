import { App, TFile } from 'obsidian';

export class RedundantLinkPatternSanitizer {
    app: App;
    
    private subMap: Record<string, string> = {
        '₀':'0', '₁':'1', '₂':'2', '₃':'3', '₄':'4', '₅':'5', '₆':'6', '₇':'7', '₈':'8', '₉':'9',
        '₊':'+', '₋':'-', '₌':'='
    };
    private supMap: Record<string, string> = {
        '⁰':'0', '¹':'1', '²':'2', '³':'3', '⁴':'4', '⁵':'5', '⁶':'6', '⁷':'7', '⁸':'8', '⁹':'9',
        '⁺':'+', '⁻':'-'
    };
    private latexMap: Record<string, string> = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\epsilon': 'ε', '\\phi': 'φ', '\\mu': 'μ', '\\lambda': 'λ'
    };

    constructor(app: App) {
        this.app = app;
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;
        
        for (const file of files) {
            if (file.extension !== 'md') continue;
            
            try {
                const originalContent = await this.app.vault.read(file);
                const newContent = this.fixRedundantPatterns(originalContent);
                
                if (newContent !== originalContent) {
                    await this.app.vault.process(file, () => newContent);
                    count++;
                }
            } catch {
                // Ignore
            }
        }
        
        return count;
    }

    private fixRedundantPatterns(text: string): string {
        let working = text;

        const magnesiumPattern = /(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])\s*\(\s*(\$[^$]+\$)\s*(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])\s*\)/g;
        working = working.replace(magnesiumPattern, (match, outerFull: string, outerTarget: string, mathBlock: string, innerFull: string, innerTarget: string) => {
            const t1 = outerTarget.trim().toLowerCase();
            const t2 = innerTarget.trim().toLowerCase();
            if (t1 !== t2) return match;
            return `${outerFull} (${mathBlock})`;
        });

        const adjacentPattern = /(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])\s+(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])/g;
        working = working.replace(adjacentPattern, (match, link1Full: string, link1Target: string, link2Full: string, link2Target: string) => {
            if (link1Target.trim().toLowerCase() === link2Target.trim().toLowerCase()) {
                return link1Full; 
            }
            return match;
        });

        const mathPrunePattern = /(\$[^$]+\$)\s*(\[\[([^\]|]+)(?:\|[^\]]+)?\]\])/g;
        working = working.replace(mathPrunePattern, (match, mathBlock: string, linkFull: string, linkTarget: string) => {
            const cleanMath = this.normalize(mathBlock);
            const cleanLink = this.normalize(linkTarget);
            
            if (cleanMath === cleanLink && cleanMath.length > 0) {
                return linkFull;
            }
            return match;
        });

        const internalMathPattern = /\[\[([^|\]]+)\|((?:[^\]]*\$[^\]]*)+)\]\]/g;
        working = working.replace(internalMathPattern, (match, target: string, alias: string) => {
            const cleanTarget = this.normalize(target);
            const cleanAlias = this.normalize(alias);

            if (cleanTarget === cleanAlias && cleanTarget.length > 0) {
                return `[[${target}]]`;
            }
            return match;
        });

        return working;
    }

    private normalize(text: string): string {
        let clean = text;
        
        for (const [tex, uni] of Object.entries(this.latexMap)) {
            const regex = new RegExp(tex.replace(/\\/g, '\\\\'), 'g');
            clean = clean.replace(regex, uni);
        }

        clean = clean.replace(/[$[\]_{}\\]/g, '').trim().toLowerCase();
        
        let ascii = '';
        for (const char of clean) {
            if (this.subMap[char]) ascii += this.subMap[char];
            else if (this.supMap[char]) ascii += this.supMap[char];
            else ascii += char;
        }
        return ascii;
    }
}