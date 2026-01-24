import { REGEX_PATTERNS } from '../utils/RegexPatterns';
import { Tokenizer } from '../utils/Tokenizer';

export interface MatchResult {
    matched: boolean;
    advanceIndices: number;
    linkText: string;
    target: string;
}

export class WindowMatcher {
    
    static findMatch(
        tokens: string[], 
        currentIndex: number, 
        maxWindow: number, 
        aliasMap: Map<string, string>,
        startWords: Set<string>,
        shortFormRegistry: Map<string, Set<string>>
    ): MatchResult {
        
        const firstToken = tokens[currentIndex];
        const cleanFirst = firstToken.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '').toLowerCase();

        if (!startWords.has(cleanFirst)) {
            return { matched: false, advanceIndices: 0, linkText: '', target: '' };
        }

        for (let len = maxWindow; len >= 1; len--) {
            const phraseTokens: string[] = [];
            let validWordsFound = 0;
            let offset = 0;

            for (let k = 0; k < 50; k++) {
                if (currentIndex + k >= tokens.length) break;
                
                const t = tokens[currentIndex + k];
                
                if (Tokenizer.isWord(t)) {
                    phraseTokens.push(t);
                    validWordsFound++;
                } else {
                    if (validWordsFound < len) {
                        phraseTokens.push(t);
                    }
                }
                
                offset = k;
                if (validWordsFound === len) break;
            }

            if (validWordsFound !== len) continue;

            const candidateRaw = phraseTokens.join('');
            const candidateClean = candidateRaw.replace(REGEX_PATTERNS.UNDERSCORES_WRAPPER, '');
            
            const candidateKey = candidateClean.replace(/\s+/g, ' ').toLowerCase();

            if (aliasMap.has(candidateKey)) {
                const target = aliasMap.get(candidateKey)!;

                if (candidateClean.length <= 3) {
                    const allowedForms = shortFormRegistry.get(candidateKey);
                    if (allowedForms && !allowedForms.has(candidateClean)) {
                        continue; 
                    }
                }

                if (/^\d+$/.test(candidateClean) && !candidateClean.includes('$')) {
                    continue; 
                }

                return {
                    matched: true,
                    advanceIndices: offset,
                    linkText: candidateRaw,
                    target: target
                };
            }
        }

        return { matched: false, advanceIndices: 0, linkText: '', target: '' };
    }
}