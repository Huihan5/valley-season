# Valley Season 河谷季

A text-based estate management game set in the Duchy of Valewisp, Kingdom of Marigni.

---

## For the Designer (that's you, Huihan)

### Your Role
You review and approve. You don't edit code or narrative files manually. Your tools are:
- **This chat** (or a Claude.ai project) for design decisions, world-building, and critique
- **Claude Code** for all implementation — code, narrative text, iteration
- **Your eyes and taste** for quality control

### What's in this repo

```
docs/           ← YOUR design authority. Claude Code reads these but never modifies them without permission.
  GDD.md        ← (To be added: convert your .docx GDD here with all revisions applied)
  NUMBERS.md    ← Resource balance tables, all game values
  WORLDBOOK.md  ← Marigni setting reference (condensed from your setting documents)
  STYLE_GUIDE.md← Writing tone, sensory palette, NPC voices, religious terminology
  CHANGELOG.md  ← Claude Code logs all changes here for your review

CLAUDE.md       ← Claude Code's "brain" — project rules, architecture, workflow
src/            ← All code and content lives here (Claude Code's workspace)
```

### How to Give Feedback
After Claude Code completes a phase, review and give feedback in natural language:
- "结局三的文字不够好，Marta的语气太正式了，她应该更直接"
- "收割的数值感觉太容易了，把基础效率从3降到2试试"
- "这段场景描写的温度不对，参考STYLE_GUIDE里的嗅觉部分重写"

Claude Code will update the code/content and log changes in CHANGELOG.md.

---

## Getting Started with Claude Code

### Prerequisites
- Node.js 18+ installed
- A paid Claude subscription (Pro or above)

### Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### First Session
```bash
cd valley-season
claude
```

Browser will open for authentication. After login, you're in.

### Your First Prompt to Claude Code

Copy-paste this to kick off Phase 1:

```
Read all files in docs/ to understand the project. Then:

1. Initialize the project: npm init, install React + Vite + Tailwind
2. Implement Phase 1 (Core Loop):
   - TimeSystem: 30-day cycle, 3 phases per day (morning/afternoon/evening)
   - Basic scene switching: player picks a location → sees placeholder text
   - ChoicePanel: 2-3 buttons that advance time
   - StatusPanel: shows Day number, phase, and placeholder resource values
   - The game should be playable from Day 1 to Day 30 with placeholder content

Refer to docs/NUMBERS.md for all values. Refer to CLAUDE.md for architecture rules.
Log everything you do in docs/CHANGELOG.md.
```

### Useful Commands Inside Claude Code
- `/compact` — compress conversation to save context when it gets long
- `/clear` — start fresh context (use between phases)
- Just type naturally — "现在开始做Phase 2" works fine

---

## Pending Design Decisions

These items are flagged in CHANGELOG.md and need your input before Phase 2-3:

1. **GDD.md conversion**: Your .docx GDD needs to be converted to Markdown and placed in docs/GDD.md with all revisions (匠师 rename, 炉堂 addition) applied. Claude Code can do this — just ask it.

2. **Hartmann mystery spine**: The internal story structure (what Hartmann found, why he left, what the forest marks mean, who the traveler is) needs to be defined before Phase 3 events can be written. This is a design decision only you can make.

3. **Audio direction**: Not in current scope but worth noting for future phases.

---

## License
Private project. All rights reserved.
