import { App, TFile } from 'obsidian';
import { Tokenizer } from '../utils/Tokenizer';
import { ContextMasker } from './ContextMasker';
import { RecursionGuard } from './RecursionGuard';
import { VaultGardenerSettings } from '../main';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';
import { ScientificTools } from '../utils/ScientificTools';

interface SuffixGroup {
    base: string;
    modified: { target: string; modifier: string }[];
}

export class MultiAliasLinker {
    app: App;
    multiMap: Map<string, string[]>;
    shortFormRegistry: Map<string, Set<string>>;
    masker: ContextMasker;
    settings: VaultGardenerSettings;

    suffixGroups: Map<string, SuffixGroup>;

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
        this.suffixGroups = new Map();
        
        this.buildSuffixGroups();
    }

    private buildSuffixGroups() {
        for (const [alias, targets] of this.multiMap.entries()) {
            if (!ScientificTools.isScientificSuffixFile(alias) && alias.length > 3) continue;
            
            const allSuffixFiles = targets.every(t => ScientificTools.isScientificSuffixFile(t));
            if (!allSuffixFiles) continue;

            const sorted = [...targets].sort((a, b) => a.length - b.length);
            const base = sorted[0];
            const others = sorted.slice(1);

            const modifiedList: { target: string, modifier: string }[] = [];
            
            for (const other of others) {
                if (other.toLowerCase().endsWith(base.toLowerCase())) {
                    const modifier = other.slice(0, other.length - base.length).trim();
                    if (modifier.length > 0) {
                        modifiedList.push({ target: other, modifier });
                    }
                }
            }

            if (modifiedList.length > 0) {
                this.suffixGroups.set(alias, { base, modified: modifiedList });
            }
        }
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
            } catch {
                // Ignore error
            }
        }
        return count;
    }

    private unlinkUnsupportedAliases(text: string): string {
        return text.replace(
            /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
            (match: string, targetRaw: string, _pipeGroup: string, aliasRaw: string) => {
                
                const target = targetRaw.trim();
                const alias = (aliasRaw || target).trim();
                const cleanAlias = alias.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();

                if (!this.multiMap.has(cleanAlias)) {
                    return match;
                }
                
                if (this.suffixGroups.has(cleanAlias)) {
                    return alias;
                }

                const textWithoutLink = text.replace(match, '');
                const candidates = this.multiMap.get(cleanAlias);
                
                if (!candidates) return match;

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

        if (!this.settings.enableTableLinking) {
            textToProcess = textToProcess.replace(REGEX_PATTERNS.MASK_TABLE_ROW, (m: string) => {
                tempMasks.push(m); return `___TEMP_${tempMasks.length - 1}___`;
            });
        }
        if (!this.settings.linkMathBlocks) {
            textToProcess = textToProcess.replace(/\$[^$]+\$/g, (m: string) => {
                tempMasks.push(m); return `___TEMP_${tempMasks.length - 1}___`;
            });
        }

        const working = this.masker.mask(textToProcess, new Map());
        const tokens = Tokenizer.tokenize(working);
        const resultTokens = [...tokens];
        const lowerText = textToProcess.toLowerCase();
        let currentOffset = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (!Tokenizer.isWord(token)) {
                currentOffset += token.length;
                continue;
            }
            if (token.startsWith('___MASK_') || token.startsWith('___TEMP_')) {
                currentOffset += token.length;
                continue;
            }

            const cleanToken = token.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            const key = cleanToken.toLowerCase();

            const matchStrLen = token.length;

            const nextCharIndex = currentOffset + matchStrLen;
            if (nextCharIndex < working.length && working[nextCharIndex] === '/') {
                currentOffset += token.length;
                continue;
            }

            if (this.suffixGroups.has(key)) {
                const group = this.suffixGroups.get(key);
                if (group) {
                    let bestTarget = group.base;

                    for (const mod of group.modified) {
                        if (lowerText.includes(mod.modifier.toLowerCase())) {
                            bestTarget = mod.target;
                            break; 
                        }
                    }

                    const prevToken = i > 0 ? tokens[i-1] : "";
                    if (RecursionGuard.isSafeToLink(bestTarget, file, cleanToken, prevToken)) {
                        const link = `[[${bestTarget}|${token}]]`;
                        resultTokens[i] = link;
                        currentOffset += token.length;
                        continue;
                    }
                }
            }

            if (this.multiMap.has(key)) {
                const candidates = this.multiMap.get(key);
                if (!candidates) {
                    currentOffset += token.length;
                    continue;
                }

                const candidatesInContext = candidates.filter(c => 
                    lowerText.includes(c.toLowerCase())
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
            currentOffset += token.length;
        }

        let unmaskedText = this.masker.unmask(resultTokens.join(''));
        unmaskedText = unmaskedText.replace(/___TEMP_(\d+)___/g, (m: string, i: string) => tempMasks[parseInt(i, 10)] || m);

        return unmaskedText;
    }
}