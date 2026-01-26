import { App, Modal, Setting } from 'obsidian';
import { VaultGardenerSettings } from '../main';

export class ConfirmationModal extends Modal {
    onConfirm: () => void;
    settings: VaultGardenerSettings;

    constructor(app: App, settings: VaultGardenerSettings, onConfirm: () => void) {
        super(app);
        this.onConfirm = onConfirm;
        this.settings = settings;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: '🚨 Critical vault operation' }); 
        contentEl.createEl('p', { text: 'You are about to run vault gardener. This plugin performs substantial automated modifications:' });
        
        const listEl = contentEl.createEl('ul');
        listEl.createEl('li', { text: '❌ File renaming: files matching specific patterns (e.g., scientific LaTeX) will be moved.' });
        listEl.createEl('li', { text: '📝 Metadata modification: frontmatter aliases will be generated, updated, or deleted.' });
        listEl.createEl('li', { text: '🔗 Content alteration: text in your notes will be changed to add or fix links.' });
        
        contentEl.createEl('p', { text: 'Failure to understand the implications could lead to unintended changes in your vault.' });
        contentEl.createEl('p', { text: '💡 It is strongly recommended to back up your vault now.', cls: 'mod-warning' });

        new Setting(contentEl)
            .setName('I understand the risks and do not want to see this warning again.')
            .addToggle(toggle => toggle
                .setValue(this.settings.skipConfirmationModal)
                .onChange(async (value) => {
                    this.settings.skipConfirmationModal = value;
                    await this.app.plugins.getPlugin('vault-gardener')?.saveSettings();
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Proceed with caution')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onConfirm();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}