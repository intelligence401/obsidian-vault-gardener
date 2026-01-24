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
        contentEl.createEl('h2', { text: '🚨 WARNING! 🚨' });
        contentEl.createEl('p', { text: 'You are about to run Vault Gardener. This plugin performs SUBSTANTIAL automated modifications:' });
        
        const listEl = contentEl.createEl('ul');
        listEl.createEl('li', { text: 'FILE RENAMING' });
        listEl.createEl('li', { text: 'YAML FRONTMATTER ALIASES will be GENERATED, UPDATED, or DELETED.' });
        listEl.createEl('li', { text: 'TEXT will be CHANGED to ADD/REMOVE LINKS.' });
        
        contentEl.createEl('p', { text: 'Running Vault Gardener could lead to unintended changes in your vault.' });
        contentEl.createEl('p', { text: '!!!BACKUP YOUR VAULT BEFORE PROCEEDING!!!', cls: 'mod-warning' });

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
                .setButtonText('Proceed with Caution')
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