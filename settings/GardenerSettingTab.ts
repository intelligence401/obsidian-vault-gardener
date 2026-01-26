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
            .setName('Safety')
            .setHeading();

        new Setting(containerEl)
            .setName('Skip confirmation')
            .setDesc('Run immediately without showing the confirmation modal.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.skipConfirmationModal)
                .onChange(async (value) => {
                    this.plugin.settings.skipConfirmationModal = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignored folders')
            .setDesc('Comma-separated list of folders to ignore.')
            .addText(text => text
                .setPlaceholder('E.g. templates, archive, bin')
                .setValue(this.plugin.settings.ignoredFolders)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredFolders = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignored words')
            .setDesc('Comma-separated list of words to never link (e.g. stopwords).')
            .addTextArea(text => text
                .setPlaceholder('The, and, or')
                .setValue(this.plugin.settings.ignoredWords)
                .onChange(async (value) => {
                    this.plugin.settings.ignoredWords = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Processors')
            .setHeading();

        new Setting(containerEl)
            .setName('Filename renamer')
            .setDesc('Renames files based on rules.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableRenamer)
                .onChange(async (value) => {
                    this.plugin.settings.enableRenamer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Alias generator')
            .setDesc('Generates frontmatter aliases automatically.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAliases)
                .onChange(async (value) => {
                    this.plugin.settings.enableAliases = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Generate scientific abbreviations')
            .setDesc('E.g. "Escherichia coli" -> "E. coli"')
            .setClass('setting-indent')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.generateScientificAbbreviations)
                .onChange(async (value) => {
                    this.plugin.settings.generateScientificAbbreviations = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Generate ions')
            .setDesc('E.g. "Magnesium" -> "Mg2+"')
            .setClass('setting-indent')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.generateIons)
                .onChange(async (value) => {
                    this.plugin.settings.generateIons = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-linker')
            .setDesc('Automatically creates links in text.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoLinker)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoLinker = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Link math blocks')
            .setDesc('If enabled, text inside $...$ may be linked.')
            .setClass('setting-indent')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.linkMathBlocks)
                .onChange(async (value) => {
                    this.plugin.settings.linkMathBlocks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Link table rows')
            .setDesc('If enabled, text inside Markdown tables may be linked.')
            .setClass('setting-indent')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTableLinking)
                .onChange(async (value) => {
                    this.plugin.settings.enableTableLinking = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Link sanitizer')
            .setDesc('Removes redundant links and cleans formatting.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSanitizer)
                .onChange(async (value) => {
                    this.plugin.settings.enableSanitizer = value;
                    await this.plugin.saveSettings();
                }));
    }
}