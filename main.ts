import { Plugin, Notice } from 'obsidian';
import { AsyncVaultIndex } from './utils/AsyncVaultIndex';
import { FilenameRenamer } from './processors/FilenameRenamer';
import { AliasGenerator } from './processors/AliasGenerator';
import { AutoLinker } from './processors/AutoLinker';
import { LinkSanitizer } from './processors/LinkSanitizer';
import { GardenerSettingTab } from './settings/GardenerSettingTab';
import { ConfirmationModal } from './modals/ConfirmationModal';

export interface VaultGardenerSettings {
    enableRenamer: boolean;
    enableAliases: boolean;
    enableSanitizer: boolean;
    enableAutoLinker: boolean;
    ignoredWords: string;
    ignoredFolders: string;
    skipConfirmationModal: boolean;
}

const DEFAULT_SETTINGS: VaultGardenerSettings = {
    enableRenamer: true,
    enableAliases: true,
    enableSanitizer: true,
    enableAutoLinker: true,
    ignoredWords: 'the, and, but, for, not, this, that, with, from, into',
    ignoredFolders: 'Templates, Archive, bin',
    skipConfirmationModal: false
}

export default class VaultGardener extends Plugin {
    settings: VaultGardenerSettings;
    statusBarItem: HTMLElement;

    async onload() {
        console.debug("Vault Gardener: Loading plugin...");
        await this.loadSettings();

        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText(""); 

        this.addRibbonIcon('sprout', 'Run vault gardener', (_evt: MouseEvent) => {
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
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async runSequence() {
        new Notice("🌱 Gardening started...");
        this.statusBarItem.setText("🌱 Gardening: Preparing...");
        
        const allFiles = this.app.vault.getMarkdownFiles();
        const ignoredPaths = this.settings.ignoredFolders
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const files = allFiles.filter(file => {
            for (const ignored of ignoredPaths) {
                if (file.path.startsWith(ignored)) return false;
            }
            return true;
        });

        console.debug(`Processing ${files.length} files (Excluded ${allFiles.length - files.length})`);

        const indexer = new AsyncVaultIndex(this.app, this.settings);
        const renamer = new FilenameRenamer(this.app);
        const generator = new AliasGenerator(this.app);

        try {
            let renameHistory = new Map<string, string>();

            if (this.settings.enableRenamer) {
                this.statusBarItem.setText("🌱 Phase 1: Renaming...");
                renameHistory = await renamer.process(files);
            }
            
            if (this.settings.enableAliases) {
                this.statusBarItem.setText("🌱 Phase 2: Aliases...");
                await generator.process(files, renameHistory);
            }
            
            let indexData = null;
            if (this.settings.enableSanitizer || this.settings.enableAutoLinker) {
                this.statusBarItem.setText("🌱 Phase 3: Indexing...");
                indexData = await indexer.buildIndex(files); 
            }

            if (this.settings.enableSanitizer && indexData) {
                this.statusBarItem.setText("🌱 Phase 4: Pruning...");
                await new LinkSanitizer(this.app, indexData).process(files);
                
                this.statusBarItem.setText("🌱 Syncing cache...");
                await this.sleep(300); 
            }

            if (this.settings.enableAutoLinker && indexData) {
                this.statusBarItem.setText("🌱 Phase 5: Linking...");
                await new AutoLinker(this.app, indexData).process(files);
            }
            
            new Notice("✅ Gardening complete!");
        } catch (e) {
            console.error("Gardener Failed:", e);
            new Notice("❌ Error. Check Console.");
        } finally {
            this.statusBarItem.setText("");
        }
    }

    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}