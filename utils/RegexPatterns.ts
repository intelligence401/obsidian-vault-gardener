export const REGEX_PATTERNS = {
    MASK_YAML: /^---\n[\s\S]*?\n---/,
    MASK_MATH: /(\$\$[\s\S]*?\$\$|\$(?=[^$\n]*[{}^_[\]|])[^$\n]+\$)/g,
    MASK_CODE: /(`{3}[\s\S]*?`{3}|`[^`\n]{1,1000}`)/g,
    MASK_TABLE_ROW: /(^|\n)\s*\|.*\|\s*(?=\n|$)/g,
    
    get MASK_AREAS() {
        return /(`{3}[\s\S]*?`{3}|`[^`\n]{1,1000}`|\$\$[\s\S]*?\$\$|\$(?=[^$\n]*[{}^_[\]|])[^$\n]+\$|\[\[[^\]]{1,500}\]\]|\[[^\]]{1,500}\]\([^)]{1,500}\))/g;
    },

    TOKENIZER_SPLIT: /([^a-zA-Z0-9$_\-\u2018\u2019'{}\u2070-\u209F\x2F]+)/,
    
    LINK_WITH_UNDERSCORE_ALIAS: /\[\[([^\]]{1,500})\|(_[^\]]{1,500})\]\]/g,
    UNDERSCORES_WRAPPER: /^[_$]+|[_$]+$/g,
    LINK_WITH_UNDERSCORE_TARGET: /\[\[(_[^\]|]{1,500}_)\]\]/g
};