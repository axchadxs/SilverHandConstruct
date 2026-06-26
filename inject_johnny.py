"""
Reads johnny_lines.txt and injects the best lines into styles.js
as few-shot examples so the chatbot sounds more like Johnny.

Usage:
  1. Put this script in your SilverHandConstruct folder
  2. Put johnny_lines.txt in the same folder
  3. Run: python3 inject_johnny.py
  4. It will update src/styles.js automatically
"""

import re

# ── Step 1: Read and filter the scraped lines ──────────────────────
print("Reading johnny_lines.txt...")

with open("johnny_lines.txt", "r", encoding="utf-8") as f:
    raw = f.read()

# Split into individual lines, strip whitespace
all_lines = [l.strip() for l in raw.split("\n") if l.strip()]

# Remove the header lines
all_lines = [l for l in all_lines if not l.startswith("Johnny Silverhand") and not l.startswith("===")]

# Filter for quality:
# - At least 20 characters (not just "Yeah." or "Let's go.")
# - Not too long (over 1000 chars gets unwieldy)
# - No lines that are just stage directions in brackets
good_lines = [
    l for l in all_lines
    if 20 <= len(l) <= 1000
    and not l.startswith("[")
    and not l.startswith("(")
]

print(f"Total lines scraped: {len(all_lines)}")
print(f"Good quality lines: {len(good_lines)}")

selected = good_lines
selected.sort(key=lambda x: len(x))  # shorter lines first, builds up naturally

print(f"Selected {len(selected)} lines for the system prompt\n")

# ── Step 2: Format as few-shot examples ───────────────────────────
examples_block = "\n\nHere are real lines Johnny speaks in the game. This is his actual voice — study the rhythm, the attitude, the word choices:\n\n"
for line in selected:
    examples_block += f'"{line}"\n\n'
examples_block += "Match this voice exactly. Short. Direct. No bullshit."

# ── Step 3: Read current styles.js ────────────────────────────────
print("Reading src/styles.js...")
with open("src/styles.js", "r", encoding="utf-8") as f:
    styles_content = f.read()

# ── Step 4: Find Johnny's system prompt and inject the examples ───
# We look for the closing backtick of Johnny's system template literal
# and insert the examples block just before it

# Find the Johnny entry's system prompt — it ends before the next `,`
# Pattern: find `system: \`...content...\`` for the johnny entry
pattern = r'(id:\s*"johnny".*?system:\s*`)(.*?)(`\s*,?\s*\n\s*\})'

def inject_examples(match):
    before = match.group(1)   # system: `
    content = match.group(2)  # existing prompt text
    after = match.group(3)    # closing backtick
    
    # Remove any previously injected examples block so we don't double-up
    content = re.sub(r'\n\nHere are real lines Johnny speaks.*', '', content, flags=re.DOTALL)
    
    return before + content + examples_block + after

new_content = re.sub(pattern, inject_examples, styles_content, flags=re.DOTALL)

if new_content == styles_content:
    print("⚠️  Couldn't find Johnny's system prompt in styles.js.")
    print("   Make sure you're running this from your SilverHandConstruct folder.")
else:
    # ── Step 5: Write updated styles.js ───────────────────────────
    with open("src/styles.js", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("✅ src/styles.js updated successfully!")
    print("\nFirst 3 injected lines:")
    for line in selected[:3]:
        print(f'  "{line[:80]}..."')
    print("\nRestart your dev server (npm run dev) and test Johnny — he should sound more authentic now.")
