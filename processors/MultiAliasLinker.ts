import { App, TFile } from 'obsidian';
import { Tokenizer } from '../utils/Tokenizer';
import { ContextMasker } from './ContextMasker';
import { RecursionGuard } from './RecursionGuard';
import { VaultGardenerSettings } from '../main';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';

export class MultiAliasLinker {
    app: App;
    multiMap: Map<string, string[]>;
    shortFormRegistry: Map<string, Set<string>>;
    masker: ContextMasker;
    settings: VaultGardenerSettings;

    constructor(
        app: App, 
        multiMap: Map<string, string[]>, 
        shortFormRegistry: Map<string, Set<string>>,
        settings: VaultGardenerSettings
    ) {
        this.app = app;
        this.multiMap = multiMap;
        this.shortFormRegistry = shortFormRegistry;
        this.settings = settings;
        this.masker = new ContextMasker();
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;
        for (const file of files) {
            if (file.extension !== 'md') continue;
            try {
                const originalContent = await this.app.vault.read(file);
                
                let workingContent = this.unlinkUnsupportedAliases(originalContent);
                
                workingContent = this.linkAmbiguousTerms(workingContent, file);

                if (workingContent !== originalContent) {
                    await this.app.vault.process(file, () => workingContent);
                    count++;
                }
            } catch (e) {
                console.error(`MultiAliasLinker failed: ${file.path}`, e);
            }
        }
        return count;
    }

    private unlinkUnsupportedAliases(text: string): string {
        return text.replace(
            /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
            (match, targetRaw, _pipeGroup, aliasRaw) => {
                
                const target = targetRaw.trim();
                const alias = (aliasRaw || target).trim();
                const cleanAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();

                if (!this.multiMap.has(cleanAlias)) {
                    return match;
                }

                const textWithoutLink = text.replace(match, '');
                
                const candidates = this.multiMap.get(cleanAlias)!;
                
                const targetInContext = textWithoutLink.toLowerCase().includes(target.toLowerCase());

                if (!targetInContext) {
                    const otherCandidateSupported = candidates.some(c => 
                        c !== target && textWithoutLink.toLowerCase().includes(c.toLowerCase())
                    );

                    if (otherCandidateSupported) {
                        return alias;
                    }
                }

                return match;
            }
        );
    }

    private linkAmbiguousTerms(text: string, file: TFile): string {
        let textToProcess = text;
        const tempMasks: string[] = [];

        // 1. Masking
        if (!this.settings.enableTableLinking) {
            textToProcess = textToProcess.replace(REGEX_PATTERNS.MASK_TABLE_ROW, (m) => {
                tempMasks.push(m); return `___TEMP_${tempMasks.length - 1}___`;
            });
        }
        if (!this.settings.linkMathBlocks) {
            textToProcess = textToProcess.replace(/\$[^$]+\$/g, (m) => {
                tempMasks.push(m); return `___TEMP_${tempMasks.length - 1}___`;
            });
        }

        const working = this.masker.mask(textToProcess, new Map());
        const tokens = Tokenizer.tokenize(working);
        const resultTokens = [...tokens];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (!Tokenizer.isWord(token)) continue;
            if (token.startsWith('___MASK_')) continue;
            if (token.startsWith('___TEMP_')) continue;

            const cleanToken = token.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            const key = cleanToken.toLowerCase();

            if (this.multiMap.has(key)) {
                const candidates = this.multiMap.get(key)!;

                const candidatesInContext = candidates.filter(c => 
                    textToProcess.toLowerCase().includes(c.toLowerCase())
                );

                if (candidatesInContext.length === 1) {
                    const target = candidatesInContext[0];
                    const prevToken = i > 0 ? tokens[i-1] : "";

                    if (RecursionGuard.isSafeToLink(target, file, cleanToken, prevToken)) {
                        const link = (cleanToken === target) 
                            ? `[[${target}]]` 
                            : `[[${target}|${cleanToken}]]`;

                        resultTokens[i] = link;
                    }
                }
            }
        }

        let unmaskedText = this.masker.unmask(resultTokens.join(''));
        unmaskedText = unmaskedText.replace(/___TEMP_(\d+)___/g, (m, i) => tempMasks[parseInt(i, 10)] || m);

        return unmaskedText;
    }
}