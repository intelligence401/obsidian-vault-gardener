import { App, TFile, parseFrontMatterAliases, CachedMetadata, EventRef } from 'obsidian';
import { REGEX_PATTERNS } from './RegexPatterns';
import { VaultGardenerSettings } from '../main';

export interface VaultIndexData {
    map: Map<string, string>;
    shortFormRegistry: Map<string, Set<string>>;
}

export class AsyncVaultIndex {
    app: App;
    private stopWords: Set<string>;

    constructor(app: App, settings: VaultGardenerSettings) {
        this.app = app;
        
        const defaults = [
            "the", "and", "but", "for", "not", "this", "that", "with", "from", "into", 
            "can", "are", "was", "were", "has", "have", "had", "will", "would", "what",
            "who", "how", "why", "when", "where", "which", "there", "here", "does", "do"
        ];
        
        this.stopWords = new Set(defaults);

        if (settings.ignoredWords) {
            const userWords = settings.ignoredWords.split(',').map(s => s.trim().toLowerCase());
            userWords.forEach(w => {
                if (w.length > 0) this.stopWords.add(w);
            });
        }
    }

    async buildIndex(files: TFile[]): Promise<VaultIndexData> {
        const index = new Map<string, string>();
        const shortFormRegistry = new Map<string, Set<string>>();

        for (const file of files) {
            const cache = await this.waitForCache(file);
            this.addTerm(index, shortFormRegistry, file.basename, file.basename);
            if (cache?.frontmatter) {
                const aliases = parseFrontMatterAliases(cache.frontmatter);
                if (aliases) {
                    aliases.forEach(alias => {
                        this.addTerm(index, shortFormRegistry, alias, file.basename);
                    });
                }
            }
        }

        return { map: index, shortFormRegistry };
    }

    private async waitForCache(file: TFile): Promise<CachedMetadata | null> {
        const current = this.app.metadataCache.getFileCache(file);
        if (current) return current;

        return new Promise((resolve) => {
            // eslint-disable-next-line prefer-const -- Needed for circular dependency
            let ref: EventRef; 
            const timeout = setTimeout(() => {
                this.app.metadataCache.offref(ref);
                resolve(null);
            }, 2000);

            ref = this.app.metadataCache.on('changed', (changedFile) => {
                if (changedFile.path === file.path) {
                    clearTimeout(timeout);
                    this.app.metadataCache.offref(ref); 
                    resolve(this.app.metadataCache.getFileCache(file));
                }
            });
        });
    }

    private addTerm(
        index: Map<string, string>, 
        registry: Map<string, Set<string>>, 
        rawTerm: string, 
        target: string
    ) {
        if (!rawTerm) return;
        const term = rawTerm.trim();
        
        const cleanRaw = term.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
        const cleanKey = cleanRaw.toLowerCase();

        if (cleanKey.length < 2 && !cleanKey.includes('$')) return;

        if (this.stopWords.has(cleanKey)) {
            if (cleanRaw !== cleanRaw.toUpperCase()) {
                return;
            }
        }

        index.set(cleanKey, target);

        if (cleanRaw.length <= 3) {
            if (!registry.has(cleanKey)) {
                registry.set(cleanKey, new Set());
            }
            const set = registry.get(cleanKey);
            if (set) {
                set.add(cleanRaw);
            }
        }
    }
}