let tableData = [];
let headers = [];
let myChart = null;
let columnDefinitions = [];
let currentSort = { column: null, direction: 'asc' };
let filteredData = [];

// Server response cache for analyze flow
let serverStats = null;
let serverChartData = null;
let numericColumns = [];
let categoricalColumns = [];

const API_BASE = 'http://127.0.0.1:5000';

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    initializeTheme();
    initializeLoginState();
    initializeColumnFields();
    setupDragAndDrop();
    setupFileInput();
    setupSearchAndFilter();
    setupProfileDropdown();
});

// ===================== LOGIN STATE MANAGEMENT =====================

function initializeLoginState() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // Lock overlays
    const lockOverlays = document.querySelectorAll('.lock-overlay');
    lockOverlays.forEach(overlay => {
        if (isLoggedIn) {
            overlay.classList.remove('active');
        } else {
            overlay.classList.add('active');
        }
    });
    
    // Hero CTAs
    const heroLoginBtn = document.getElementById('heroLoginBtn');
    const heroGetStartedBtn = document.getElementById('heroGetStartedBtn');
    const heroRegisterBtn = document.getElementById('heroRegisterBtn');
    
    if (heroLoginBtn) heroLoginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    if (heroGetStartedBtn) heroGetStartedBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
    if (heroRegisterBtn) heroRegisterBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    
    // Header: show profile or login button
    const profileSection = document.getElementById('profileSection');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    
    if (profileSection) profileSection.style.display = isLoggedIn ? 'flex' : 'none';
    if (headerLoginBtn) headerLoginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    
    // Sidebar auth button
    const sidebarAuthText = document.getElementById('sidebarAuthText');
    const sidebarAuthBtn = document.getElementById('sidebarAuthBtn');
    if (sidebarAuthText) {
        sidebarAuthText.textContent = isLoggedIn ? 'Logout' : 'Login';
    }
    if (sidebarAuthBtn) {
        const icon = sidebarAuthBtn.querySelector('i');
        if (icon) {
            icon.className = isLoggedIn 
                ? 'fa-solid fa-arrow-right-from-bracket' 
                : 'fa-solid fa-right-to-bracket';
        }
    }
}

function handleSidebarAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        localStorage.removeItem('isLoggedIn');
        window.location.reload();
    } else {
        window.location.href = 'login.html';
    }
}

// Profile Dropdown Logic
function setupProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    const displayUserName = document.getElementById('displayUserName');
    const displayUserEmail = document.getElementById('displayUserEmail');

    // Default to hidden
    if (dropdown) dropdown.style.display = 'none';

    // Fetch user info from localStorage (stored during login/register)
    const storedName = localStorage.getItem('userFullName') || 'Data Analyst';
    const storedEmail = localStorage.getItem('userEmail') || localStorage.getItem('username') || 'analyst@example.com';

    if (displayUserName) displayUserName.textContent = storedName;
    if (displayUserEmail) displayUserEmail.textContent = storedEmail;

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const container = document.querySelector('.profile-dropdown-container');
        if (container && !container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

function initializeColumnFields() {
    const defaultColumns = ['Name', 'Value', 'Category'];
    defaultColumns.forEach(col => {
        addColumnField(col);
    });
}

function addColumnField(columnName = '') {
    const container = document.getElementById('columnInputsContainer');
    const wrapper = document.createElement('div');
    wrapper.className = 'input-group';

    const colIndex = columnDefinitions.length;
    const defaultName = columnName || `Column ${colIndex + 1}`;

    const columnWrapper = document.createElement('div');
    columnWrapper.className = 'column-input-wrapper';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'column-name-input';
    nameInput.value = defaultName;
    nameInput.placeholder = 'Column name...';
    nameInput.dataset.columnIndex = colIndex;

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'column-value-input form-control';
    valueInput.placeholder = `Enter ${defaultName}`;
    valueInput.dataset.columnIndex = colIndex;

    columnWrapper.appendChild(nameInput);
    columnWrapper.appendChild(valueInput);

    if (columnDefinitions.length > 0) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-column-btn';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.onclick = () => removeColumnField(colIndex);
        columnWrapper.appendChild(removeBtn);
    }

    wrapper.appendChild(columnWrapper);
    container.appendChild(wrapper);

    columnDefinitions.push({
        name: defaultName,
        nameInput: nameInput,
        valueInput: valueInput
    });

    nameInput.addEventListener('input', (e) => {
        columnDefinitions[colIndex].name = e.target.value || `Column ${colIndex + 1}`;
        valueInput.placeholder = `Enter ${columnDefinitions[colIndex].name}`;
    });
}

function removeColumnField(index) {
    const container = document.getElementById('columnInputsContainer');
    const groups = container.querySelectorAll('.input-group');
    if (groups[index]) {
        groups[index].remove();
        columnDefinitions.splice(index, 1);

        // Update indices
        columnDefinitions.forEach((col, i) => {
            col.nameInput.dataset.columnIndex = i;
            col.valueInput.dataset.columnIndex = i;
        });
    }
}

function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function setupFileInput() {
    document.getElementById('fileInput').addEventListener('change', function (e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

function setupSearchAndFilter() {
    const searchBox = document.getElementById('searchBox');
    const filterColumn = document.getElementById('filterColumn');
    const groupByColumn = document.getElementById('groupByColumn');

    searchBox.addEventListener('input', applyFilters);
    filterColumn.addEventListener('change', applyFilters);
    groupByColumn.addEventListener('change', applyGrouping);
}

function handleFile(file) {
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
        alert('Unsupported file format. Please upload CSV or Excel files.');
        return;
    }

    sendFileToServer(file);
}

async function sendFileToServer(file) {
    const uploadArea = document.getElementById('uploadArea');

    // Show loading state
    uploadArea.classList.add('uploading');
    const originalContent = uploadArea.innerHTML;
    uploadArea.innerHTML = `
        <div class="upload-icon uploading-spinner">
            <i class="fa-solid fa-spinner fa-spin-pulse"></i>
        </div>
        <h3>Processing with server...</h3>
        <p>Sending <strong>${file.name}</strong> to Python backend for analysis</p>
    `;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Server error during analysis');
        }

        // Store server-computed data
        serverStats = result.stats;
        serverChartData = result.chartData;
        numericColumns = result.numeric_columns || [];
        categoricalColumns = result.categorical_columns || [];

        // Feed the preview data into the existing table system
        processData(result.data, result.columns);

        // Show success briefly
        uploadArea.innerHTML = `
            <div class="upload-icon" style="color: var(--success-color, #10b981);">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h3>File processed successfully!</h3>
            <p><strong>${result.total_rows}</strong> rows analyzed by Python &middot; ${result.columns.length} columns detected</p>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Stats computed with Pandas on the server</p>
        `;

        // Auto-trigger analysis since server already computed everything
        setTimeout(() => {
            analyzeData();
        }, 600);

    } catch (error) {
        console.error('Server analysis failed:', error);
        uploadArea.innerHTML = `
            <div class="upload-icon" style="color: var(--danger-color, #ef4444);">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3>Analysis failed</h3>
            <p>${error.message}</p>
            <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()" style="margin-top: 12px;">
                <i class="fa-regular fa-folder-open"></i> Try Again
            </button>
        `;
    }
}

function processData(data, cols) {
    headers = cols;
    tableData = data.filter(row => Object.values(row).some(val => val !== null && val !== ''));
    filteredData = [...tableData];
    updateFilterOptions();
    renderTable();
    document.getElementById('emptyState').style.display = 'none';
}

function addRow() {
    const row = {};

    columnDefinitions.forEach((col) => {
        const columnName = col.name;
        const value = col.valueInput.value || '';

        if (!headers.includes(columnName)) {
            headers.push(columnName);
        }
        row[columnName] = value;
    });

    tableData.push(row);
    filteredData = [...tableData];
    updateFilterOptions();
    renderTable();
    clearInputs();
    document.getElementById('emptyState').style.display = 'none';
}

function clearInputs() {
    columnDefinitions.forEach(col => {
        col.valueInput.value = '';
    });
}

function updateFilterOptions() {
    const filterColumn = document.getElementById('filterColumn');
    const groupByColumn = document.getElementById('groupByColumn');

    filterColumn.innerHTML = '<option value="">All Columns</option>';
    groupByColumn.innerHTML = '<option value="">No Grouping</option>';

    headers.forEach(header => {
        const option1 = document.createElement('option');
        option1.value = header;
        option1.textContent = header;
        filterColumn.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = header;
        option2.textContent = header;
        groupByColumn.appendChild(option2);
    });
}

function applyFilters() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const filterCol = document.getElementById('filterColumn').value;

    filteredData = tableData.filter(row => {
        const searchMatch = searchTerm === '' ||
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(searchTerm)
            );

        const filterMatch = filterCol === '' ||
            (row[filterCol] && String(row[filterCol]).toLowerCase().includes(searchTerm));

        return filterCol === '' ? searchMatch : filterMatch;
    });

    renderTable();
}

function applyGrouping() {
    const groupBy = document.getElementById('groupByColumn').value;

    if (!groupBy) {
        filteredData = [...tableData];
        renderTable();
        return;
    }

    const grouped = {};
    tableData.forEach(row => {
        const key = row[groupBy] || 'Ungrouped';
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(row);
    });

    filteredData = [];
    Object.keys(grouped).sort().forEach(key => {
        filteredData.push(...grouped[key]);
    });

    renderTable(groupBy);
}

function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    filteredData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();

        if (currentSort.direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return bVal < aVal ? -1 : bVal > aVal ? 1 : 0;
        }
    });

    renderTable();
}

function renderTable(groupByColumn = null) {
    const tableHead = document.getElementById('tableHead').querySelector('tr');
    const tableBody = document.getElementById('tableBody');

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    if (filteredData.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        return;
    }

    document.getElementById('emptyState').style.display = 'none';

    // Render headers with sort functionality
    headers.forEach(header => {
        const th = document.createElement('th');
        th.innerHTML = `<span>${header}</span><i class="sort-icon fa-solid fa-sort"></i>`;
        th.className = 'sortable';

        if (currentSort.column === header) {
            th.innerHTML = `<span>${header}</span><i class="sort-icon fa-solid fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'}"></i>`;
            th.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }

        th.onclick = () => sortTable(header);
        tableHead.appendChild(th);
    });

    const actionTh = document.createElement('th');
    actionTh.textContent = 'Actions';
    actionTh.style.width = '100px';
    actionTh.style.textAlign = 'center';
    tableHead.appendChild(actionTh);

    // Render rows
    let lastGroupValue = null;
    filteredData.forEach((row, index) => {
        if (groupByColumn && row[groupByColumn] !== lastGroupValue) {
            const groupRow = document.createElement('tr');
            groupRow.className = 'group-header-row';

            const groupCell = document.createElement('td');
            groupCell.colSpan = headers.length + 1;
            groupCell.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${groupByColumn}: ${row[groupByColumn] || 'Ungrouped'}`;
            groupRow.appendChild(groupCell);
            tableBody.appendChild(groupRow);

            lastGroupValue = row[groupByColumn];
        }

        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] !== undefined ? row[header] : '';
            tr.appendChild(td);
        });

        const actionTd = document.createElement('td');
        actionTd.style.textAlign = 'center';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon delete-row-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.onclick = () => deleteRow(tableData.indexOf(row));
        actionTd.appendChild(deleteBtn);
        tr.appendChild(actionTd);

        tableBody.appendChild(tr);
    });
}

function deleteRow(index) {
    tableData.splice(index, 1);
    filteredData = [...tableData];
    renderTable();
}

function clearTable() {
    if (confirm('Are you sure you want to clear all data?')) {
        tableData = [];
        headers = [];
        filteredData = [];
        serverStats = null;
        serverChartData = null;
        numericColumns = [];
        categoricalColumns = [];
        selectedStatsColumns.clear();
        renderTable();
        document.getElementById('statsSection').style.display = 'none';
        document.getElementById('chartSection').style.display = 'none';
    }
}

function resetFilters() {
    document.getElementById('searchBox').value = '';
    document.getElementById('filterColumn').value = '';
    document.getElementById('groupByColumn').value = '';
    currentSort = { column: null, direction: 'asc' };
    filteredData = [...tableData];
    renderTable();
}

function exportData() {
    if (tableData.length === 0) {
        alert('No data to export.');
        return;
    }

    const csv = Papa.unparse(tableData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// Track which columns the user has selected for stats
let selectedStatsColumns = new Set();

function analyzeData() {
    if (tableData.length === 0) {
        alert('No data to analyze. Please add data first.');
        return;
    }

    // Build the column selector chips
    populateStatsColumnSelector();

    // Use server stats if available, otherwise fall back to client-side
    if (serverStats && serverStats.length > 0) {
        renderServerStats();
    } else {
        calculateStatistics();
    }

    setupChartSelectors();
    updateChart();

    document.getElementById('statsSection').style.display = 'block';
    document.getElementById('chartSection').style.display = 'block';
    
    // smooth scroll to stats
    document.getElementById('statsSection').scrollIntoView({ behavior: 'smooth' });
}

function populateStatsColumnSelector() {
    const chipsContainer = document.getElementById('statsColumnChips');
    chipsContainer.innerHTML = '';

    // Determine which columns are numeric
    let numCols = [];
    if (numericColumns.length > 0) {
        // Server told us which are numeric
        numCols = numericColumns;
    } else {
        // Detect from data for manual entry
        headers.forEach(header => {
            const values = tableData.map(row => row[header]).filter(val => !isNaN(val) && val !== '' && val !== null);
            if (values.length > 0) {
                numCols.push(header);
            }
        });
    }

    // If first time (nothing selected yet), select all by default
    if (selectedStatsColumns.size === 0) {
        numCols.forEach(col => selectedStatsColumns.add(col));
    }

    numCols.forEach(col => {
        const chip = document.createElement('div');
        chip.className = 'column-chip' + (selectedStatsColumns.has(col) ? ' active' : '');
        chip.innerHTML = `
            <span class="chip-check"><i class="fa-solid fa-check"></i></span>
            <span>${col}</span>
        `;
        chip.addEventListener('click', () => {
            if (selectedStatsColumns.has(col)) {
                selectedStatsColumns.delete(col);
                chip.classList.remove('active');
            } else {
                selectedStatsColumns.add(col);
                chip.classList.add('active');
            }
            // Re-render stats with the new selection
            if (serverStats && serverStats.length > 0) {
                renderServerStats();
            } else {
                calculateStatistics();
            }
        });
        chipsContainer.appendChild(chip);
    });
}

// Render stats returned by the Python/Pandas server
function renderServerStats() {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';

    // Total rows
    addStatCard('<i class="fa-solid fa-table-list"></i>', 'Total Rows', tableData.length, '<span style="color: var(--accent-primary);">via Server</span>');

    serverStats.forEach(stat => {
        // Only show stats for selected columns
        if (!selectedStatsColumns.has(stat.column)) return;

        addStatCard('<i class="fa-solid fa-chart-line"></i>', `${stat.column} (Avg)`, stat.mean, '');
        addStatCard('<i class="fa-solid fa-hashtag"></i>', `${stat.column} (Count)`, stat.count, '');
        addStatCard('<i class="fa-solid fa-arrow-up-right-dots"></i>', `${stat.column} (Max)`, stat.max, '');
        addStatCard('<i class="fa-solid fa-arrow-down-right-dots"></i>', `${stat.column} (Min)`, stat.min, '');
    });
}

// Fallback: client-side statistics for manually entered data
function calculateStatistics() {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';

    // Total rows
    addStatCard('<i class="fa-solid fa-table-list"></i>', 'Total Rows', tableData.length, '');

    // Numeric column statistics
    headers.forEach(header => {
        // Only show stats for selected columns
        if (!selectedStatsColumns.has(header)) return;

        const values = tableData.map(row => row[header]).filter(val => !isNaN(val) && val !== '');

        if (values.length > 0) {
            const numValues = values.map(Number);
            const sum = numValues.reduce((a, b) => a + b, 0);
            const avg = sum / numValues.length;
            const max = Math.max(...numValues);
            const min = Math.min(...numValues);
            const median = calculateMedian(numValues);

            addStatCard('<i class="fa-solid fa-chart-line"></i>', `${header} (Avg)`, avg.toFixed(2), '');
            addStatCard('<i class="fa-solid fa-calculator"></i>', `${header} (Sum)`, sum.toFixed(2), '');
            addStatCard('<i class="fa-solid fa-arrow-up-right-dots"></i>', `${header} (Max)`, max, '');
            addStatCard('<i class="fa-solid fa-arrow-down-right-dots"></i>', `${header} (Min)`, min, '');
            addStatCard('<i class="fa-solid fa-chart-pie"></i>', `${header} (Median)`, median.toFixed(2), '');
        }
    });
}

function refreshStats() {
    populateStatsColumnSelector();
    if (serverStats && serverStats.length > 0) {
        renderServerStats();
    } else {
        calculateStatistics();
    }
}

function calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function addStatCard(icon, label, value, trend) {
    const statsGrid = document.getElementById('statsGrid');
    const card = document.createElement('div');
    card.className = 'stat-card glass-panel';
    card.innerHTML = `
        <div class="stat-icon-wrapper">
            <div class="stat-icon">${icon}</div>
        </div>
        <div class="stat-content">
            <h3>${value}</h3>
            <p>${label}</p>
            ${trend ? `<div class="stat-trend">${trend}</div>` : ''}
        </div>
    `;
    statsGrid.appendChild(card);
}

function setupChartSelectors() {
    const xAxis = document.getElementById('xAxis');
    const yAxis = document.getElementById('yAxis');

    xAxis.innerHTML = '<option value="">Select X-Axis</option>';
    yAxis.innerHTML = '<option value="">Select Y-Axis</option>';

    headers.forEach(header => {
        const optionX = document.createElement('option');
        optionX.value = header;
        optionX.textContent = header;
        xAxis.appendChild(optionX);

        const optionY = document.createElement('option');
        optionY.value = header;
        optionY.textContent = header;
        yAxis.appendChild(optionY);
    });

    if (headers.length >= 2) {
        xAxis.selectedIndex = 1;
        yAxis.selectedIndex = 2;
    }
}

function updateChart() {
    const chartType = document.getElementById('chartType').value;
    const xAxisValue = document.getElementById('xAxis').value;
    const yAxisValue = document.getElementById('yAxis').value;

    if (!xAxisValue || !yAxisValue) return;

    // Use server chart data if available, otherwise use local tableData
    const chartSource = serverChartData && serverChartData.length > 0 ? serverChartData : tableData;
    const labels = chartSource.map(row => row[xAxisValue]);
    const data = chartSource.map(row => parseFloat(row[yAxisValue]) || 0);

    // Destroy old chart first
    if (myChart) {
        myChart.destroy();
        myChart = null;
    }

    // Replace the canvas with a fresh one to give Chart.js a clean slate
    const chartWrapper = document.querySelector('.chart-wrapper');
    const oldCanvas = document.getElementById('dataChart');
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'dataChart';
    chartWrapper.replaceChild(newCanvas, oldCanvas);

    // IMPORTANT: Get ctx AFTER replacing the canvas
    const ctx = document.getElementById('dataChart').getContext('2d');

    // Generate enough colors for every data point (pie/doughnut need one per slice)
    function generateColors(count) {
        const baseColors = [
            { h: 239, s: 84, l: 67 },  // Indigo
            { h: 271, s: 81, l: 66 },  // Purple
            { h: 330, s: 81, l: 60 },  // Pink
            { h: 199, s: 89, l: 48 },  // Sky
            { h: 160, s: 84, l: 39 },  // Emerald
            { h: 38,  s: 92, l: 50 },  // Amber
            { h: 217, s: 91, l: 60 },  // Blue
            { h: 0,   s: 84, l: 60 },  // Red
        ];
        const colors = [];
        for (let i = 0; i < count; i++) {
            const base = baseColors[i % baseColors.length];
            // Slightly shift lightness for repeated cycles so colors stay distinct
            const shift = Math.floor(i / baseColors.length) * 10;
            colors.push(`hsla(${base.h}, ${base.s}%, ${Math.min(base.l + shift, 85)}%, 0.85)`);
        }
        return colors;
    }

    const isPieType = chartType === 'pie' || chartType === 'doughnut';
    const isRadar   = chartType === 'radar';

    const bgColors     = generateColors(data.length);
    const borderColors = bgColors.map(c => c.replace('0.85)', '1)'));

    const isLight = document.body.classList.contains('light-mode');
    const textColor = isLight ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.7)';
    const textColorStrong = isLight ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
    const gridColorRadar = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const tooltipBg = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)';
    const tooltipTextColor = isLight ? '#1e293b' : '#fff';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Outfit', sans-serif";

    // Dataset config differs by chart type
    const datasetConfig = {
        label: yAxisValue,
        data: data,
        borderWidth: 2,
    };

    if (isPieType) {
        // Pie/Doughnut: one color per slice
        datasetConfig.backgroundColor = bgColors;
        datasetConfig.borderColor     = borderColors;
        datasetConfig.hoverOffset     = 8;
    } else if (isRadar) {
        datasetConfig.backgroundColor = 'rgba(99, 102, 241, 0.25)';
        datasetConfig.borderColor     = 'rgba(99, 102, 241, 1)';
        datasetConfig.pointBackgroundColor = 'rgba(99, 102, 241, 1)';
    } else {
        // Bar / Line: single consistent color
        datasetConfig.backgroundColor = 'rgba(99, 102, 241, 0.8)';
        datasetConfig.borderColor     = 'rgba(99, 102, 241, 1)';
        datasetConfig.tension         = 0.4;
        datasetConfig.pointBackgroundColor     = 'rgba(99, 102, 241, 1)';
        datasetConfig.pointBorderColor         = isLight ? '#fff' : '#fff';
        datasetConfig.pointHoverBackgroundColor = isLight ? '#fff' : '#fff';
        datasetConfig.pointHoverBorderColor     = 'rgba(99, 102, 241, 1)';
        if (chartType === 'line') {
            datasetConfig.fill = { target: 'origin', above: 'rgba(99, 102, 241, 0.1)' };
        }
    }

    myChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [datasetConfig]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: isPieType || isRadar,
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: { size: 13, family: "'Outfit', sans-serif" },
                        color: textColorStrong
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: tooltipTextColor,
                    bodyColor: tooltipTextColor,
                    titleFont: { size: 14, family: "'Outfit', sans-serif" },
                    bodyFont:  { size: 13, family: "'Outfit', sans-serif" },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'transparent',
                    borderWidth: isLight ? 1 : 0
                }
            },
            scales: isRadar ? {
                r: {
                    grid:       { color: gridColorRadar },
                    angleLines: { color: gridColorRadar },
                    ticks:      { backdropColor: 'transparent', color: textColor }
                }
            } : isPieType ? {} : {
                y: {
                    beginAtZero: true,
                    grid:  { color: gridColor, drawBorder: false },
                    ticks: { color: textColor }
                },
                x: {
                    grid:  { display: false, drawBorder: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

// Theme Toggle Logic
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const icon = document.getElementById('themeIcon');
    if (icon) {
        if (isLight) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    // Update Chart defaults for the new theme
    Chart.defaults.color = isLight ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)';
    if (myChart) {
        updateChart();
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const icon = document.getElementById('themeIcon');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
        Chart.defaults.color = 'rgba(30, 41, 59, 0.7)';
    } else {
        Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    }
}
