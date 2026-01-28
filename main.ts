import { Plugin, Notice, normalizePath } from 'obsidian';
import { AsyncVaultIndex } from './utils/AsyncVaultIndex';
import { FilenameRenamer } from './processors/FilenameRenamer';
import { AliasGenerator } from './processors/AliasGenerator';
import { AutoLinker } from './processors/AutoLinker';
import { MultiAliasLinker } from './processors/MultiAliasLinker';
import { LinkSanitizer } from './processors/LinkSanitizer';
import { GardenerSettingTab } from './settings/GardenerSettingTab';
import { ConfirmationModal } from './modals/ConfirmationModal';
import { RedundantLinkPatternSanitizer } from './processors/RedundantLinkPatternSanitizer';
import { AliasSanitizer } from './processors/AliasSanitizer';
import { ScientificSuffixManager } from './processors/ScientificSuffixManager';
import { EdgeCaseManager } from './processors/EdgeCaseManager';

export interface VaultGardenerSettings {
    enableRenamer: boolean;
    enableAliases: boolean;
    enableSanitizer: boolean;
    enableAutoLinker: boolean;
    enableTableLinking: boolean;
    generateScientificAbbreviations: boolean;
    generateIons: boolean;
    ignoredWords: string;
    ignoredFolders: string;
    skipConfirmationModal: boolean;
    linkMathBlocks: boolean;
}

const DEFAULT_SETTINGS: VaultGardenerSettings = {
    enableRenamer: true,
    enableAliases: true,
    enableSanitizer: true,
    enableAutoLinker: true,
    enableTableLinking: false,
    generateScientificAbbreviations: true,
    generateIons: true,
    ignoredWords: '',
    ignoredFolders: 'Templates, archive, bin',
    skipConfirmationModal: false,
    linkMathBlocks: false,
}

export default class VaultGardener extends Plugin {
    settings: VaultGardenerSettings;
    statusBarItem: HTMLElement;

    async onload() {
        await this.loadSettings();
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText(""); 
        
        this.addRibbonIcon('sprout', 'Garden', () => {
            if (this.settings.skipConfirmationModal) { 
                void this.runSequence(); 
            } else { 
                new ConfirmationModal(this.app, this.settings, () => { 
                    void this.runSequence(); 
                }).open(); 
            }
        });

        this.addSettingTab(new GardenerSettingTab(this.app, this));
        
        this.addCommand({
            id: 'run-gardener', 
            name: 'Run cleanup', 
            callback: () => {
                if (this.settings.skipConfirmationModal) { 
                    void this.runSequence(); 
                } else { 
                    new ConfirmationModal(this.app, this.settings, () => { 
                        void this.runSequence(); 
                    }).open(); 
                }
            }
        });
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as Partial<VaultGardenerSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async runSequence() {
        new Notice("Gardening started...");
        this.statusBarItem.setText("Gardening...");
        
        const allFiles = this.app.vault.getMarkdownFiles();
        const ignoredPaths = this.settings.ignoredFolders.split(',').map(s => normalizePath(s.trim())).filter(s => s.length > 0);
        const files = allFiles.filter(file => {
            if (file.extension !== 'md') return false;
            for (const ignored of ignoredPaths) { if (file.path.startsWith(ignored)) return false; }
            return true;
        });

        const indexer = new AsyncVaultIndex(this.app, this.settings);
        const renamer = new FilenameRenamer(this.app);
        const generator = new AliasGenerator(this.app, this.settings);

        const MAX_LOOPS = 5;
        let loopCount = 0;
        let totalChangesInRun = 0;

        try {
            while (loopCount < MAX_LOOPS) {
                loopCount++;
                let changesThisLoop = 0;
                this.statusBarItem.setText(`Pass ${loopCount}/${MAX_LOOPS}...`);
                let renameHistory = new Map<string, string>();

                if (this.settings.enableRenamer) {
                    renameHistory = await renamer.process(files);
                    changesThisLoop += renameHistory.size;
                }

                if (loopCount === 1) {
                    const aliasSanitizer = new AliasSanitizer(this.app);
                    const c = await aliasSanitizer.process(files);
                    changesThisLoop += c;
                }

                if (this.settings.enableAliases) {
                    const c = await generator.process(files, renameHistory);
                    changesThisLoop += c;
                }

                if (loopCount === 1) {
                    const suffixManager = new ScientificSuffixManager(this.app);
                    const c = await suffixManager.processMaintenance(files);
                    changesThisLoop += c;
                    if (c > 0) await this.sleep(300);
                }

                const patternSanitizer = new RedundantLinkPatternSanitizer(this.app);
                const psC = await patternSanitizer.process(files); 
                changesThisLoop += psC;

                let indexData = null;
                if (this.settings.enableSanitizer || this.settings.enableAutoLinker) {
                    indexData = await indexer.buildIndex(files); 
                }

                if (this.settings.enableSanitizer && indexData) {
                    const lsC = await new LinkSanitizer(this.app, indexData).process(files);
                    changesThisLoop += lsC;
                    if (lsC > 0) await this.sleep(300);
                }

                if (this.settings.enableAutoLinker && indexData && loopCount === 1) {
                     const suffixManager = new ScientificSuffixManager(this.app);
                     const smC = await suffixManager.linkContent(files, indexData);
                     changesThisLoop += smC;
                }

                if (this.settings.enableAutoLinker && indexData) {
                    if (loopCount === 1) {
                         const multiLinker = new MultiAliasLinker(this.app, indexData.multiMap, indexData.shortFormRegistry, this.settings);
                         const mlC = await multiLinker.process(files);
                         changesThisLoop += mlC;
                    }
                    const autoLinker = new AutoLinker(this.app, indexData.uniqueMap, indexData.shortFormRegistry, this.settings);
                    const alC = await autoLinker.process(files);
                    changesThisLoop += alC;
                }

                if (indexData) {
                    const edgeManager = new EdgeCaseManager(this.app);
                    const ecC = await edgeManager.process(files, indexData);
                    changesThisLoop += ecC;
                }

                totalChangesInRun += changesThisLoop;
                if (changesThisLoop === 0) break;
            }
            new Notice(`Gardening complete! (changes: ${totalChangesInRun})`);
        } catch (e) {
            console.error(e);
            new Notice("Error.");
        } finally {
            this.statusBarItem.setText("");
        }
    }

    sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
}