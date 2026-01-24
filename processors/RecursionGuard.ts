import { TFile } from 'obsidian';

export class RecursionGuard {

    static isSafeToLink(
        targetBasename: string, 
        currentFile: TFile, 
        candidateText: string,
        precedingContext: string = ""
    ): boolean {
        
        if (precedingContext.trim().endsWith('[')) {
            return false;
        }

        return true;
    }
}