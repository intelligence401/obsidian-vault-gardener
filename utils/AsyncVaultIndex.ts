import { App, TFile, parseFrontMatterAliases, CachedMetadata, EventRef } from 'obsidian';
import { REGEX_PATTERNS } from './RegexPatterns';
import { VaultGardenerSettings } from '../main';

export interface VaultIndexData {
    uniqueMap: Map<string, string>;       
    multiMap: Map<string, string[]>;      
    shortFormRegistry: Map<string, Set<string>>;
}

export class AsyncVaultIndex {
    app: App;
    private stopWords: Set<string>;

    constructor(app: App, settings: VaultGardenerSettings) {
        this.app = app;
        this.stopWords = new Set(); 

        if (settings.ignoredWords) {
            const userWords = settings.ignoredWords.split(',').map(s => s.trim().toLowerCase());
            userWords.forEach(w => {
                if (w.length > 0) this.stopWords.add(w);
            });
        }
    }

    async buildIndex(files: TFile[]): Promise<VaultIndexData> {
        const candidateMap = new Map<string, Set<string>>();
        const shortFormRegistry = new Map<string, Set<string>>();

        for (const file of files) {
            const cache = await this.waitForCache(file);
            const target = file.basename;

            this.collectTerm(candidateMap, shortFormRegistry, target, target);
            
            if (cache?.frontmatter) {
                const aliases = parseFrontMatterAliases(cache.frontmatter);
                if (aliases) {
                    aliases.forEach(alias => {
                        this.collectTerm(candidateMap, shortFormRegistry, alias, target);
                    });
                }
            }
        }

        const uniqueMap = new Map<string, string>();
        const multiMap = new Map<string, string[]>();

        for (const [alias, targets] of candidateMap.entries()) {
            const targetArray = Array.from(targets);
            if (targetArray.length === 1) {
                uniqueMap.set(alias, targetArray[0]);
            } else if (targetArray.length > 1) {
                multiMap.set(alias, targetArray);
            }
        }

        return { uniqueMap, multiMap, shortFormRegistry };
    }

    private collectTerm(
        map: Map<string, Set<string>>, 
        registry: Map<string, Set<string>>, 
        rawTerm: string, 
        target: string
    ) {
        if (!rawTerm) return;
        const term = rawTerm.trim();
        
        let cleanRaw = term;
        const isScientificLeaf = /^[_$][a-zA-Z][0-9]?[_$]$/.test(term);

        if ((term.includes(' ') && /[_$]/.test(term)) || isScientificLeaf || term.includes('\\')) {
            cleanRaw = term;
        } else {
            cleanRaw = term.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
        }

        const cleanKey = cleanRaw.toLowerCase();

        if (!isScientificLeaf && cleanKey.length < 2 && !cleanKey.includes('$')) return;

        if (this.stopWords.has(cleanKey)) {
            if (cleanRaw !== cleanRaw.toUpperCase()) return;
        }

        const existingSet = map.get(cleanKey);
        if (existingSet) {
            existingSet.add(target);
        } else {
            map.set(cleanKey, new Set([target]));
        }

        if (cleanRaw.length <= 3) {
            const existingShort = registry.get(cleanKey);
            if (existingShort) {
                existingShort.add(cleanRaw);
            } else {
                registry.set(cleanKey, new Set([cleanRaw]));
            }
        }
    }

    private async waitForCache(file: TFile): Promise<CachedMetadata | null> {
        const current = this.app.metadataCache.getFileCache(file);
        if (current) return current;

        return new Promise((resolve) => {
            const timerControl = { ref: null as EventRef | null };
            const timeout = setTimeout(() => { 
                if (timerControl.ref) this.app.metadataCache.offref(timerControl.ref);
                resolve(null);
            }, 2000);

            timerControl.ref = this.app.metadataCache.on('changed', (changedFile) => {
                if (changedFile.path === file.path) {
                    clearTimeout(timeout);
                    if (timerControl.ref) this.app.metadataCache.offref(timerControl.ref); 
                    resolve(this.app.metadataCache.getFileCache(file));
                }
            });
        });
    }
}