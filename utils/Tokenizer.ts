import { REGEX_PATTERNS } from './RegexPatterns';

export class Tokenizer {
    static tokenize(text: string): string[] {
        return text.split(REGEX_PATTERNS.TOKENIZER_SPLIT);
    }

    static isWord(token: string): boolean {
        return /[a-zA-Z0-9$_\-\u2018\u2019'{}\u2070-\u209F\x2F\\]/.test(token);
    }
}