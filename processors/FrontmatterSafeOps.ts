import { App, TFile } from 'obsidian';

export class FrontmatterSafeOps {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    async updateAliases(file: TFile, callback: (existing: Set<string>) => Set<string>): Promise<boolean> {
        return await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            const current = new Set<string>();
            if (frontmatter.aliases) {
                if (Array.isArray(frontmatter.aliases)) {
                    frontmatter.aliases.forEach((a: unknown) => current.add(String(a)));
                } else if (typeof frontmatter.aliases === 'string') {
                    current.add(frontmatter.aliases);
                }
            }

            const updated = callback(current);

            const newArray = Array.from(updated).sort();
            const oldArray = Array.from(current).sort();

            if (newArray.length === oldArray.length && newArray.every((val, index) => val === oldArray[index])) {
                return; 
            }

            frontmatter.aliases = newArray;
        });
    }

    async addAliases(app: App, file: TFile, newAliases: string[]): Promise<boolean> {
        let changed = false;
        await app.fileManager.processFrontMatter(file, (fm) => {
            const current = new Set<string>(fm.aliases || []);
            for (const a of newAliases) {
                if (!current.has(a)) {
                    current.add(a);
                    changed = true;
                }
            }
            fm.aliases = Array.from(current);
        });
        return changed;
    }
}