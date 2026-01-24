# Vault Gardener

**Vault Gardener** is an opinionated, atomic pipeline for maintaining strict strict ontological hygiene within an Obsidian vault. It is designed for scientific, academic, or highly-structured vaults where consistency between filenames, metadata, and content links is critical.

Unlike standard "linker" plugins, Vault Gardener operates on a **"State of Truth"** philosophy: The File System is the source of truth, the Metadata reflects that truth, and the Content is subservient to it.

## ⚠️ Data Safety Warning
This plugin performs **Automated File Renaming** and **Batch Content Modification**. 
- It uses an **Optimistic Locking** mechanism to prevent data races.
- It respects a **Baton Pass** architecture to ensure metadata persists during renaming.
- **Backup your vault** before the first run.

---

## Core Architecture: The 5-Phase Pipeline

When executed, the plugin runs a strict linear sequence. It creates a robust in-memory index before touching content to ensure referential integrity.

### Phase 1: Filename Normalization (The Renamer)
Enforces file naming conventions while preserving the "Scientific Identity" of the file in metadata.
- **LaTeX Handling:** Automatically converts illegal filename characters to plain text while saving the original formatting as an alias.
    - *Example:* `chlorophyll $a$.md` (illegal) $\to$ Renames to `chlorophyll a.md` $\to$ Adds `chlorophyll $a$` to frontmatter aliases.
- **Baton Pass:** Uses an in-memory state transfer to ensure the alias is written to the new file handle immediately, bypassing file-system cache latency.

### Phase 2: Alias Generation (The Morphologist)
Deterministically generates aliases based on the filename and existing frontmatter.
- **Preservation:** "VIP" aliases containing LaTeX (`$`) are never discarded.
- **Morphology:** Automatically generates plurals (`s`, `ss`) and Latin/Greek variations (`-um` $\to$ `-a`, `-is` $\to$ `-es`).
- **Hygiene:** Actively prunes "garbage" aliases (e.g., recursive wrappers like `_word_`) and prevents "stuttering" plurals (`asss`).

### Phase 3: Indexing (The State of Truth)
Builds a comprehensive map of your vault.
- **Stopword Logic:** Ignores common words ("the", "and") *unless* they are explicitly defined in ALL CAPS in frontmatter (e.g., "HAS" vs "has").
- **Strict Registry:** Enforces case-sensitivity for short acronyms ($le$ 3 chars) to prevent false positives (e.g., linking the word "per" to a file aliased "PER").

### Phase 4: Link Sanitization (The Pruner)
Prepares the content for linking by removing "parasitic" or malformed links.
- **Scientific Reset:** Identifies links where the alias contains LaTeX (e.g., `[[Target|Value $x$]]`) and strips them back to plain text. This allows the Auto-Linker to re-apply consistent citation styling in Phase 5.
- **Redundancy Pruning:** Removes self-referencing aliases (e.g., `[[Target|Target]]` $\to$ `[[Target]]`).

### Phase 5: Auto-Linking (The Weaver)
Scans text content to create WikiLinks based on the Index.
- **Context Masking:** Protects YAML, Code Blocks, and Complex Math blocks (`$$...$$`) from modification.
- **Smart Math Detection:** Distinguishes between "Structural Math" (hidden) and "Inline Variables" (exposed). E.g., `$P_{680}$` is treated as a linkable entity if it exists in the index.
- **Citation Style:** Enforces a "Text + Link" style for scientific terms.
    - *Input:* `tes $a$`
    - *Output:* `tes $a$ [[test a]]`
- **Recursion Guard:** Prevents linking inside existing links or immediately preceding existing links.

---

## Configuration

### Module Toggles
You can enable/disable specific phases of the pipeline:
- **Renamer:** Turn off if you do not want files moved.
- **Aliases:** Turn off if you want full manual control over metadata.
- **Auto-Linker:** Turn off to use the plugin only for file organization.

### Exclusions
- **Ignored Folders:** Comma-separated list of folders (e.g., `Templates, Archive`). Files in these directories will be read for indexing but **never modified**.
- **Ignored Stopwords:** Add custom words to exclude from auto-linking.

---

## Developer Notes

This plugin uses **ESBuild** and **ESLint**.
