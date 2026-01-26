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

    static normalize(text: string): string {
        let clean = text;
        if (clean.includes('$')) {
            clean = clean.replace(/\$/g, '');
            for (const [key, val] of Object.entries(this.greekMap)) {
                const regex = new RegExp(key.replace(/\\/g, '\\\\'), 'g');
                clean = clean.replace(regex, val);
            }
            clean = clean.replace(/[_^{}\\]/g, '');
        }
        let ascii = '';
        for (const char of clean) {
            if (this.subMap[char]) ascii += this.subMap[char];
            else if (this.supMap[char]) ascii += this.supMap[char];
            else ascii += char;
        }
        return ascii.trim();
    }
}