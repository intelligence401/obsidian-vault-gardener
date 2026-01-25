import { App, PluginSettingTab, Setting } from 'obsidian';
import VaultGardener from '../main';

export class GardenerSettingTab extends PluginSettingTab {
    plugin: VaultGardener;

    constructor(app: App, plugin: VaultGardener) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Vault gardener settings')
            .setHeading();

        new Setting(containerEl)
            .setName('Active processors')
            .setHeading();
        
        new Setting(containerEl)
            .setName('Enable filename renamer')
            .setDesc('Converts "$a$" to "a" in filenames while preserving the alias.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableRenamer)
                .onChange(async (value) => {
                    this.plugin.settings.enableRenamer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable alias generator')
            .setDesc('Generates plurals and clean variations for your frontmatter.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAliases)
                .onChange(async (value) => {
                    this.plugin.settings.enableAliases = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable link sanitizer')
            .setDesc('Fixes malformed links and applies scientific citation styles.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSanitizer)
                .onChange(async (value) => {
                    this.plugin.settings.enableSanitizer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable auto-linker')
            .setDesc('Scans text and creates new links based on your vault index.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoLinker)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoLinker = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Safety & exclusions')
            .setHeading();

        new Setting(containerEl)
            .setName('Skip confirmation modal')
            .setDesc('If enabled, the cleanup command will execute immediately without asking for confirmation. Use with caution!')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.skipConfirmationModal)
                .onChange(async (value) => {
                    this.plugin.settings.skipConfirmationModal = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignored folders')
            .setDesc('Comma-separated list of folder paths to skip (e.g. "Templates, Archive/Old").')
            .addTextArea(text => text
                .setPlaceholder('Templates, Archive')
                .setValue(this.plugin.settings.ignoredFolders)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredFolders = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignored stopwords')
            .setDesc('Comma-separated list of words to never link.')
            .addTextArea(text => text
                .setPlaceholder('the, and, or')
                .setValue(this.plugin.settings.ignoredWords)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredWords = value;
                    await this.plugin.saveSettings();
                }));
    }
}