// game.js

// ==================== CONSTANTS ====================
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const SUIT_COLORS = { '♠': 'suit-spades', '♥': 'suit-hearts', '♦': 'suit-diamonds', '♣': 'suit-clubs' };
const MAX_GUESSES = 6;
const HAND_SIZE = 5;

const RANK_ORDER = {};
RANKS.forEach((r, i) => RANK_ORDER[r] = i);

const SUIT_ORDER = {};
SUITS.forEach((s, i) => SUIT_ORDER[s] = i);

// ==================== GAME STATE ====================
let secretHand = [];
let guesses = [];
let feedbacks = [];
let currentGuess = [];
let selectedRank = null;
let gameOver = false;
let won = false;

let eliminatedRanks = new Set();
let confirmedRanks = new Set();
let presentRanks = new Set();
let eliminatedSuits = new Set();
let confirmedSuits = new Set();
let presentSuits = new Set();

// ==================== DOM REFERENCES ====================
const gridEl = document.getElementById('guessGrid');
const selectionEl = document.getElementById('currentSelection');
const rankSelectorEl = document.getElementById('rankSelector');
const suitSelectorEl = document.getElementById('suitSelector');
const submitBtn = document.getElementById('submitBtn');
const warningEl = document.getElementById('duplicateWarning');
const hintEl = document.getElementById('handTypeHint');
const toastEl = document.getElementById('toast');

let gridCards = [];
let selectionCards = [];
let rankButtons = {};
let suitButtons = {};

// ==================== DECK & HAND UTILITIES ====================
function buildDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function sortHand(hand) {
    return [...hand].sort((a, b) => {
        const rd = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
        if (rd !== 0) return rd;
        return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    });
}

function cardKey(card) {
    return card.rank + card.suit;
}

// ==================== SMART SORT ====================
// Sort the guess normally, then within same-rank groups,
// rearrange to best match the secret hand's suit order
function smartSortGuess(guess, secret) {
    // First do a normal sort
    let sorted = sortHand(guess);

    // Find groups of same-rank cards in the sorted guess
    let i = 0;
    while (i < sorted.length) {
        let j = i;
        while (j < sorted.length && sorted[j].rank === sorted[i].rank) {
            j++;
        }
        // sorted[i..j-1] all share the same rank
        if (j - i > 1) {
            // Find where this rank sits in the sorted result
            // These cards occupy slots i through j-1
            // Look at what the secret has in those same slots
            sorted = optimizeGroup(sorted, secret, i, j);
        }
        i = j;
    }

    return sorted;
}

function optimizeGroup(sorted, secret, start, end) {
    const result = [...sorted];
    const groupCards = [];
    for (let i = start; i < end; i++) {
        groupCards.push(result[i]);
    }

    // Collect the secret cards in these same slots that share this rank
    const rank = groupCards[0].rank;
    const secretSlotsWithSameRank = [];
    for (let i = start; i < end; i++) {
        if (secret[i] && secret[i].rank === rank) {
            secretSlotsWithSameRank.push(i);
        }
    }

    // Try to match guess cards to secret slots to maximize exact matches
    // Use greedy matching: first assign exact matches, then fill the rest
    const usedGuessCards = new Set();
    const usedSlots = new Set();
    const assignments = new Array(end - start).fill(null);

    // Pass 1: Find exact card matches (same suit in same slot)
    for (let si = 0; si < secretSlotsWithSameRank.length; si++) {
        const slotIdx = secretSlotsWithSameRank[si];
        const localIdx = slotIdx - start;
        const secretCard = secret[slotIdx];

        for (let gi = 0; gi < groupCards.length; gi++) {
            if (usedGuessCards.has(gi)) continue;
            if (groupCards[gi].suit === secretCard.suit) {
                assignments[localIdx] = groupCards[gi];
                usedGuessCards.add(gi);
                usedSlots.add(localIdx);
                break;
            }
        }
    }

    // Pass 2: Fill remaining slots with unmatched cards
    const remainingCards = [];
    for (let gi = 0; gi < groupCards.length; gi++) {
        if (!usedGuessCards.has(gi)) {
            remainingCards.push(groupCards[gi]);
        }
    }

    let ri = 0;
    for (let li = 0; li < end - start; li++) {
        if (!usedSlots.has(li)) {
            assignments[li] = remainingCards[ri++];
        }
    }

    // Write back
    for (let li = 0; li < end - start; li++) {
        result[start + li] = assignments[li];
    }

    return result;
}

// ==================== POKER HAND EVALUATION ====================
function evaluateHand(hand) {
    const ranks = hand.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
    const suits = hand.map(c => c.suit);

    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    const isFlush = suits.every(s => s === suits[0]);

    let isStraight = false;
    const uniqueRanks = [...new Set(ranks)];
    if (uniqueRanks.length === 5) {
        if (uniqueRanks[4] - uniqueRanks[0] === 4) {
            isStraight = true;
        }
        if (uniqueRanks[0] === 0 && uniqueRanks[1] === 1 &&
            uniqueRanks[2] === 2 && uniqueRanks[3] === 3 && uniqueRanks[4] === 12) {
            isStraight = true;
        }
    }

    if (isFlush && isStraight) {
        if (uniqueRanks[4] === 12 && uniqueRanks[0] === 8) return 'Royal Flush';
        return 'Straight Flush';
    }
    if (counts[0] === 4) return 'Four of a Kind';
    if (counts[0] === 3 && counts[1] === 2) return 'Full House';
    if (isFlush) return 'Flush';
    if (isStraight) return 'Straight';
    if (counts[0] === 3) return 'Three of a Kind';
    if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';
    if (counts[0] === 2) return 'One Pair';
    return 'High Card';
}

// ==================== HAND GENERATION ====================
function generateSecretHand() {
    const handTypes = [
        { type: 'pair', weight: 25 },
        { type: 'twopair', weight: 20 },
        { type: 'trips', weight: 15 },
        { type: 'straight', weight: 12 },
        { type: 'flush', weight: 12 },
        { type: 'fullhouse', weight: 8 },
        { type: 'quads', weight: 4 },
        { type: 'straightflush', weight: 2 },
        { type: 'highcard', weight: 2 },
    ];

    const totalWeight = handTypes.reduce((s, h) => s + h.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = 'pair';
    for (const h of handTypes) {
        r -= h.weight;
        if (r <= 0) { chosen = h.type; break; }
    }

    let hand;
    let attempts = 0;
    do {
        hand = tryGenerateHand(chosen);
        attempts++;
    } while (!hand && attempts < 100);

    if (!hand) {
        const deck = shuffle(buildDeck());
        hand = deck.slice(0, 5);
    }

    return sortHand(hand);
}

function tryGenerateHand(type) {
    function pickRanks(count) {
        const available = [...RANKS];
        shuffle(available);
        return available.slice(0, count);
    }

    function pickSuits(count) {
        const available = [...SUITS];
        shuffle(available);
        return available.slice(0, count);
    }

    function randomSuit() {
        return SUITS[Math.floor(Math.random() * 4)];
    }

    function randomRank() {
        return RANKS[Math.floor(Math.random() * 13)];
    }

    function distinctCards(cards) {
        const keys = cards.map(cardKey);
        return new Set(keys).size === cards.length;
    }

    let hand;

    switch (type) {
        case 'highcard': {
            let attempts = 0;
            do {
                const ranks = pickRanks(5);
                hand = ranks.map(r => ({ rank: r, suit: randomSuit() }));
                attempts++;
            } while (attempts < 50 && (
                evaluateHand(hand) !== 'High Card' || !distinctCards(hand)
            ));
            if (evaluateHand(hand) !== 'High Card' || !distinctCards(hand)) return null;
            break;
        }
        case 'pair': {
            const pairRank = randomRank();
            const pairSuits = pickSuits(2);
            const others = RANKS.filter(r => r !== pairRank);
            shuffle(others);
            const otherRanks = others.slice(0, 3);
            hand = [
                { rank: pairRank, suit: pairSuits[0] },
                { rank: pairRank, suit: pairSuits[1] },
                ...otherRanks.map(r => ({ rank: r, suit: randomSuit() }))
            ];
            if (!distinctCards(hand)) return null;
            break;
        }
        case 'twopair': {
            const ranks = pickRanks(3);
            const p1Suits = pickSuits(2);
            shuffle(SUITS);
            const p2Suits = [SUITS[0], SUITS[1]];
            hand = [
                { rank: ranks[0], suit: p1Suits[0] },
                { rank: ranks[0], suit: p1Suits[1] },
                { rank: ranks[1], suit: p2Suits[0] },
                { rank: ranks[1], suit: p2Suits[1] },
                { rank: ranks[2], suit: randomSuit() }
            ];
            if (!distinctCards(hand)) return null;
            break;
        }
        case 'trips': {
            const tripRank = randomRank();
            const tripSuits = pickSuits(3);
            const others = RANKS.filter(r => r !== tripRank);
            shuffle(others);
            hand = [
                { rank: tripRank, suit: tripSuits[0] },
                { rank: tripRank, suit: tripSuits[1] },
                { rank: tripRank, suit: tripSuits[2] },
                { rank: others[0], suit: randomSuit() },
                { rank: others[1], suit: randomSuit() }
            ];
            if (!distinctCards(hand) || evaluateHand(hand) !== 'Three of a Kind') return null;
            break;
        }
        case 'straight': {
            const startIdx = Math.floor(Math.random() * 10);
            let straightRanks;
            if (startIdx === 9) {
                straightRanks = [8, 9, 10, 11, 12].map(i => RANKS[i]);
            } else if (Math.random() < 0.15) {
                straightRanks = [12, 0, 1, 2, 3].map(i => RANKS[i]);
            } else {
                straightRanks = [];
                for (let i = 0; i < 5; i++) {
                    straightRanks.push(RANKS[startIdx + i]);
                }
            }
            hand = straightRanks.map(r => ({ rank: r, suit: randomSuit() }));
            if (hand.every(c => c.suit === hand[0].suit)) {
                hand[Math.floor(Math.random() * 5)].suit = SUITS.find(s => s !== hand[0].suit);
            }
            if (!distinctCards(hand)) return null;
            break;
        }
        case 'flush': {
            const flushSuit = randomSuit();
            const ranks = pickRanks(5);
            hand = ranks.map(r => ({ rank: r, suit: flushSuit }));
            if (evaluateHand(hand) !== 'Flush') return null;
            break;
        }
        case 'fullhouse': {
            const ranks = pickRanks(2);
            const tripSuits = pickSuits(3);
            shuffle(SUITS);
            const pairSuits = [SUITS[0], SUITS[1]];
            hand = [
                { rank: ranks[0], suit: tripSuits[0] },
                { rank: ranks[0], suit: tripSuits[1] },
                { rank: ranks[0], suit: tripSuits[2] },
                { rank: ranks[1], suit: pairSuits[0] },
                { rank: ranks[1], suit: pairSuits[1] }
            ];
            if (!distinctCards(hand)) return null;
            break;
        }
        case 'quads': {
            const quadRank = randomRank();
            const kicker = RANKS.filter(r => r !== quadRank);
            shuffle(kicker);
            hand = [
                { rank: quadRank, suit: '♠' },
                { rank: quadRank, suit: '♥' },
                { rank: quadRank, suit: '♦' },
                { rank: quadRank, suit: '♣' },
                { rank: kicker[0], suit: randomSuit() }
            ];
            break;
        }
        case 'straightflush': {
            const flushSuit = randomSuit();
            const startIdx = Math.floor(Math.random() * 9);
            const straightRanks = [];
            for (let i = 0; i < 5; i++) {
                straightRanks.push(RANKS[startIdx + i]);
            }
            hand = straightRanks.map(r => ({ rank: r, suit: flushSuit }));
            break;
        }
        default:
            return null;
    }

    return hand;
}

// ==================== FEEDBACK LOGIC (POSITIONAL + ORANGE) ====================
function computeFeedback(guess, secret) {
    const feedback = new Array(HAND_SIZE).fill(null);

    // Build a set of all secret card keys for orange check
    const secretCardKeys = new Set(secret.map(cardKey));

    for (let i = 0; i < HAND_SIZE; i++) {
        const rankMatch = guess[i].rank === secret[i].rank;
        const suitMatch = guess[i].suit === secret[i].suit;

        if (rankMatch && suitMatch) {
            feedback[i] = 'exact';
        } else if (secretCardKeys.has(cardKey(guess[i]))) {
            feedback[i] = 'card-match';
        } else if (rankMatch) {
            feedback[i] = 'rank-match';
        } else if (suitMatch) {
            feedback[i] = 'suit-match';
        } else {
            feedback[i] = 'miss';
        }
    }

    return feedback;
}

// ==================== WIN CHECK ====================
function isWin(guess, secret) {
    const guessKeys = new Set(guess.map(cardKey));
    const secretKeys = new Set(secret.map(cardKey));
    if (guessKeys.size !== secretKeys.size) return false;
    for (const k of secretKeys) {
        if (!guessKeys.has(k)) return false;
    }
    return true;
}

// ==================== ONE-TIME DOM SCAFFOLDING ====================
const FEEDBACK_CLASSES = ['exact', 'card-match', 'rank-match', 'suit-match', 'miss'];
const CARD_STATE_CLASSES = ['current-slot', 'filled', 'pop', ...FEEDBACK_CLASSES];
const ALL_SUIT_CLASSES = ['suit-spades', 'suit-hearts', 'suit-diamonds', 'suit-clubs'];

function setCardContent(cardDiv, card, extraClasses, animDelay) {
    const rankSpan = cardDiv.querySelector('.rank');
    const suitSpan = cardDiv.querySelector('.suit');

    rankSpan.textContent = card ? card.rank : '';
    suitSpan.textContent = card ? card.suit : '';
    ALL_SUIT_CLASSES.forEach(c => suitSpan.classList.remove(c));
    if (card) {
        const colorClass = SUIT_COLORS[card.suit];
        if (colorClass) suitSpan.classList.add(colorClass);
    }

    CARD_STATE_CLASSES.forEach(c => cardDiv.classList.remove(c));
    extraClasses.forEach(c => cardDiv.classList.add(c));

    if (animDelay !== undefined) {
        cardDiv.style.animationDelay = `${animDelay}s`;
    } else {
        cardDiv.style.animationDelay = '';
    }
}

function clearCard(cardDiv) {
    const rankSpan = cardDiv.querySelector('.rank');
    const suitSpan = cardDiv.querySelector('.suit');
    rankSpan.textContent = '';
    suitSpan.textContent = '';
    ALL_SUIT_CLASSES.forEach(c => suitSpan.classList.remove(c));
    CARD_STATE_CLASSES.forEach(c => cardDiv.classList.remove(c));
    cardDiv.style.animationDelay = '';
}

function buildGrid() {
    gridEl.innerHTML = '';
    gridCards = [];

    for (let row = 0; row < MAX_GUESSES; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'guess-row';
        const rowCards = [];

        for (let col = 0; col < HAND_SIZE; col++) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'guess-card';

            const rankSpan = document.createElement('span');
            rankSpan.className = 'rank';

            const suitSpan = document.createElement('span');
            suitSpan.className = 'suit';

            cardDiv.appendChild(rankSpan);
            cardDiv.appendChild(suitSpan);
            rowDiv.appendChild(cardDiv);
            rowCards.push(cardDiv);
        }

        gridEl.appendChild(rowDiv);
        gridCards.push(rowCards);
    }
}

function buildSelection() {
    selectionEl.innerHTML = '';
    selectionCards = [];

    for (let i = 0; i < HAND_SIZE; i++) {
        const div = document.createElement('div');
        div.className = 'mini-card empty';

        const rankSpan = document.createElement('span');
        rankSpan.className = 'rank';

        const suitSpan = document.createElement('span');
        suitSpan.className = 'suit';

        div.appendChild(rankSpan);
        div.appendChild(suitSpan);

        const idx = i;
        div.addEventListener('click', () => {
            if (!gameOver && idx < currentGuess.length) {
                removeCardAt(idx);
            }
        });

        selectionEl.appendChild(div);
        selectionCards.push(div);
    }
}

function buildRankSelector() {
    rankSelectorEl.innerHTML = '';
    rankButtons = {};

    for (const rank of RANKS) {
        const btn = document.createElement('button');
        btn.className = 'rank-btn';
        btn.textContent = rank;
        btn.addEventListener('click', () => selectRank(rank));
        rankSelectorEl.appendChild(btn);
        rankButtons[rank] = btn;
    }
}

function buildSuitSelector() {
    suitSelectorEl.innerHTML = '';
    suitButtons = {};

    for (const suit of SUITS) {
        const btn = document.createElement('button');
        btn.className = `suit-btn ${SUIT_COLORS[suit]}`;
        btn.textContent = suit;
        btn.addEventListener('click', () => selectSuit(suit));
        suitSelectorEl.appendChild(btn);
        suitButtons[suit] = btn;
    }
}

function buildAllDOM() {
    buildGrid();
    buildSelection();
    buildRankSelector();
    buildSuitSelector();
}

// ==================== SMART UPDATE FUNCTIONS ====================
let gridCellState = [];
let selectionState = [];
let rankBtnState = {};
let suitBtnState = {};

function initGridState() {
    gridCellState = [];
    for (let row = 0; row < MAX_GUESSES; row++) {
        const rowState = [];
        for (let col = 0; col < HAND_SIZE; col++) {
            rowState.push({ key: '', classes: '' });
        }
        gridCellState.push(rowState);
    }
}

function initSelectionState() {
    selectionState = [];
    for (let i = 0; i < HAND_SIZE; i++) {
        selectionState.push({ key: '', state: '' });
    }
}

function initRankBtnState() {
    rankBtnState = {};
    RANKS.forEach(r => rankBtnState[r] = '');
}

function initSuitBtnState() {
    suitBtnState = {};
    SUITS.forEach(s => suitBtnState[s] = '');
}

function updateGridSmart() {
    for (let row = 0; row < MAX_GUESSES; row++) {
        for (let col = 0; col < HAND_SIZE; col++) {
            const cardDiv = gridCards[row][col];
            let newKey = '';
            let newClasses = '';

            if (row < guesses.length) {
                const card = guesses[row][col];
                const fb = feedbacks[row][col];
                newKey = cardKey(card);
                newClasses = fb;
            } else if (row === guesses.length && !gameOver) {
                if (col < currentGuess.length) {
                    newKey = cardKey(currentGuess[col]);
                    newClasses = 'filled';
                } else if (col === currentGuess.length) {
                    newClasses = 'current-slot';
                } else {
                    newClasses = 'empty';
                }
            } else {
                newClasses = 'empty';
            }

            const prev = gridCellState[row][col];
            if (prev.key === newKey && prev.classes === newClasses) continue;
            prev.key = newKey;
            prev.classes = newClasses;

            if (row < guesses.length) {
                const card = guesses[row][col];
                const fb = feedbacks[row][col];
                setCardContent(cardDiv, card, [fb], col * 0.15);
            } else if (row === guesses.length && !gameOver) {
                if (col < currentGuess.length) {
                    setCardContent(cardDiv, currentGuess[col], ['filled', 'pop']);
                } else if (col === currentGuess.length) {
                    clearCard(cardDiv);
                    cardDiv.classList.add('current-slot');
                } else {
                    clearCard(cardDiv);
                }
            } else {
                clearCard(cardDiv);
            }
        }
    }
}

function updateSelectionSmart() {
    for (let i = 0; i < HAND_SIZE; i++) {
        const div = selectionCards[i];
        const rankSpan = div.querySelector('.rank');
        const suitSpan = div.querySelector('.suit');

        let newKey = '';
        let newState = '';

        if (i < currentGuess.length) {
            newKey = cardKey(currentGuess[i]);
            newState = 'filled';
        } else if (i === currentGuess.length) {
            newState = 'active';
        } else {
            newState = 'empty';
        }

        const prev = selectionState[i];
        if (prev.key === newKey && prev.state === newState) continue;
        prev.key = newKey;
        prev.state = newState;

        div.classList.remove('empty', 'active-slot');
        ALL_SUIT_CLASSES.forEach(c => suitSpan.classList.remove(c));

        if (i < currentGuess.length) {
            const card = currentGuess[i];
            rankSpan.textContent = card.rank;
            suitSpan.textContent = card.suit;
            const colorClass = SUIT_COLORS[card.suit];
            if (colorClass) suitSpan.classList.add(colorClass);
        } else {
            rankSpan.textContent = '';
            suitSpan.textContent = '';
            div.classList.add('empty');
            if (i === currentGuess.length) {
                div.classList.add('active-slot');
            }
        }
    }
}

function updateRanksSmart() {
    for (const rank of RANKS) {
        const btn = rankButtons[rank];
        let newState = '';

        if (selectedRank === rank) newState += 'selected ';
        if (confirmedRanks.has(rank)) newState += 'confirmed ';
        else if (presentRanks.has(rank)) newState += 'present ';
        else if (eliminatedRanks.has(rank)) newState += 'eliminated ';

        newState = newState.trim();

        if (rankBtnState[rank] === newState) continue;
        rankBtnState[rank] = newState;

        btn.classList.remove('selected', 'confirmed', 'present', 'eliminated');
        if (newState) {
            newState.split(' ').forEach(c => btn.classList.add(c));
        }
    }
}

function updateSuitsSmart() {
    for (const suit of SUITS) {
        const btn = suitButtons[suit];
        let newState = '';

        if (confirmedSuits.has(suit)) newState += 'confirmed ';
        else if (presentSuits.has(suit)) newState += 'present ';
        else if (eliminatedSuits.has(suit)) newState += 'eliminated ';

        newState = newState.trim();

        if (suitBtnState[suit] === newState) continue;
        suitBtnState[suit] = newState;

        btn.classList.remove('confirmed', 'present', 'eliminated');
        if (newState) {
            newState.split(' ').forEach(c => btn.classList.add(c));
        }
    }
}

function updateSubmitButton() {
    submitBtn.disabled = currentGuess.length !== HAND_SIZE || gameOver;
}

function updateDuplicateWarning() {
    if (currentGuess.length < 2) {
        if (warningEl.textContent !== '') warningEl.textContent = '';
        return;
    }
    const keys = currentGuess.map(cardKey);
    const hasDup = new Set(keys).size !== keys.length;
    const msg = hasDup ? '⚠ Duplicate card detected!' : '';
    if (warningEl.textContent !== msg) warningEl.textContent = msg;
}

function updateAll() {
    updateGridSmart();
    updateSelectionSmart();
    updateRanksSmart();
    updateSuitsSmart();
    updateSubmitButton();
    updateDuplicateWarning();
}

// ==================== INTERACTION ====================
function selectRank(rank) {
    if (gameOver) return;
    selectedRank = rank;
    updateRanksSmart();
}

function selectSuit(suit) {
    if (gameOver || !selectedRank) {
        if (!selectedRank) showToast('Select a rank first');
        return;
    }
    if (currentGuess.length >= HAND_SIZE) {
        showToast('Hand is full — submit or clear');
        return;
    }

    const card = { rank: selectedRank, suit };

    if (currentGuess.some(c => cardKey(c) === cardKey(card))) {
        showToast('Card already in your guess');
        return;
    }

    currentGuess.push(card);
    currentGuess = sortHand(currentGuess);

    selectedRank = null;
    updateAll();
}

function removeCardAt(index) {
    if (gameOver) return;
    currentGuess.splice(index, 1);
    updateAll();
}

function undoLastCard() {
    if (gameOver || currentGuess.length === 0) return;
    currentGuess.pop();
    updateAll();
}

function clearCurrentGuess() {
    if (gameOver) return;
    currentGuess = [];
    selectedRank = null;
    updateAll();
}

function submitGuess() {
    if (gameOver || currentGuess.length !== HAND_SIZE) return;

    const keys = currentGuess.map(cardKey);
    if (new Set(keys).size !== keys.length) {
        showToast('Remove duplicate cards');
        return;
    }

    // Smart sort: normal sort + optimize same-rank groups against secret
    const sortedGuess = smartSortGuess(currentGuess, secretHand);
    const feedback = computeFeedback(sortedGuess, secretHand);

    guesses.push(sortedGuess);
    feedbacks.push(feedback);

    updateKeyboardHints(sortedGuess, feedback);

    // Win = same set of cards (order independent)
    if (isWin(sortedGuess, secretHand)) {
        gameOver = true;
        won = true;
        currentGuess = [];
        updateAll();
        setTimeout(() => showGameOver(), 1500);
        return;
    }

    if (guesses.length >= MAX_GUESSES) {
        gameOver = true;
        won = false;
        currentGuess = [];
        updateAll();
        setTimeout(() => showGameOver(), 1500);
        return;
    }

    currentGuess = [];
    selectedRank = null;
    updateAll();
}

function updateKeyboardHints(guess, feedback) {
    for (let i = 0; i < HAND_SIZE; i++) {
        const card = guess[i];
        const fb = feedback[i];

        if (fb === 'exact') {
            confirmedRanks.add(card.rank);
            confirmedSuits.add(card.suit);
        } else if (fb === 'card-match') {
            // Right card wrong slot — both rank and suit are valid
            confirmedRanks.add(card.rank);
            confirmedSuits.add(card.suit);
        } else if (fb === 'rank-match') {
            if (!confirmedRanks.has(card.rank)) presentRanks.add(card.rank);
        } else if (fb === 'suit-match') {
            if (!confirmedSuits.has(card.suit)) presentSuits.add(card.suit);
        }
        // Don't eliminate on miss — could be correct in different slot
    }
}

// ==================== GAME OVER ====================
function showGameOver() {
    const content = document.getElementById('gameOverContent');
    const handType = evaluateHand(secretHand);

    const cardsHTML = secretHand.map(c => {
        const suitColorClass = SUIT_COLORS[c.suit] || '';
        return `<div class="reveal-card">
            <span class="rank">${c.rank}</span>
            <span class="suit ${suitColorClass}">${c.suit}</span>
        </div>`;
    }).join('');

    content.innerHTML = `
        <h2>${won ? '🎉 You got it!' : '😔 Better luck next time'}</h2>
        <div class="hand-name">${handType}</div>
        <div class="secret-hand">${cardsHTML}</div>
        <div class="stats">
            ${won ? `Solved in <strong>${guesses.length}/${MAX_GUESSES}</strong> guesses` : 'The answer was above'}
        </div>
        <button class="share-btn" id="shareBtn">📋 Share</button>
        <button class="new-game-btn" id="newGameBtn">New Game</button>
    `;

    document.getElementById('gameOverModal').classList.add('active');

    document.getElementById('shareBtn').addEventListener('click', shareResults);
    document.getElementById('newGameBtn').addEventListener('click', () => {
        document.getElementById('gameOverModal').classList.remove('active');
        initGame();
    });
}

function shareResults() {
    const emojiMap = {
        'exact': '🟩',
        'card-match': '🟧',
        'rank-match': '🟨',
        'suit-match': '🟦',
        'miss': '⬛'
    };

    let text = `Pokerdle ${won ? guesses.length : 'X'}/${MAX_GUESSES}\n\n`;
    for (const fb of feedbacks) {
        text += fb.map(f => emojiMap[f]).join('') + '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(() => {
        showToast('Could not copy');
    });
}

// ==================== TOAST ====================
let toastTimeout = null;

function showToast(msg, duration = 1500) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
    if (gameOver) return;
    if (document.getElementById('helpModal').classList.contains('active')) return;

    const key = e.key.toUpperCase();

    if (RANKS.includes(key)) {
        selectRank(key);
        return;
    }
    if (key === '0' && selectedRank === '1') {
        selectedRank = null;
        selectRank('10');
        return;
    }
    if (key === '1') {
        selectRank('10');
        return;
    }

    if (selectedRank) {
        const suitMap = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
        if (suitMap[key]) {
            selectSuit(suitMap[key]);
            return;
        }
    }

    if (e.key === 'Backspace') {
        e.preventDefault();
        undoLastCard();
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        submitGuess();
    }

    if (e.key === 'Escape') {
        clearCurrentGuess();
    }
});

// ==================== EVENT LISTENERS ====================
submitBtn.addEventListener('click', submitGuess);
document.getElementById('clearBtn').addEventListener('click', clearCurrentGuess);
document.getElementById('undoBtn').addEventListener('click', undoLastCard);

document.getElementById('helpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('active');
});

document.getElementById('helpClose').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('active');
});

document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('helpModal')) {
        document.getElementById('helpModal').classList.remove('active');
    }
});

document.getElementById('gameOverModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('gameOverModal')) {
        document.getElementById('gameOverModal').classList.remove('active');
    }
});

// ==================== INIT ====================
function initGame() {
    secretHand = generateSecretHand();
    guesses = [];
    feedbacks = [];
    currentGuess = [];
    selectedRank = null;
    gameOver = false;
    won = false;
    eliminatedRanks = new Set();
    confirmedRanks = new Set();
    presentRanks = new Set();
    eliminatedSuits = new Set();
    confirmedSuits = new Set();
    presentSuits = new Set();

    const handType = evaluateHand(secretHand);
    hintEl.textContent = `Hand type: ${handType}`;

    console.log('Secret:', secretHand.map(c => c.rank + c.suit).join(' '));

    buildAllDOM();
    initGridState();
    initSelectionState();
    initRankBtnState();
    initSuitBtnState();
    updateAll();
}

initGame();