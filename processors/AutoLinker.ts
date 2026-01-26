import { App, TFile } from 'obsidian';
import { Tokenizer } from '../utils/Tokenizer';
import { WindowMatcher } from './WindowMatcher';
import { ContextMasker } from './ContextMasker';
import { RecursionGuard } from './RecursionGuard';
import { VaultGardenerSettings } from '../main';
import { REGEX_PATTERNS } from '../utils/RegexPatterns';

export class AutoLinker {
    app: App;
    uniqueMap: Map<string, string>;         
    shortFormRegistry: Map<string, Set<string>>;
    startWords: Set<string>;
    masker: ContextMasker;
    maxWindow: number = 0;
    settings: VaultGardenerSettings;

    private readonly YIELD_THRESHOLD = 1000;

    constructor(
        app: App, 
        uniqueMap: Map<string, string>, 
        shortFormRegistry: Map<string, Set<string>>,
        settings: VaultGardenerSettings
    ) {
        this.app = app;
        this.settings = settings;
        this.uniqueMap = uniqueMap;
        this.shortFormRegistry = shortFormRegistry;
        this.masker = new ContextMasker();
        this.startWords = new Set();
        
        for (const key of this.uniqueMap.keys()) {
            const tokens = Tokenizer.tokenize(key);
            const firstWord = tokens.find(t => Tokenizer.isWord(t));
            if (firstWord) {
                const cleanStart = firstWord.replace(/^[_$]+|[_$]+$/g, '').toLowerCase();
                this.startWords.add(cleanStart);
            }
            const wordCount = tokens.filter(t => Tokenizer.isWord(t)).length;
            this.maxWindow = Math.max(this.maxWindow, wordCount);
        }
    }

    private async yieldToMain() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    async process(files: TFile[]): Promise<number> {
        let count = 0;

        for (const file of files) {
            if (file.extension !== 'md') continue;

            try {
                const originalContent = await this.app.vault.read(file);
                const linkedContent = await this.linkText(originalContent, file);

                if (linkedContent === originalContent) continue;

                await this.app.vault.process(file, (currentOnDisk) => {
                    if (currentOnDisk !== originalContent) {
                        return currentOnDisk;
                    }
                    count++;
                    return linkedContent;
                });
            } catch (e) {
                console.error(`AutoLinker failed: ${file.path}`, e);
            }
        }
        return count; 
    }

    async linkText(text: string, file: TFile): Promise<string> {
        let textToProcess = text;
        const tempMasks: string[] = [];

        textToProcess = textToProcess.replace(
            /(\[\[(?:[^\]|]+)(?:\|[^\]]+)?\]\]\s*)(\([^)]+\))/g, 
            (match, prefix, content) => {
                if (content.length > 100) return match;
                
                if (!content.includes('$')) {
                    return match; // Leave (PCT) alone!
                }
                
                tempMasks.push(content);
                return `${prefix}___TEMP_DEF_${tempMasks.length - 1}___`;
            }
        );

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

        this.masker = new ContextMasker(); 
        const working = this.masker.mask(textToProcess, this.uniqueMap);
        
        const tokens = Tokenizer.tokenize(working);
        const resultTokens = [...tokens]; 
        
        for (let i = 0; i < tokens.length; i++) {
            if (i % this.YIELD_THRESHOLD === 0) await this.yieldToMain();

            const token = tokens[i];
            
            if (!Tokenizer.isWord(token)) continue;
            if (token.startsWith('___MASK_')) continue;
            if (token.startsWith('___TEMP_')) continue; 

            const match = WindowMatcher.findMatch(
                tokens, i, this.maxWindow, this.uniqueMap, this.startWords, this.shortFormRegistry
            );

            if (match.matched) {
                const prevToken = i > 0 ? tokens[i-1] : "";

                if (RecursionGuard.isSafeToLink(match.target, file, match.linkText, prevToken)) {
                    
                    let link = "";
                    let shouldSkip = false;

                    if (match.linkText.includes('$')) {
                        let lookAheadStr = "";
                        const lookAheadLimit = 15; 
                        for (let k = 1; k < lookAheadLimit; k++) {
                            const idx = i + match.advanceIndices + k;
                            if (idx >= tokens.length) break;
                            lookAheadStr += tokens[idx];
                        }
                        const unmaskedLookAhead = this.masker.unmask(lookAheadStr);
                        const targetPattern = `[[${match.target}]]`;
                        if (unmaskedLookAhead.trim().startsWith(targetPattern)) {
                            shouldSkip = true; 
                        } else {
                            link = `${match.linkText} [[${match.target}]]`;
                        }
                    } else {
                        link = (match.linkText === match.target) 
                            ? `[[${match.target}]]` 
                            : `[[${match.target}|${match.linkText}]]`;
                    }

                    if (!shouldSkip) {
                        resultTokens[i] = link;
                        for (let j = 1; j <= match.advanceIndices; j++) {
                            resultTokens[i + j] = ""; 
                        }
                        i += match.advanceIndices;
                    }
                }
            }
        }

        let unmaskedText = this.masker.unmask(resultTokens.join(''));
        
        unmaskedText = unmaskedText.replace(/___TEMP_(?:DEF_)?(\d+)___/g, (m, i) => tempMasks[parseInt(i, 10)] || m);

        if (this.settings.enableTableLinking) {
            return this.escapeLinksInTables(unmaskedText);
        } else {
            return unmaskedText;
        }
    }

    private escapeLinksInTables(text: string): string {
        const lines = text.split(/\r?\n/);
        const tableLineRegex = /^\s*\|.*\|\s*$/; 

        for (let i = 0; i < lines.length; i++) {
            if (tableLineRegex.test(lines[i])) {
                lines[i] = lines[i].replace(/\[\[(.*?)\]\]/g, (match, content) => {
                    if (!content.includes('|')) return match;
                    const parts = content.split(/\\\|/g);
                    const fixedParts = parts.map(p => p.replace(/\|/g, '\\|'));
                    return `[[${fixedParts.join('\\|')}]]`;
                });
            }
        }
        return lines.join('\n');
    }
}