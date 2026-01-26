import { App, TFile, Notice, normalizePath } from 'obsidian';

export class FilenameRenamer {
    app: App;
    private greekMap: Record<string, string> = {
        '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', 
        '\\delta': 'delta', '\\epsilon': 'epsilon', '\\phi': 'phi',
        '\\mu': 'mu', '\\lambda': 'lambda'
    };

    constructor(app: App) { 
        this.app = app;
    }

    async process(files: TFile[]): Promise<Map<string, string>> {
        const history = new Map<string, string>();
        let count = 0;
        const queue = [...files];

        for (const file of queue) {
            if (file.basename.startsWith('Untitled')) continue;

            const hasMath = file.basename.includes('$');
            const hasWrapper = file.basename.startsWith('_') && file.basename.endsWith('_');

            if (hasMath || hasWrapper) {
                const result = await this.handleRename(file);
                if (result) {
                    history.set(result.newPath, result.originalName);
                    count++;
                }
            }
        }
        
        if (count > 0) new Notice(`Renamer: Moved ${count} files.`);
        return history;
    }

    async handleRename(file: TFile): Promise<{newPath: string, originalName: string} | null> {
        const originalName = file.basename;
        let newName = originalName;

        if (newName.startsWith('_') && newName.endsWith('_')) {
            newName = newName.slice(1, -1);
        }

        if (newName.includes('$')) {
            newName = newName.replace(/\$([^$]+)\$/g, (match, inner) => {
                let trimmed = inner.trim();
                for (const [key, val] of Object.entries(this.greekMap)) {
                    const regex = new RegExp(key.replace(/\\/g, '\\\\'), 'g');
                    trimmed = trimmed.replace(regex, val);
                }
                trimmed = trimmed.replace(/[_^{}\\]/g, '');
                return trimmed;
            });
        }
        
        newName = newName.replace(/\s+/g, ' ').trim();
        if (newName === originalName) return null;

        const parentPath = file.parent ? file.parent.path : "";
        const rawPath = parentPath === "/" ? newName + ".md" : `${parentPath}/${newName}.md`;
        const newPath = normalizePath(rawPath);
        
        if (await this.app.vault.adapter.exists(newPath)) {
            console.warn(`Renamer: Skipping ${originalName}, target exists.`);
            return null;
        }

        console.debug(`[RENAMER] Moving "${originalName}" -> "${newName}"`);
        
        await this.app.fileManager.renameFile(file, newPath);
        
        return { newPath: newPath, originalName: originalName };
    }
}