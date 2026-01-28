document.addEventListener("DOMContentLoaded", function () {
    const beforeServiceFeeInput = document.getElementById("before-service-fee");
    const afterServiceFeeInput = document.getElementById("after-service-fee");
    const calculateButton = document.getElementById("calculate-button");
    const resultTable = document.getElementById("result-table").getElementsByTagName('tbody')[0];
    const whiteCheckbox = document.getElementById("white-plate");
    const redCheckbox = document.getElementById("red-plate");
    const silverCheckbox = document.getElementById("silver-plate");
    const goldCheckbox = document.getElementById("gold-plate");
    const blackCheckbox = document.getElementById("black-plate");
    const combinationHeader = document.getElementById("th-combination");
    const plateHeader = document.getElementById("th-plates");
    const addSpecialButton = document.getElementById("add-special");
    const specialList = document.getElementById("special-list");
    const specialSummary = document.getElementById("special-summary");
    const themeToggle = document.getElementById("theme-toggle");
    const filterButton = document.getElementById("filter-button");
    const filterPanel = document.getElementById("filter-panel");

    let currentCombinations = [];
    let lastVisiblePlatesOrder = [];
    const filterState = {}; // plate -> { op: string, value: number|null }
    // Theme toggling
    function applyTheme(mode) {
        const isDark = mode === 'dark';
        document.body.classList.toggle('dark', isDark);
        try { localStorage.setItem('theme', mode); } catch (e) {}
            if (themeToggle) {
                // Show icon for the next action: if currently dark, show sun (light_mode); else moon (dark_mode)
                const nextIcon = isDark ? 'light_mode' : 'dark_mode';
                themeToggle.innerHTML = `<span class="material-symbols-outlined">${nextIcon}</span>`;
                themeToggle.setAttribute('aria-label', isDark ? '切換至淺色模式' : '切換至深色模式');
        }
    }

    const savedTheme = (() => {
        try { return localStorage.getItem('theme'); } catch (e) { return null; }
    })();
    const defaultTheme = savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(defaultTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            const next = document.body.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(next);
        });
    }

    // Plate prices (HKD)
    const PRICES = {
        white: 10,
        red: 12,
        silver: 17,
        gold: 22,
        black: 27,
    };

    // Helpers for special items
    function getSpecialTotal() {
        if (!specialList) return 0;
        let total = 0;
        const items = specialList.querySelectorAll('.special-item');
        items.forEach(item => {
            const qty = parseFloat(item.querySelector('.special-qty')?.value) || 0;
            const price = parseFloat(item.querySelector('.special-price')?.value) || 0;
            total += qty * price;
        });
        return total;
    }

    function updateSpecialSummary() {
        if (!specialSummary) return;
        const t = Math.round(getSpecialTotal());
        specialSummary.textContent = `總額：$${t}`;
    }

    // Maintain a running index label for special items
    function reindexSpecialItems() {
        if (!specialList) return;
        const items = specialList.querySelectorAll('.special-item');
        let idx = 1;
        items.forEach(item => {
            const idxEl = item.querySelector('.special-index');
            if (idxEl) idxEl.textContent = `#${idx}`;
            idx += 1;
        });
    }

    function addSpecialItem(initialQty = 1, initialPrice = 0) {
        if (!specialList) return;
        const item = document.createElement('div');
        item.className = 'special-item';

        const indexBadge = document.createElement('span');
        indexBadge.className = 'special-index';
        indexBadge.textContent = `#${(specialList.querySelectorAll('.special-item').length + 1)}`;

        const qtyLabel = document.createElement('label');
        qtyLabel.textContent = '數量';
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '0';
        qtyInput.step = '1';
        qtyInput.value = String(initialQty);
        qtyInput.className = 'special-qty';

        const priceLabel = document.createElement('label');
        priceLabel.textContent = '價格';
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.min = '0';
        priceInput.step = '1';
        priceInput.value = String(initialPrice);
        priceInput.className = 'special-price';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-special';
        removeBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>刪除';

        // Events
        function onValueChange() {
            // Sanitize negatives and non-integers
            let q = Math.max(0, parseInt(qtyInput.value, 10) || 0);
            let p = Math.max(0, parseInt(priceInput.value, 10) || 0);
            qtyInput.value = String(q);
            priceInput.value = String(p);
            updateSpecialSummary();
            if (resultTable.rows.length > 0) {
                renderResults();
            }
        }

        qtyInput.addEventListener('input', onValueChange);
        priceInput.addEventListener('input', onValueChange);
        removeBtn.addEventListener('click', function () {
            item.remove();
            reindexSpecialItems();
            updateSpecialSummary();
            if (resultTable.rows.length > 0) {
                renderResults();
            }
        });

        item.append(indexBadge, qtyLabel, qtyInput, priceLabel, priceInput, removeBtn);
        specialList.appendChild(item);
        reindexSpecialItems();
        updateSpecialSummary();
    }

    if (addSpecialButton) {
        addSpecialButton.addEventListener('click', function () {
            addSpecialItem(1, 0);
        });
    }

    // Helper to build and render the results table based on current inputs and visible headers
    function renderResults() {
        const beforeValue = Math.round(parseFloat(beforeServiceFeeInput.value) || 0);

        // Clear previous results
        resultTable.innerHTML = "";

        // Determine visible headers early for colspan calculations
        const combinationHeaderVisible = !combinationHeader.hidden;
        const visiblePlatesOrder = [];
        if (!document.getElementById("th-white").hidden) visiblePlatesOrder.push("white");
        if (!document.getElementById("th-red").hidden) visiblePlatesOrder.push("red");
        if (!document.getElementById("th-silver").hidden) visiblePlatesOrder.push("silver");
        if (!document.getElementById("th-gold").hidden) visiblePlatesOrder.push("gold");
        if (!document.getElementById("th-black").hidden) visiblePlatesOrder.push("black");
        lastVisiblePlatesOrder = visiblePlatesOrder.slice();

        if (beforeValue <= 0) {
            const row = resultTable.insertRow();
            const cell = row.insertCell(0);
            const colSpanCount = (combinationHeaderVisible ? 1 : 0) + visiblePlatesOrder.length;
            cell.colSpan = Math.max(colSpanCount, 1);
            cell.textContent = "請先輸入總數！";
            return;
        }

        // Subtract special items total first
        const specialTotal = Math.round(getSpecialTotal());
        const targetValue = beforeValue - specialTotal;
        updateSpecialSummary();
        if (targetValue <= 0) {
            const row = resultTable.insertRow();
            const cell = row.insertCell(0);
            const colSpanCount = (combinationHeaderVisible ? 1 : 0) + visiblePlatesOrder.length;
            cell.colSpan = Math.max(colSpanCount, 1);
            cell.textContent = "特別項目總額 >= 總數，無剩餘金額可計算";
            return;
        }

        const whitePlateEnabled = whiteCheckbox.checked;
        const redPlateEnabled = redCheckbox.checked;
        const silverPlateEnabled = silverCheckbox.checked;
        const goldPlateEnabled = goldCheckbox.checked;
        const blackPlateEnabled = blackCheckbox.checked;

        // Determine which header columns are visible (not hidden)
        // Note: visible headers already computed above

        const maxWhite = whitePlateEnabled ? Math.floor(targetValue / PRICES.white) : 0;
        const maxRed = redPlateEnabled ? Math.floor(targetValue / PRICES.red) : 0;
        const maxSilver = silverPlateEnabled ? Math.floor(targetValue / PRICES.silver) : 0;
        const maxGold = goldPlateEnabled ? Math.floor(targetValue / PRICES.gold) : 0;
        const maxBlack = blackPlateEnabled ? Math.floor(targetValue / PRICES.black) : 0;

        const possibleCombinations = [];

            for (let whiteCount = 0; whiteCount <= maxWhite; whiteCount++) {
                for (let redCount = 0; redCount <= maxRed; redCount++) {
                    for (let silverCount = 0; silverCount <= maxSilver; silverCount++) {
                        for (let goldCount = 0; goldCount <= maxGold; goldCount++) {
                            for (let blackCount = 0; blackCount <= maxBlack; blackCount++) {
                                const total = (whiteCount * PRICES.white)
                                    + (redCount * PRICES.red)
                                    + (silverCount * PRICES.silver)
                                    + (goldCount * PRICES.gold)
                                    + (blackCount * PRICES.black);

                                if (total === targetValue) {
                                    possibleCombinations.push({
                                        white: whiteCount,
                                        red: redCount,
                                        silver: silverCount,
                                        gold: goldCount,
                                        black: blackCount
                                    });
                                }
                            }
                        }
                    }
                }
            }

            currentCombinations = possibleCombinations;

            // Apply active filters if any
            const filters = getActiveFilters();
            const finalCombinations = hasActiveFilters(filters)
                ? applyFilters(currentCombinations, filters)
                : currentCombinations;

            if (finalCombinations.length === 0) {
                const row = resultTable.insertRow();
                const cell = row.insertCell(0);
                const colSpanCount = (combinationHeaderVisible ? 1 : 0) + visiblePlatesOrder.length;
                cell.colSpan = Math.max(colSpanCount, 1);
                return;
            }

        combinationHeader.textContent = `組合 (${finalCombinations.length})`;

        for (let i = 0; i < finalCombinations.length; i++) {
            const row = resultTable.insertRow();
            let cellIndex = 0;
            if (combinationHeaderVisible) {
                const idxCell = row.insertCell(cellIndex++);
                idxCell.textContent = (i + 1).toString();
            }

            for (const plate of visiblePlatesOrder) {
                const cell = row.insertCell(cellIndex++);
                cell.textContent = finalCombinations[i][plate];
            }
        }
    }

    // Filters helpers
    function getActiveFilters() {
        const filters = {};
        for (const plate in filterState) {
            const state = filterState[plate];
            if (!state) continue;
            const value = Number.isInteger(state.value) ? state.value : null;
            const op = state.op || '=';
            if (value !== null) {
                filters[plate] = { op, value };
            }
        }
        return filters;
    }

    function hasActiveFilters(filters) {
        return Object.keys(filters).length > 0;
    }

    function applyFilters(combos, filters) {
        return combos.filter(c => {
            for (const plate in filters) {
                const { op, value } = filters[plate];
                const val = c[plate];
                switch (op) {
                    case '=': if (val !== value) return false; break;
                    case '>': if (val <= value) return false; break;
                    case '>=': if (val < value) return false; break;
                    case '<': if (val >= value) return false; break;
                    case '<=': if (val > value) return false; break;
                    default: break;
                }
            }
            return true;
        });
    }

    function buildFilterPanel() {
        if (!filterPanel) return;
        // Build rows only for enabled plates
        const enabledPlates = [];
        if (whiteCheckbox.checked) enabledPlates.push('white');
        if (redCheckbox.checked) enabledPlates.push('red');
        if (silverCheckbox.checked) enabledPlates.push('silver');
        if (goldCheckbox.checked) enabledPlates.push('gold');
        if (blackCheckbox.checked) enabledPlates.push('black');

        const labels = { white: '白', red: '紅', silver: '銀', gold: '金', black: '黑' };

        filterPanel.innerHTML = '';
        enabledPlates.forEach(plate => {
            const row = document.createElement('div');
            row.className = 'filter-row';
            row.setAttribute('data-plate', plate);

            const label = document.createElement('label');
            label.textContent = labels[plate] || plate;

            const opSelect = document.createElement('select');
            ['=', '>', '>=', '<', '<='].forEach(op => {
                const opt = document.createElement('option');
                opt.value = op;
                opt.textContent = op;
                opSelect.appendChild(opt);
            });
            opSelect.value = filterState[plate]?.op || '=';

            const valueInput = document.createElement('input');
            valueInput.type = 'number';
            valueInput.min = '0';
            valueInput.step = '1';
            valueInput.placeholder = '數量';
            valueInput.value = filterState[plate]?.value != null ? String(filterState[plate].value) : '';


            // Events: auto-apply
            opSelect.addEventListener('change', () => {
                const vRaw = valueInput.value;
                const v = vRaw === '' ? null : Math.max(0, parseInt(vRaw, 10) || 0);
                filterState[plate] = { op: opSelect.value, value: v };
                renderResults();
            });
            valueInput.addEventListener('input', () => {
                // sanitize integer, non-negative
                let v = Math.max(0, parseInt(valueInput.value, 10) || 0);
                if (valueInput.value !== '') valueInput.value = String(v);
                filterState[plate] = { op: opSelect.value, value: valueInput.value === '' ? null : v };
                renderResults();
            });
            row.append(label, opSelect, valueInput);
            filterPanel.appendChild(row);
        });

        // Add reset-all button at the bottom of the panel
        const actions = document.createElement('div');
        actions.className = 'filter-actions';
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn-primary';
        resetBtn.setAttribute('aria-label', '重置全部篩選');
        resetBtn.innerHTML = '<span class="material-symbols-outlined">replay</span>重置篩選';
        resetBtn.addEventListener('click', () => {
            const rows = filterPanel.querySelectorAll('.filter-row');
            rows.forEach(row => {
                const plate = row.getAttribute('data-plate');
                const selectEl = row.querySelector('select');
                const inputEl = row.querySelector('input[type="number"]');
                if (selectEl) selectEl.value = '=';
                if (inputEl) inputEl.value = '';
                filterState[plate] = { op: '=', value: null };
            });
            renderResults();
        });
        actions.appendChild(resetBtn);
        filterPanel.appendChild(actions);
    }

    document.addEventListener("input", function (event) {
        if (event.target === beforeServiceFeeInput) {
            let beforeValue = Math.max(0, parseInt(beforeServiceFeeInput.value, 10) || 0);
            beforeServiceFeeInput.value = String(beforeValue);
            const afterValue = (beforeValue * 1.1).toFixed(0);
            afterServiceFeeInput.value = afterValue;
        } else if (event.target === afterServiceFeeInput) {
            let afterValue = Math.max(0, parseInt(afterServiceFeeInput.value, 10) || 0);
            afterServiceFeeInput.value = String(afterValue);
            const beforeValue = (afterValue / 1.1).toFixed(0);
            beforeServiceFeeInput.value = beforeValue;
        }

        if (event.target.type === "checkbox") {
            if (event.target.checked === false) {
                if (event.target === whiteCheckbox) {
                    document.getElementById("th-white").hidden = true;
                } else if (event.target === redCheckbox) {
                    document.getElementById("th-red").hidden = true;
                } else if (event.target === silverCheckbox) {
                    document.getElementById("th-silver").hidden = true;
                } else if (event.target === goldCheckbox) {
                    document.getElementById("th-gold").hidden = true;
                } else if (event.target === blackCheckbox) {
                    document.getElementById("th-black").hidden = true;
                }
                plateHeader.colSpan = parseInt(plateHeader.colSpan) - 1;
            } else {
                if (event.target === whiteCheckbox) {
                    document.getElementById("th-white").hidden = false;
                } else if (event.target === redCheckbox) {
                    document.getElementById("th-red").hidden = false;
                } else if (event.target === silverCheckbox) {
                    document.getElementById("th-silver").hidden = false;
                } else if (event.target === goldCheckbox) {
                    document.getElementById("th-gold").hidden = false;
                } else if (event.target === blackCheckbox) {
                    document.getElementById("th-black").hidden = false;
                }
                plateHeader.colSpan = parseInt(plateHeader.colSpan) + 1;
            }
            // If a results table has been generated already, regenerate it to reflect checkbox change
            if (resultTable.rows.length > 0) {
                renderResults();
            }
            // Rebuild filter panel to only show enabled plates
            buildFilterPanel();
        }
    });
    calculateButton.addEventListener("click", function () {
        renderResults();
    });

    // Filter UI events
    if (filterButton) {
        filterButton.addEventListener('click', function () {
            if (!filterPanel) return;
            filterPanel.hidden = !filterPanel.hidden;
        });
    }

    // Default initial fee and auto-generate table on load
    beforeServiceFeeInput.value = '324';
    afterServiceFeeInput.value = (324 * 1.1).toFixed(0);
    // Build initial filter panel for enabled plates
    buildFilterPanel();
    renderResults();
});