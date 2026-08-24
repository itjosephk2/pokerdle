# 🃏 Pokerdle

A Wordle-style poker hand guessing game. Guess the secret 5-card poker hand in 6 tries using combinatorics and poker knowledge.

**[Play Pokerdle](https://itjosephk2.github.io/pokerdle/)**

![Pokerdle Screenshot](screenshot.png)

## How It Works

You're given the **hand type** (e.g., "Two Pair", "Flush") as a hint. From there, use deduction to figure out the exact 5 cards.

Both your guess and the secret hand are **sorted in ascending order by rank**, so each card slot lines up for direct comparison.

### Feedback Colors

Each card in your guess is compared against the same slot in the secret hand:

| Color | Meaning |
|-------|---------|
| 🟩 **Green** | Exact match — right rank and suit in this slot |
| 🟧 **Orange** | This exact card is in the hand but in a different slot |
| 🟨 **Yellow** | Rank matches this slot but suit is wrong |
| 🟦 **Blue** | Suit matches this slot but rank is wrong |
| ⬛ **Gray** | Neither rank nor suit matches this slot |

### Smart Sorting

When you guess cards of the same rank (pairs, trips, quads), the game automatically arranges them to best match the secret hand's suit order. If you have the right cards, they'll align — no frustrating swaps.

### Winning

Get all 5 cards correct. If same-rank cards are just in a different order, it still counts as a win.

## Strategy

- **Use the hand type hint.** "Full House" means 3 of one rank + 2 of another. "Flush" means all suits are the same. This massively narrows the search space.
- **Green** = lock it in, that card is perfect.
- **Orange** = you have the right card, but the sort order put it in a different slot. This typically happens with pairs/trips.
- **Yellow** = the rank is correct for this slot. Try different suits.
- **Blue** = the suit is correct for this slot. Try different ranks.
- **Gray** = both rank and suit are wrong for this slot (but could still appear elsewhere).

### Hand Type Cheat Sheet

| Hand Type | Structure | What You Know |
|-----------|-----------|---------------|
| High Card | 5 different ranks, no flush, no straight | All unique ranks |
| One Pair | 2 of one rank + 3 others | Two slots share a rank |
| Two Pair | 2 of one rank + 2 of another + 1 kicker | Two pairs of matching ranks |
| Three of a Kind | 3 of one rank + 2 others | Three slots share a rank |
| Straight | 5 consecutive ranks, mixed suits | Ranks are sequential |
| Flush | Any 5 ranks, all same suit | One guess reveals the suit |
| Full House | 3 of one rank + 2 of another | Only 2 distinct ranks |
| Four of a Kind | 4 of one rank + 1 kicker | Four slots share a rank, all 4 suits used |
| Straight Flush | 5 consecutive ranks, same suit | Sequential ranks + one suit |
| Royal Flush | 10-J-Q-K-A, same suit | You know all 5 ranks, just find the suit |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `2-9`, `J`, `Q`, `K`, `A` | Select rank |
| `1` | Select rank 10 |
| `S`, `H`, `D`, `C` | Select suit (after choosing rank) |
| `Enter` | Submit guess |
| `Backspace` | Remove last card |
| `Escape` | Clear current guess |

## Tech Stack

Pure vanilla — no frameworks, no build step, no dependencies.

- **HTML** — Game layout and modals
- **CSS** — Styling, animations, responsive design
- **JavaScript** — Game logic, DOM management, feedback engine

### File Structure

    pokerdle/
    ├── index.html    # Markup, SEO, modals
    ├── styles.css    # All styling and animations
    ├── game.js       # Game logic, rendering, events
    ├── og-image.png  # Social share preview (1200x630)
    └── README.md     # This file

## Run Locally

Clone the repo and open `index.html` in your browser. That's it. No server needed, no `npm install`.

    git clone https://github.com/itjosephk2/pokerdle.git
    cd pokerdle
    open index.html

## Deploy

Already live on GitHub Pages at **[itjosephk2.github.io/pokerdle](https://itjosephk2.github.io/pokerdle/)**.

## Share Results

After each game you can copy your results to share:

    Pokerdle 4/6

    ⬛🟨🟦🟩⬛
    🟧🟨🟩🟩🟦
    🟩🟨🟩🟩🟨
    🟩🟩🟩🟩🟩

## License

MIT — do whatever you want with it.
