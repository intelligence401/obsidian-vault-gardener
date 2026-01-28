export class ScientificTools {
    private static subMap: Record<string, string> = {
        '₀':'0', '₁':'1', '₂':'2', '₃':'3', '₄':'4', '₅':'5', '₆':'6', '₇':'7', '₈':'8', '₉':'9',
        '₊':'+', '₋':'-', '₌':'=', '₍':'(', '₎':')'
    };
    private static supMap: Record<string, string> = {
        '⁰':'0', '¹':'1', '²':'2', '³':'3', '⁴':'4', '⁵':'5', '⁶':'6', '⁷':'7', '⁸':'8', '⁹':'9',
        '⁺':'+', '⁻':'-', '⁽':'(', '⁾':')'
    };
    private static greekMap: Record<string, string> = {
        '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', 
        '\\delta': 'delta', '\\epsilon': 'epsilon', '\\phi': 'phi',
        '\\mu': 'mu', '\\lambda': 'lambda'
    };
    public static unicodeGreekMap: Record<string, string> = {
        'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 
        'ε': 'epsilon', 'φ': 'phi', 'μ': 'mu', 'λ': 'lambda'
    };

    static normalize(text: string): string {
        let clean = text;
        if (clean.includes('$')) {
            clean = clean.replace(/\$/g, '');
            clean = clean.replace(/[_^{}]/g, ''); 
            for (const [key, val] of Object.entries(this.greekMap)) {
                const regex = new RegExp(key.replace(/\\/g, '\\\\'), 'g');
                clean = clean.replace(regex, val);
            }
            clean = clean.replace(/\\/g, '');
        }
        let ascii = '';
        for (const char of clean) {
            if (this.subMap[char]) ascii += this.subMap[char];
            else if (this.supMap[char]) ascii += this.supMap[char];
            else ascii += char;
        }
        return ascii.trim();
    }

    static unicodeToLatex(text: string): string {
        let latex = "";
        let hasSub = false;
        for (const char of text) {
            if (/[₀-₉]/.test(char)) {
                latex += `_${this.subMap[char]}`;
                hasSub = true;
            } else if (/[⁺⁻]/.test(char)) {
                latex += `^{${this.supMap[char]}}`;
                hasSub = true;
            } else {
                latex += char;
            }
        }
        if (hasSub) return `$${latex}$`;
        return text;
    }

    static hasSpecialChars(text: string): boolean {
        return /[₀-₉₊₋₌₍₎⁰-⁹⁺⁻⁽⁾]/.test(text);
    }

    static isGarbage(text: string): boolean {
        if (!text || text.trim().length === 0) return true;

        if (text.startsWith('$') && text.endsWith('_')) return true;
        if (text.startsWith('_') && text.endsWith('$')) return true;
        if (text.startsWith('__')) return true;
        if (text.endsWith('__')) return true;
        if (!text.includes('$') && /[a-zA-Z]_[0-9]/.test(text)) return true;

        const core = text.replace(/[_$]/g, '').replace(/\{.*?\}/g, '');

        if (/^[A-Z]s{0,2}$/.test(core)) return true;

        if (/[0-9]s{1,2}$/.test(core)) return true;

        if (core.endsWith('ss')) {
            const allowList = ['class', 'glass', 'grass', 'mass', 'pass', 'less', 'moss'];
            if (!allowList.includes(core.toLowerCase())) return true;
        }

        if (/s{3,}$/.test(core)) return true; // sss
        
        return false;
    }

    static isScientificSuffixFile(basename: string): boolean {
        if (basename.startsWith('Untitled')) return false;
        const regex = /\s([a-zA-Z][0-9]?|_[a-zA-Z][0-9]?_|\$[a-zA-Z][0-9]?\$)$/;
        return regex.test(basename);
    }
}