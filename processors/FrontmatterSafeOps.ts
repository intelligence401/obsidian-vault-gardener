import { App, TFile } from 'obsidian';

export class FrontmatterSafeOps {
    app: App;
    
    constructor(app: App) { this.app = app; }

    async updateAliases(
        file: TFile, 
        generatorFn: (roots: Set<string>) => Set<string>
    ): Promise<boolean> {
        let isModified = false;

        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                let current: string[] = [];
                if (frontmatter.aliases) {
                    if (Array.isArray(frontmatter.aliases)) {
                        current = frontmatter.aliases.map(String);
                    } else if (typeof frontmatter.aliases === 'string') {
                        current = [frontmatter.aliases];
                    }
                }

                // 1. EXTRACT ROOTS (Raw & Permissive)
                const roots = new Set<string>();
                roots.add(file.basename);
                current.forEach(a => roots.add(a.trim()));

                // 2. GENERATE
                const newSet = generatorFn(roots);

                // 3. FILTER & VALIDATE
                const finalAliases: string[] = [];
                newSet.forEach(alias => {
                    if (alias === file.basename) return;
                    
                    // RULE 1: MATH IS KING
                    if (alias.includes('$')) {
                        finalAliases.push(alias);
                    }
                    // RULE 2: STRICT ALPHANUMERIC
                    else if (this.isStrictlyValid(alias)) {
                        finalAliases.push(alias);
                    }
                });

                finalAliases.sort();
                current.sort();
                
                if (JSON.stringify(finalAliases) !== JSON.stringify(current)) {
                    frontmatter.aliases = finalAliases;
                    isModified = true;
                }
            });
        } catch (e) {
            console.error(`FrontmatterOps: Failed to update ${file.path}`, e);
        }

        return isModified;
    }

    private isStrictlyValid(alias: string): boolean {
        if (!alias) return false;
        if (alias.includes('__')) return false;
        const starts = alias.startsWith('_');
        const ends = alias.endsWith('_');
        if (starts !== ends) return false; 
        return true;
    }
}