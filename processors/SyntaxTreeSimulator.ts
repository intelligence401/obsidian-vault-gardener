export class SyntaxTreeSimulator {
    
    private static readonly SCAN_LIMIT = 1000;

    static isInsideWikiLink(text: string, index: number): boolean {
        let openIndex = -1;
        const startSearch = Math.max(0, index - this.SCAN_LIMIT);
        
        for (let i = index; i >= startSearch; i--) {
            if (text[i] === '[' && text[i-1] === '[') {
                openIndex = i - 1;
                break;
            }
            if (text[i] === '\n') return false;
            if (text[i] === ']' && text[i-1] === ']') return false;
        }

        if (openIndex === -1) return false;

        const endSearch = Math.min(text.length, index + this.SCAN_LIMIT);

        for (let i = index; i < endSearch; i++) {
            if (text[i] === ']' && text[i+1] === ']') {
                return true;
            }
            if (text[i] === '\n') return false;
            if (text[i] === '[' && text[i+1] === '[') return false;
        }

        return false;
    }

    static containsLinkSyntax(originalText: string): boolean {
        return originalText.includes('[[') || originalText.includes(']]');
    }
}