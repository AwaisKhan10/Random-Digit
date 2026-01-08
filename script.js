document.addEventListener('DOMContentLoaded', () => {
    let cellHeight = 60;
    const NUM_REELS = 5;
    const MAX_NAMES = 40;
    const REPEAT_COUNT = 20;
    const MAX_DISPLAY_CHARS = 12;
    const MIN_FONT_SCALE = 0.7;
    const MIN_REQUIRED_NAMES = 2;
    const MIN_WINNER_FONT_SIZE = 12;
    const WINNER_MAX_CHARS = 16;
    const DEFAULT_NAMES = [
        'Alex',
        'David',
        'Brian',
        'Hannah',
        'Sam',
        'Sarah',
        'Lisa',
        'Emma',
        'Chris',
        'Laura',
        'Michael',
        'Olivia',
        'Daniel',
        'Sophia',
        'James',
        'Mia',
        'Ethan',
        'Ava',
        'Noah',
        'Emily',
        'Lucas',
        'Grace',
        'Ryan',
        'Chloe',
        'Mason',
        'Lily',
        'Benjamin',
        'Ella',
        'Logan',
        'Zoe'
    ];
    const PLACEHOLDER_NAMES = ['', '', '', '', ''];

    let namesList = [...DEFAULT_NAMES];
    let hasCustomNames = false;
    let spinning = false;
    let currentWinner = '';

    // Store independent shuffle order for each reel
    const reelShuffles = [];
    const nameFitCache = new Map();
    let cellMetrics = null;
    let textMeasure = null;
    let winnerMeasure = null;

    const reelElements = [];
    const reelWrappers = [];
    for (let i = 1; i <= NUM_REELS; i++) {
        const reel = document.getElementById(`reel-${i}`);
        if (reel) {
            reelElements.push(reel);
            reelWrappers.push(reel.parentElement);
        }
    }
    const totalReels = reelElements.length;

    const btnSpin = document.getElementById('btn-spin');
    const btnClear = document.getElementById('btn-clear');
    const btnAdd = document.getElementById('btn-add');
    const winnerText = document.getElementById('winner-text');
    const inputField = document.getElementById('name-input');
    const leverEl = document.getElementById('lever');
    const nameCountEl = document.getElementById('name-count');
    const statusEl = document.getElementById('status');
    const balloonLayer = document.getElementById('balloon-layer');
    const nameTooltip = document.getElementById('name-tooltip');
    const tooltipBackdrop = document.getElementById('tooltip-backdrop');
    const machineEl = document.querySelector('.machine');
    let resizeTimer = null;

    initializeReels();
    // updateNameCount();
    updateSpinState();
    syncUiState();
    // if (!statusEl.textContent) {
    //     setStatus(
    //         namesList.length >= MIN_REQUIRED_NAMES
    //             ? 'Ready to spin.'
    //             : 'Add at least 2 names to spin.',
    //         'info'
    //     );
    // }

    btnAdd.addEventListener('click', handleAddNames);
    // btnClear.addEventListener('click', handleClear);
    btnSpin.addEventListener('click', handleSpin);

    inputField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddNames();
        }
    });

    // Tooltip close handlers
    if (tooltipBackdrop) {
        tooltipBackdrop.addEventListener('click', hideTooltip);
    }
    if (nameTooltip) {
        nameTooltip.addEventListener('click', hideTooltip);
    }

    window.addEventListener('resize', () => {
        if (resizeTimer) {
            clearTimeout(resizeTimer);
        }
        resizeTimer = setTimeout(() => {
            if (!spinning) {
                nameFitCache.clear();
                initializeReels();
                syncUiState();
                if (currentWinner) {
                    fitWinnerText(currentWinner);
                }
            }
        }, 150);
    });

    // function updateNameCount() {
    //     nameCountEl.textContent = `${namesList.length} / ${MAX_NAMES} names`;
    // }

    function updateSpinState() {
        const shouldDisable = spinning || namesList.length < MIN_REQUIRED_NAMES;
        btnSpin.disabled = shouldDisable;
        btnAdd.disabled = spinning;
        // btnClear.disabled = spinning;
        inputField.disabled = spinning;

        // Update button text and styling
        if (spinning) {
            btnSpin.textContent = '';
            btnSpin.classList.remove('spinning');
        } else {
            btnSpin.textContent = '';
            btnSpin.classList.remove('spinning');
        }
    }

    // function setStatus(message, tone) {
    //     statusEl.textContent = message;
    //     if (tone) {
    //         statusEl.dataset.tone = tone;
    //     } else {
    //         delete statusEl.dataset.tone;
    //     }
    // }

    function setMachineState(state) {
        if (machineEl) {
            machineEl.dataset.state = state;
        }
    }

    function setWinnerDisplay(text, fullName) {
        if (!winnerText) {
            return;
        }

        winnerText.classList.remove('winner-pop');
        winnerText.style.fontSize = '';
        winnerText.textContent = text;
        winnerText.title = fullName || '';

        if (fullName) {
            requestAnimationFrame(() => {
                fitWinnerText(fullName);
                winnerText.classList.remove('winner-pop');
                winnerText.offsetWidth;
                winnerText.classList.add('winner-pop');
            });
        }
    }

    function syncUiState() {
        if (spinning) {
            setMachineState('spinning');
            return;
        }

        if (namesList.length < MIN_REQUIRED_NAMES) {
            currentWinner = '';
            setMachineState(namesList.length === 0 ? 'empty' : 'ready');
            setWinnerDisplay('—');
            return;
        }

        if (!currentWinner) {
            setMachineState('ready');
            setWinnerDisplay('Ready');
            return;
        }

        setMachineState('result');
    }

    function normalizeName(name) {
        return name.replace(/\s+/g, ' ').trim();
    }

    function dedupeNames(list) {
        const seen = new Set();
        const deduped = [];
        list.forEach((name) => {
            const normalized = normalizeName(name);
            if (!normalized) {
                return;
            }
            const key = normalized.toLowerCase();
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            deduped.push(normalized);
        });
        return deduped;
    }

    function handleAddNames() {
        if (spinning) {
            return;
        }

        const input = inputField.value.trim();
        if (!input) {
            // setStatus('Enter at least one name to add.', 'error');
            return;
        }

        const newNames = input
            .split(',')
            .map((name) => normalizeName(name))
            .filter(Boolean);

        if (newNames.length === 0) {
            // setStatus('Enter at least one valid name.', 'error');
            return;
        }

        let updatedNames = [];
        if (!hasCustomNames) {
            updatedNames = dedupeNames(newNames);
            hasCustomNames = true;
        } else {
            updatedNames = dedupeNames([...namesList, ...newNames]);
        }

        if (updatedNames.length > MAX_NAMES) {
            updatedNames = updatedNames.slice(0, MAX_NAMES);
            // setStatus(`Max ${MAX_NAMES} names reached. Extra names were ignored.`, 'info');
        } else {
            const count = newNames.length;
            // setStatus(`Added ${count} name${count === 1 ? '' : 's'}.`, 'success');
        }

        namesList = updatedNames;
        currentWinner = '';
        inputField.value = '';
        initializeReels();
        // updateNameCount();
        updateSpinState();
        syncUiState();
    }

    function handleClear() {
        if (spinning) {
            return;
        }

        namesList = [];
        hasCustomNames = true;
        currentWinner = '';
        inputField.value = '';
        initializeReels();
        // updateNameCount();
        updateSpinState();
        syncUiState();
        // setStatus('Cleared all names.', 'info');
    }

    function getDisplayNames() {
        return namesList.length ? namesList : PLACEHOLDER_NAMES;
    }

    function ensureTextMeasure() {
        if (textMeasure) {
            return;
        }
        textMeasure = document.createElement('span');
        textMeasure.className = 'name-measure';
        document.body.appendChild(textMeasure);
    }

    // function ensureWinnerMeasure() {
    //     if (winnerMeasure) {
    //         return;
    //     }
    //     winnerMeasure = document.createElement('span');
    //     winnerMeasure.className = 'winner-measure';
    //     document.body.appendChild(winnerMeasure);
    // }

    function getCellMetrics() {
        const reel = reelElements[0];
        if (!reel) {
            return { width: 0, fontSize: 16, height: cellHeight };
        }

        const sample = document.createElement('div');
        sample.className = 'name-cell';
        sample.style.position = 'absolute';
        sample.style.visibility = 'hidden';
        sample.style.pointerEvents = 'none';
        sample.textContent = 'Measure';
        document.body.appendChild(sample);

        const styles = window.getComputedStyle(sample);
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const fontSize = parseFloat(styles.fontSize) || 16;
        const height = sample.getBoundingClientRect().height || cellHeight;
        sample.remove();

        const width = Math.max(0, reel.clientWidth - paddingLeft - paddingRight);
        return { width, fontSize, height };
    }

    function refreshCellMetrics() {
        const nextMetrics = getCellMetrics();
        if (
            !cellMetrics ||
            cellMetrics.width !== nextMetrics.width ||
            cellMetrics.fontSize !== nextMetrics.fontSize
        ) {
            cellMetrics = nextMetrics;
            if (nextMetrics.height) {
                cellHeight = nextMetrics.height;
            }
            nameFitCache.clear();
        }
    }

    function measureTextWidth(text, fontSize) {
        ensureTextMeasure();
        textMeasure.style.fontSize = `${fontSize}px`;
        textMeasure.textContent = text;
        return textMeasure.getBoundingClientRect().width;
    }

    function measureWinnerWidth(text, fontSize) {
        if (!winnerText) {
            return 0;
        }
        // ensureWinnerMeasure();
        const styles = window.getComputedStyle(winnerText);
        // winnerMeasure.style.fontFamily = styles.fontFamily;
        // winnerMeasure.style.fontWeight = styles.fontWeight;
        // winnerMeasure.style.fontSize = `${fontSize}px`;
        winnerText.textContent = text;
        return winnerText.getBoundingClientRect().width;
    }

    function fitWinnerText(fullName) {
        if (!winnerText) {
            return;
        }

        const availableWidth = winnerText.clientWidth;
        if (!availableWidth) {
            return;
        }

        const styles = window.getComputedStyle(winnerText);
        const baseSize = parseFloat(styles.fontSize) || 32;
        let textWidth = measureWinnerWidth(fullName, baseSize);

        if (textWidth <= availableWidth) {
            winnerText.style.fontSize = '';
            winnerText.textContent = fullName;
            return;
        }

        const scale = availableWidth / textWidth;
        if (baseSize * scale >= MIN_WINNER_FONT_SIZE) {
            winnerText.style.fontSize = `${baseSize * scale}px`;
            winnerText.textContent = fullName;
            return;
        }

        const minSize = MIN_WINNER_FONT_SIZE;
        winnerText.style.fontSize = `${minSize}px`;
        textWidth = measureWinnerWidth(fullName, minSize);
        if (textWidth <= availableWidth) {
            winnerText.textContent = fullName;
            return;
        }

        let maxChars = Math.min(WINNER_MAX_CHARS, fullName.length);
        let truncated = truncateName(fullName, maxChars);
        let truncatedWidth = measureWinnerWidth(truncated, minSize);
        while (maxChars > 1 && truncatedWidth > availableWidth) {
            maxChars -= 1;
            truncated = truncateName(fullName, maxChars);
            truncatedWidth = measureWinnerWidth(truncated, minSize);
        }
        winnerText.textContent = truncated;
    }

    function truncateName(name, maxChars) {
        if (name.length <= maxChars) {
            return name;
        }
        return name.slice(0, Math.max(0, maxChars - 1)) + '…';
    }

    function splitNameForTwoLines(name, maxChars) {
        const parts = name.split(/[\s-]+/).filter(Boolean);
        if (parts.length < 2) {
            return null;
        }

        let bestSplit = null;
        let bestDiff = Infinity;

        for (let i = 1; i < parts.length; i++) {
            const line1 = parts.slice(0, i).join(' ');
            const line2 = parts.slice(i).join(' ');
            if (line1.length <= maxChars && line2.length <= maxChars) {
                const diff = Math.abs(line1.length - line2.length);
                if (diff < bestDiff) {
                    bestSplit = [line1, line2];
                    bestDiff = diff;
                }
            }
        }

        return bestSplit;
    }

    function getFittedName(name) {
        refreshCellMetrics();
        if (!cellMetrics || !cellMetrics.width) {
            return {
                displayName: name,
                fontSize: null,
                isTruncated: false,
                isMultiline: false
            };
        }

        const cacheKey = `${name}|${cellMetrics.width}|${cellMetrics.fontSize}`;
        if (nameFitCache.has(cacheKey)) {
            return nameFitCache.get(cacheKey);
        }

        const { width, fontSize } = cellMetrics;
        const fullWidth = measureTextWidth(name, fontSize);
        const result = {
            displayName: name,
            fontSize: null,
            isTruncated: false,
            isMultiline: false
        };

        if (fullWidth <= width) {
            nameFitCache.set(cacheKey, result);
            return result;
        }

        const scaleToFit = width / fullWidth;
        if (scaleToFit >= MIN_FONT_SCALE) {
            result.fontSize = fontSize * scaleToFit;
            nameFitCache.set(cacheKey, result);
            return result;
        }

        let truncated = truncateName(name, MAX_DISPLAY_CHARS);
        result.displayName = truncated;
        result.isTruncated = true;

        let truncatedWidth = measureTextWidth(truncated, fontSize);
        if (truncatedWidth <= width) {
            nameFitCache.set(cacheKey, result);
            return result;
        }

        const truncScale = width / truncatedWidth;
        if (truncScale >= MIN_FONT_SCALE) {
            result.fontSize = fontSize * truncScale;
            nameFitCache.set(cacheKey, result);
            return result;
        }

        const splitLines = splitNameForTwoLines(name, MAX_DISPLAY_CHARS);
        if (splitLines) {
            const line1Width = measureTextWidth(splitLines[0], fontSize);
            const line2Width = measureTextWidth(splitLines[1], fontSize);
            if (Math.max(line1Width, line2Width) <= width) {
                result.displayName = `${splitLines[0]}\n${splitLines[1]}`;
                result.isMultiline = true;
                result.isTruncated = false;
                result.fontSize = null;
                nameFitCache.set(cacheKey, result);
                return result;
            }
        }

        const maxWidthAtMinScale = width / MIN_FONT_SCALE;
        let maxChars = MAX_DISPLAY_CHARS;
        while (maxChars > 1) {
            const candidate = truncateName(name, maxChars);
            const candidateWidth = measureTextWidth(candidate, fontSize);
            if (candidateWidth <= maxWidthAtMinScale) {
                truncated = candidate;
                truncatedWidth = candidateWidth;
                break;
            }
            maxChars -= 1;
        }

        result.displayName = truncated;
        result.fontSize = fontSize * MIN_FONT_SCALE;
        nameFitCache.set(cacheKey, result);
        return result;
    }

    // Fisher-Yates shuffle
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function isSameOrder(first, second) {
        if (!first || !second || first.length !== second.length) {
            return false;
        }
        for (let i = 0; i < first.length; i++) {
            if (first[i] !== second[i]) {
                return false;
            }
        }
        return true;
    }

    function createReelOrder(names) {
        let attempt = 0;
        let rotatedNames = [];

        do {
            const shuffledNames = shuffleArray(names);
            const rotateBy = Math.floor(Math.random() * shuffledNames.length);
            rotatedNames = [
                ...shuffledNames.slice(rotateBy),
                ...shuffledNames.slice(0, rotateBy)
            ];
            attempt += 1;
        } while (
            attempt < 6 &&
            reelShuffles.some((existing) => isSameOrder(existing, rotatedNames))
        );

        return rotatedNames;
    }

    // Show tooltip with full name
    function showTooltip(fullName) {
        if (nameTooltip && tooltipBackdrop) {
            nameTooltip.textContent = fullName;
            nameTooltip.classList.add('visible');
            tooltipBackdrop.classList.add('visible');
        }
    }

    // Hide tooltip
    function hideTooltip() {
        if (nameTooltip && tooltipBackdrop) {
            nameTooltip.classList.remove('visible');
            tooltipBackdrop.classList.remove('visible');
        }
    }

    function initializeReels() {
        const displayNames = getDisplayNames();
        refreshCellMetrics();

        // Clear reel shuffles and create independent shuffle for each reel
        reelShuffles.length = 0;

        reelElements.forEach((reel, reelIndex) => {
            reel.innerHTML = '';
            reel.style.transition = 'none';

            // Remove any winning-reel class
            reelWrappers[reelIndex].classList.remove('winning-reel');

            // Create a unique shuffle for this reel with different random seed
            const rotatedNames = createReelOrder(displayNames);
            reelShuffles.push(rotatedNames);

            const pool = [];
            for (let i = 0; i < REPEAT_COUNT; i++) {
                pool.push(...rotatedNames);
            }

            pool.forEach((name) => {
                const cell = document.createElement('div');
                cell.className = 'name-cell';

                // Apply smart text fitting
                const fittedName = getFittedName(name);
                const textSpan = document.createElement('span');
                textSpan.className = 'name-text';
                if (fittedName.isMultiline) {
                    textSpan.classList.add('multiline');
                }
                textSpan.textContent = fittedName.displayName;
                if (fittedName.fontSize && cellMetrics) {
                    textSpan.style.fontSize = `${fittedName.fontSize}px`;
                }
                cell.appendChild(textSpan);
                cell.dataset.fullName = name;

                if (fittedName.isTruncated) {
                    cell.classList.add('truncated');
                    cell.title = name;
                    // Add click handler for tooltip
                    cell.addEventListener('pointerup', () => {
                        if (!spinning) {
                            showTooltip(name);
                        }
                    });
                }

                reel.appendChild(cell);
            });

            // Each reel starts at a different random offset
            const safeStart = rotatedNames.length * 3;
            const startIndex = safeStart + Math.floor(Math.random() * rotatedNames.length);
            reel.dataset.index = startIndex;
            positionReel(reel, startIndex);

            if (namesList.length) {
                highlightCenterRow(reel, startIndex);
            } else {
                clearHighlights(reel);
            }

            reel.offsetHeight;
            reel.style.transition = 'transform 0.1s linear';
        });

        // Winner display handled by syncUiState.
    }

    function setReelOffset(reel, offset) {
        reel.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    function positionReel(reel, centerIndex) {
        const offset = -((centerIndex - 1) * cellHeight);
        setReelOffset(reel, offset);
    }

    function clearHighlights(reel) {
        Array.from(reel.children).forEach((cell) => {
            cell.classList.remove('winner-row', 'center-row');
        });
    }

    function highlightCenterRow(reel, centerIndex) {
        clearHighlights(reel);
        const centerCell = reel.children[centerIndex];
        if (centerCell) {
            centerCell.classList.add('center-row');
        }
    }

    function highlightWinnerRow(reel, centerIndex) {
        clearHighlights(reel);
        const winnerCell = reel.children[centerIndex];
        if (winnerCell) {
            winnerCell.classList.add('winner-row');
        }
    }

    function handleSpin() {
        if (spinning) {
            return;
        }

        if (namesList.length < MIN_REQUIRED_NAMES) {
            // setStatus('Add at least 2 names before spinning.', 'error');
            setMachineState(namesList.length === 0 ? 'empty' : 'ready');
            return;
        }

        hideTooltip();
        spinning = true;
        setMachineState('spinning');
        updateSpinState();
        // setStatus('Spinning...', 'info');
        setWinnerDisplay('—');

        // Remove previous winning-reel highlights
        reelWrappers.forEach(wrapper => wrapper.classList.remove('winning-reel'));

        if (leverEl) {
            leverEl.classList.add('pulling');
            setTimeout(() => leverEl.classList.remove('pulling'), 600);
        }

        // Randomly select winning reel (0-4) with equal probability
        const winningReelIndex = Math.floor(Math.random() * NUM_REELS);

        const uniqueNames = [...new Set(namesList)];
        const shouldUseUnique =
            namesList.length >= NUM_REELS && uniqueNames.length >= NUM_REELS;

        let paylineNames = [];
        if (shouldUseUnique) {
            paylineNames = shuffleArray(uniqueNames).slice(0, NUM_REELS);
        } else {
            paylineNames = reelShuffles.map((shuffle) => {
                const randomIndex = Math.floor(Math.random() * shuffle.length);
                return shuffle[randomIndex];
            });
        }

        const winner = paylineNames[winningReelIndex];

        const paylineTargets = paylineNames.map((targetName, reelIndex) => {
            const shuffle = reelShuffles[reelIndex];
            const foundIndex = shuffle.indexOf(targetName);
            if (foundIndex >= 0) {
                return foundIndex;
            }
            return Math.floor(Math.random() * shuffle.length);
        });

        // 2.2s total duration with "Fast start -> Slow stop"
        // Staggered stops: 120ms each
        const baseDuration = 2200;
        const staggerDelay = 120;

        let reelsStopped = 0;
        const finalIndexes = Array(totalReels).fill(0);

        reelElements.forEach((reel, reelIndex) => {
            clearHighlights(reel);
            const targetIndex = paylineTargets[reelIndex];
            // Duration increases for each reel
            const spinDuration = baseDuration + (reelIndex * staggerDelay);

            spinReel(reel, reelIndex, targetIndex, spinDuration, (finalIndex) => {
                finalIndexes[reelIndex] = finalIndex;
                reelsStopped += 1;
                if (reelsStopped === totalReels) {
                    setTimeout(() => {
                        currentWinner = winner;
                        reelWrappers[winningReelIndex].classList.add('winning-reel');
                        highlightWinnerRow(
                            reelElements[winningReelIndex],
                            finalIndexes[winningReelIndex]
                        );
                        // triggerWinningFlicker(reelWrappers[winningReelIndex]); // Optional
                        spinning = false;
                        setMachineState('result');
                        setWinnerDisplay(winner, winner);
                        updateSpinState();
                        // setStatus(`Winner: ${winner}`, 'success');
                        triggerCelebration();
                    }, 250); // Winner text fades in 250ms
                }
            });
        });
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function spinReel(reel, reelIndex, targetPositionInShuffle, spinDuration, onComplete) {
        const shuffledNames = reelShuffles[reelIndex];
        const total = shuffledNames.length;
        const maxIndex = total * REPEAT_COUNT;

        let currentIndex = Number(reel.dataset.index) || total * 2;
        const maxSpinsThisReel = 5 + reelIndex * 2;
        const requiredCells = maxSpinsThisReel * total + total * 2;
        if (currentIndex + requiredCells >= maxIndex) {
            currentIndex = (currentIndex % total) + total * 2;
            reel.style.transition = 'none';
            positionReel(reel, currentIndex);
            reel.dataset.index = currentIndex;
            reel.offsetHeight;
        }

        // Calculate how many cells to spin - each reel has varying speed
        const baseSpins = 4 + reelIndex * 2 + Math.floor(Math.random() * 2);
        const cellsToSpin = baseSpins * total;
        const targetBase = currentIndex + cellsToSpin;
        const alignOffset = (targetPositionInShuffle - (targetBase % total) + total) % total;
        const finalIndex = targetBase + alignOffset;

        const startOffset = -((currentIndex - 1) * cellHeight);
        const endOffset = -((finalIndex - 1) * cellHeight);

        reel.classList.add('spinning');
        reel.style.transition = 'none';

        let startTime = null;

        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / spinDuration, 1);

            // Fast cruise then smooth ease-out for realistic deceleration.
            const eased =
                progress < 0.75
                    ? progress
                    : 0.75 + easeOutCubic((progress - 0.75) / 0.25) * 0.25;

            const currentOffset = startOffset + (endOffset - startOffset) * eased;
            reel.style.transform = `translate3d(0, ${currentOffset}px, 0)`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                reel.style.transform = `translate3d(0, ${endOffset}px, 0)`;
                reel.dataset.index = finalIndex;
                reel.classList.remove('spinning');
                highlightCenterRow(reel, finalIndex);
                onComplete(finalIndex);
            }
        }

        requestAnimationFrame(animate);
    }

    // Add winning reel flicker effect
    function triggerWinningFlicker(wrapper) {
        let flickerCount = 0;
        const maxFlickers = 12;
        const flickerInterval = setInterval(() => {
            wrapper.style.opacity = wrapper.style.opacity === '0.7' ? '1' : '0.7';
            flickerCount++;
            if (flickerCount >= maxFlickers) {
                clearInterval(flickerInterval);
                wrapper.style.opacity = '1';
            }
        }, 120);
    }

    function triggerCelebration() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 120,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ffd700', '#ff1e1e', '#ffffff']
            });

            setTimeout(() => {
                confetti({
                    particleCount: 70,
                    angle: 60,
                    spread: 60,
                    origin: { x: 0 },
                    colors: ['#ffd700', '#ff5a5f', '#ffb703']
                });
                confetti({
                    particleCount: 70,
                    angle: 120,
                    spread: 60,
                    origin: { x: 1 },
                    colors: ['#ffd700', '#ff5a5f', '#ffb703']
                });
            }, 250);
        }

        launchBalloons();
    }

    function launchBalloons() {
        if (!balloonLayer) {
            return;
        }

        const colors = ['#ff5a5f', '#ffb703', '#ffd166', '#f25f5c', '#ff8fab'];
        const balloonsToCreate = 12;

        for (let i = 0; i < balloonsToCreate; i++) {
            const balloon = document.createElement('div');
            balloon.className = 'balloon';
            balloon.style.left = `${Math.random() * 90 + 5}%`;
            balloon.style.background = colors[i % colors.length];
            balloon.style.animationDuration = `${4.5 + Math.random() * 2}s`;
            balloon.style.animationDelay = `${Math.random() * 0.4}s`;

            balloonLayer.appendChild(balloon);

            balloon.addEventListener('animationend', () => {
                balloon.remove();
            });
        }
    }
});
