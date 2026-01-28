# Vault Gardener

**Turn your text into a connected knowledge base.**

Vault Gardener is an auto-linker tool for Obsidian. It scans your vault to generate plural aliases, and—most importantly—**automatically create links** inside your notes based on your existing files.

It is designed specifically for **scientific, academic, and highly structured vaults** where standard auto-linkers fail (e.g., handling Greek letters, chemical formulas like $CO_2$, and LaTeX formatting).

## ⚡ Key Features

### 1. Auto-Linking (The Main Focus)

Links mentions of a filename or alias automatically throughout your entire vault.

### 2. Smart Alias Generation

Generates plural and underscore variants of existing files and their aliases to subsequently link them.

### 3. Filename Normalization

Moves underscores from the filename to the aliases.

### 4. Edge case handling

Handles special characters and math blocks ("CO₂", "chlorophylls $a$", ...).

---

## 🔍 Before & After

**Before Gardening:**
> The oligotrophy of the lake led to a decline in cyanobacteria and chlorophyll a levels.

**After Gardening:**
> The [[oligotrophy]] of the lake led to a decline in [[cyanobacteria]] and [[chlorophyll a]] levels.

---

## ⚠️ Safety First

This plugin modifies your files in batches. While it includes safety checks to prevent data loss:
1.  **Please back up your vault** before the first run.
2.  Check the settings to enable/disable specific modules (Renamer, Aliases, Linker) based on your needs.

---

## Installation & Usage

Vault Gardener requires no special setup. There is only one command which can be run to garden your vault. file renaming, aliasing and edge case handling can be turned on or off in the settings. Certain folders or words can be exempted from gardening completely, such as the templtes folder.