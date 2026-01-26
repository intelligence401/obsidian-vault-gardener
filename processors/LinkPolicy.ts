export class LinkPolicy {
    static shouldLink(
        precedingLinkTarget: string | null, 
        candidateTarget: string
    ): boolean {
        if (!precedingLinkTarget) return true;
        
        if (precedingLinkTarget !== candidateTarget) return false;

        if (precedingLinkTarget === candidateTarget) return false;

        return true; 
    }

    static isRedundant(
        precedingLinkTarget: string | null,
        candidateTarget: string
    ): boolean {
        if (!precedingLinkTarget) return false;
        return precedingLinkTarget === candidateTarget;
    }
}