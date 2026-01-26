import { App, Modal, Setting } from 'obsidian';
import { VaultGardenerSettings } from '../main';

export class ConfirmationModal extends Modal {
    onConfirm: () => void;
    settings: VaultGardenerSettings;

    constructor(app: App, settings: VaultGardenerSettings, onConfirm: () => void) {
        super(app);
        this.settings = settings;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.addClass('vault-gardener-confirmation-modal');

        contentEl.createEl('h2', { text: 'Confirm cleanup' });

        const list = contentEl.createEl('ul');
        if (this.settings.enableRenamer) list.createEl('li', { text: 'Normalize filenames' });
        if (this.settings.enableAliases) list.createEl('li', { text: 'Generate aliases' });
        if (this.settings.enableSanitizer) list.createEl('li', { text: 'Sanitize links' });
        if (this.settings.enableAutoLinker) list.createEl('li', { text: 'Auto-link content' });

        contentEl.createEl('p', { text: 'This will modify files in your vault. Make sure you have a backup.' });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Run cleanup')
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