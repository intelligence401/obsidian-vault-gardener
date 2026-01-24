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

        containerEl.createEl('h2', { text: 'Vault Gardener Settings' });

        containerEl.createEl('h3', { text: 'Active Processors' });
        
        new Setting(containerEl)
            .setName('Enable Filename Renamer')
            .setDesc('Converts "$a$" to "a" in filenames while preserving the alias.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableRenamer)
                .onChange(async (value) => {
                    this.plugin.settings.enableRenamer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Alias Generator')
            .setDesc('Generates plurals and clean variations for your YAML frontmatter.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAliases)
                .onChange(async (value) => {
                    this.plugin.settings.enableAliases = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Link Sanitizer')
            .setDesc('Fixes malformed links and applies styles.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSanitizer)
                .onChange(async (value) => {
                    this.plugin.settings.enableSanitizer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Auto-Linker')
            .setDesc('Scans text and creates new links based on your vault index.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoLinker)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoLinker = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Safety & Exclusions' });

        new Setting(containerEl)
            .setName('Skip Confirmation Modal')
            .setDesc('If enabled, the "Run Gardener" command will execute immediately without asking for confirmation. Use with caution!')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.skipConfirmationModal)
                .onChange(async (value) => {
                    this.plugin.settings.skipConfirmationModal = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignored Folders')
            .setDesc('Comma-separated list of folder paths to skip (e.g. "Templates, Archive/Old").')
            .addTextArea(text => text
                .setPlaceholder('Templates, Archive')
                .setValue(this.plugin.settings.ignoredFolders)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredFolders = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignored Stopwords')
            .setDesc('Comma-separated list of words to NEVER link.')
            .addTextArea(text => text
                .setPlaceholder('the, and, or')
                .setValue(this.plugin.settings.ignoredWords)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredWords = value;
                    await this.plugin.saveSettings();
                }));
    }
}