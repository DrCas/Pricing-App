let materials = {};
let laminations = {};
let appSettings = {
    cut_addon_per_sqft: 8.5,
    markup_presets: [
        { name: "Conservative", multiplier: 2 },
        { name: "Standard", multiplier: 3 }
    ]
};
let currentMarkupValue = "";
const jobOptionChoices = [
   { value: "none", label: "None" },
   { value: "cut", label: "Cut only" },
   { value: "laminate", label: "Laminate only" },
   { value: "cutlam", label: "Cut + Laminate" }
];
 
const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
});

function getNumber(id) {
    const value = Number(document.getElementById(id).value);
    const number = Number.isFinite(value) ? value : 0;
    return Math.max(0, number);
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
}

function formatMoney(value) {
    return moneyFormatter.format(value || 0);
}

function setupTabs() {
    const buttons = document.querySelectorAll(".tab-button");
    const panels = document.querySelectorAll(".tab-panel");

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            buttons.forEach((item) => item.classList.remove("active"));
            panels.forEach((panel) => panel.classList.remove("active"));

            button.classList.add("active");
            document.getElementById(button.dataset.tab).classList.add("active");
        });
    });
}

function setupScrollWheelNumbers() {
    const numberInputs = document.querySelectorAll('input[type="number"]');

    numberInputs.forEach((input) => {
        input.addEventListener("wheel", (event) => {
            if (document.activeElement !== input) {
                return;
            }

            event.preventDefault();

            const step = Number(input.step) || 1;
            const currentValue = Number(input.value) || 0;
            const direction = event.deltaY < 0 ? 1 : -1;
            const nextValue = currentValue + step * direction;
            const minValue = Number(input.min) || 0;
            const clampedValue = Math.max(minValue, nextValue);

            input.value = Number(clampedValue.toFixed(2));
            input.dispatchEvent(new Event("input"));
        }, { passive: false });
    });
}

async function loadSettings() {
    const response = await fetch("/api/settings");
    appSettings = await response.json();

    document.getElementById("settingsCutRate").value = appSettings.cut_addon_per_sqft;
    renderMarkupPresetRows();
    refreshMarkupDropdown();
}

async function saveSettings() {
    const status = document.getElementById("settingsStatus");
    status.classList.remove("error");
    status.textContent = "";

    const markupPresets = gatherMarkupPresets();
    if (!markupPresets.length) {
        status.classList.add("error");
        status.textContent = "Please configure at least one markup preset.";
        return;
    }

    const payload = {
        cut_addon_per_sqft: getNumber("settingsCutRate"),
        markup_presets: markupPresets
    };

    const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        status.classList.add("error");
        status.textContent = result.error || "Could not save settings.";
        return;
    }

    appSettings = result.settings;
    renderMarkupPresetRows();
    refreshMarkupDropdown();
    status.textContent = "Settings saved.";
}

async function loadMaterials() {
    const response = await fetch("/api/materials");
    materials = await response.json();

    renderMaterialDropdown("");
    renderMaterialList();
}

function getMaterialCostPerSqft(material) {
    const rollWidthFeet = Number(material.roll_width_inches) / 12;
    const rollSqft = rollWidthFeet * Number(material.roll_length_feet);
    return rollSqft > 0 ? Number(material.roll_cost) / rollSqft : 0;
}

function renderMaterialDropdown(query) {
    const dropdown = document.getElementById("materialDropdown");
    const normalizedQuery = query.trim().toLowerCase();

    const names = Object.keys(materials)
        .sort()
        .filter((name) => {
            if (!normalizedQuery) {
                return true;
            }

            const material = materials[name];
            const haystack = `${name} ${material.category || ""}`.toLowerCase();
            return haystack.includes(normalizedQuery);
        });

    dropdown.innerHTML = "";

    if (names.length === 0) {
        dropdown.innerHTML = `<div class="material-option"><span>No materials found.</span></div>`;
        return;
    }

    names.forEach((name) => {
        const material = materials[name];
        const costPerSqft = getMaterialCostPerSqft(material);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "material-option";
        button.innerHTML = `
            <strong>${name}</strong>
            <span>${material.category || "No category"} | ${formatMoney(costPerSqft)}/sqft</span>
        `;

        button.addEventListener("click", () => selectMaterial(name));

        dropdown.appendChild(button);
    });
}

function showMaterialDropdown() {
    document.getElementById("materialDropdown").classList.remove("hidden");
}

function hideMaterialDropdownSoon() {
    window.setTimeout(() => {
        document.getElementById("materialDropdown").classList.add("hidden");
    }, 160);
}

function selectMaterial(name) {
    const material = materials[name];

    if (!material) {
        return;
    }

    document.getElementById("materialSearch").value = name;
    document.getElementById("rollCost").value = material.roll_cost;
    document.getElementById("rollWidth").value = material.roll_width_inches;
    document.getElementById("rollLength").value = material.roll_length_feet;
    document.getElementById("materialDropdown").classList.add("hidden");
}

function setupMaterialSearch() {
    const searchInput = document.getElementById("materialSearch");

    searchInput.addEventListener("input", () => {
        renderMaterialDropdown(searchInput.value);
        showMaterialDropdown();
    });

    searchInput.addEventListener("focus", () => {
        renderMaterialDropdown(searchInput.value);
        showMaterialDropdown();
    });

    searchInput.addEventListener("blur", hideMaterialDropdownSoon);
}

function renderMaterialList() {
    const list = document.getElementById("materialList");
    list.innerHTML = "";

    const names = Object.keys(materials).sort();

    if (names.length === 0) {
        list.innerHTML = `<p class="panel-note">No materials saved yet.</p>`;
        return;
    }

    names.forEach((name) => {
        const material = materials[name];
        const costPerSqft = getMaterialCostPerSqft(material);

        const card = document.createElement("div");
        card.className = "material-card";

        card.innerHTML = `
            <div class="material-info">
                <strong>${name}</strong>
                <span>${material.category || "No category"}</span>
                <span>Roll: ${formatMoney(material.roll_cost)} | ${material.roll_width_inches}" × ${material.roll_length_feet} ft | Cost: ${formatMoney(costPerSqft)}/sqft</span>
            </div>
            <div class="material-actions">
                <button class="small-button" type="button" data-edit-material="${name}">Edit</button>
                <button class="danger-button" type="button" data-delete-material="${name}">Delete</button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll("[data-edit-material]").forEach((button) => {
        button.addEventListener("click", () => fillMaterialForm(button.dataset.editMaterial));
    });

    list.querySelectorAll("[data-delete-material]").forEach((button) => {
        button.addEventListener("click", () => deleteMaterial(button.dataset.deleteMaterial));
    });
}
 
function setupJobOptionDropdown() {
    const button = document.getElementById("jobOptionButton");
    const dropdown = document.getElementById("jobOptionDropdown");
    const select = document.getElementById("jobOptionSelect");
    let currentValue = select.value || "none";

    function renderDropdown() {
        dropdown.innerHTML = "";

        jobOptionChoices.forEach((option) => {
            const buttonOption = document.createElement("button");
            buttonOption.type = "button";
            buttonOption.className = `material-option ${option.value === currentValue ? "active" : ""}`;
            buttonOption.textContent = option.label;
            buttonOption.addEventListener("click", () => selectJobOption(option.value, option.label));
            dropdown.appendChild(buttonOption);
        });
    }

    function selectJobOption(value, label) {
        currentValue = value;
        select.value = value;
        button.textContent = label;
        dropdown.classList.add("hidden");
        toggleLaminationOptions();
        renderDropdown();
    }

    button.addEventListener("click", () => {
        dropdown.classList.toggle("hidden");
        renderDropdown();
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".job-option-wrap")) {
            dropdown.classList.add("hidden");
        }
    });

    renderDropdown();
}

function renderLaminationDropdown(query = "") {
    const dropdown = document.getElementById("laminationDropdown");
    const normalizedQuery = query.trim().toLowerCase();
    const names = Object.keys(laminations)
        .sort()
        .filter((name) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery) || (laminations[name].category || "").toLowerCase().includes(normalizedQuery));

    dropdown.innerHTML = "";

    if (names.length === 0) {
        dropdown.innerHTML = `<div class="material-option"><span>No laminations found.</span></div>`;
        return;
    }

    names.forEach((name) => {
        const lam = laminations[name];
        const costPerSqft = getMaterialCostPerSqft(lam);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "material-option";
        button.innerHTML = `
            <strong>${name}</strong>
            <span>${lam.category || "No category"} | ${formatMoney(costPerSqft)}/sqft</span>
        `;
        button.addEventListener("click", () => selectLamination(name));
        dropdown.appendChild(button);
    });
}

function selectLamination(name) {
    const searchInput = document.getElementById("laminationSearch");
    const select = document.getElementById("laminationSelect");

    if (!laminations[name]) {
        return;
    }

    searchInput.value = name;
    select.value = name;
    document.getElementById("laminationDropdown").classList.add("hidden");
    updateLaminationDetails(name);
}

function setupLaminationSearch() {
    const searchInput = document.getElementById("laminationSearch");

    searchInput.addEventListener("input", () => {
        renderLaminationDropdown(searchInput.value);
        document.getElementById("laminationDropdown").classList.remove("hidden");
    });

    searchInput.addEventListener("focus", () => {
        renderLaminationDropdown(searchInput.value);
        document.getElementById("laminationDropdown").classList.remove("hidden");
    });

    searchInput.addEventListener("blur", hideLaminationDropdownSoon);
}

function hideLaminationDropdownSoon() {
    window.setTimeout(() => {
        document.getElementById("laminationDropdown").classList.add("hidden");
    }, 160);
}

function renderLaminationSelect(selectedName = "") {
    const select = document.getElementById("laminationSelect");
    const searchInput = document.getElementById("laminationSearch");
    const buttonLabel = selectedName || "Select a lamination";

    select.innerHTML = "";

    const names = Object.keys(laminations).sort();
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = names.length ? "Select a lamination" : "No laminations saved";
    placeholderOption.disabled = !!names.length;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);

    names.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        if (name === selectedName) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    searchInput.value = selectedName;
    updateLaminationDetails(selectedName);
}

function updateLaminationDetails(name) {
    const details = document.getElementById("laminationDetails");

    if (!name || !laminations[name]) {
        details.innerHTML = `<p class="panel-note">Choose a lamination to see its category and cost per sqft.</p>`;
        return;
    }

    const lam = laminations[name];
    const costPerSqft = getMaterialCostPerSqft(lam);

    details.innerHTML = `
        <div><strong>Category:</strong> ${lam.category || "N/A"}</div>
        <div><strong>Roll:</strong> ${lam.roll_width_inches}" × ${lam.roll_length_feet} ft</div>
        <div><strong>Cost / SqFt:</strong> ${formatMoney(costPerSqft)}</div>
    `;
}

function renderLaminationList() {
    const list = document.getElementById("laminationList");
    list.innerHTML = "";

    const names = Object.keys(laminations).sort();

    if (names.length === 0) {
        list.innerHTML = `<p class="panel-note">No laminations saved yet.</p>`;
        return;
    }

    names.forEach((name) => {
        const lam = laminations[name];
        const costPerSqft = getMaterialCostPerSqft(lam);

        const card = document.createElement("div");
        card.className = "material-card";
        card.innerHTML = `
            <div class="material-info">
                <strong>${name}</strong>
                <span>${lam.category || "No category"}</span>
                <span>Roll: ${formatMoney(lam.roll_cost)} | ${lam.roll_width_inches}" × ${lam.roll_length_feet} ft | ${formatMoney(costPerSqft)}/sqft</span>
            </div>
            <div class="material-actions">
                <button class="small-button" type="button" data-edit-lamination="${name}">Edit</button>
                <button class="danger-button" type="button" data-delete-lamination="${name}">Delete</button>
            </div>
        `;

        list.appendChild(card);
    });

    list.querySelectorAll("[data-edit-lamination]").forEach((button) => {
        button.addEventListener("click", () => fillLaminationForm(button.dataset.editLamination));
    });

    list.querySelectorAll("[data-delete-lamination]").forEach((button) => {
        button.addEventListener("click", () => deleteLamination(button.dataset.deleteLamination));
    });
}

function toggleCollapsePanel(button) {
    const targetId = button.dataset.target;
    const panel = document.getElementById(targetId);

    if (!panel) {
        return;
    }

    const expanded = panel.classList.toggle("expanded");
    panel.style.maxHeight = expanded ? `${panel.scrollHeight}px` : "0px";
    button.querySelector(".toggle-icon").textContent = expanded ? "▴" : "▾";
}

function fillLaminationForm(name) {
    const lam = laminations[name];

    if (!lam) {
        return;
    }

    document.getElementById("editingOriginalLaminationName").value = name;
    document.getElementById("laminationName").value = name;
    document.getElementById("laminationCategory").value = lam.category || "";
    document.getElementById("laminationRollCost").value = lam.roll_cost;
    document.getElementById("laminationRollWidth").value = lam.roll_width_inches;
    document.getElementById("laminationRollLength").value = lam.roll_length_feet;

    document.getElementById("laminationStatus").textContent = `Editing ${name}. Save will overwrite this lamination.`;
}

function clearLaminationForm() {
    document.getElementById("editingOriginalLaminationName").value = "";
    document.getElementById("laminationName").value = "";
    document.getElementById("laminationCategory").value = "";
    document.getElementById("laminationRollCost").value = "";
    document.getElementById("laminationRollWidth").value = "";
    document.getElementById("laminationRollLength").value = "";
    document.getElementById("laminationStatus").textContent = "Ready for a new lamination.";
}

async function saveLamination() {
    const status = document.getElementById("laminationStatus");
    status.classList.remove("error");
    status.textContent = "";

    const originalName = document.getElementById("editingOriginalLaminationName").value;
    const payload = {
        original_name: originalName,
        name: document.getElementById("laminationName").value,
        category: document.getElementById("laminationCategory").value,
        roll_cost: getNumber("laminationRollCost"),
        roll_width_inches: getNumber("laminationRollWidth"),
        roll_length_feet: getNumber("laminationRollLength")
    };

    const response = await fetch("/api/laminations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        status.classList.add("error");
        status.textContent = result.error || "Could not save lamination.";
        return;
    }

    laminations = result.laminations;
    renderLaminationSelect(payload.name);
    renderLaminationList();

    document.getElementById("editingOriginalLaminationName").value = payload.name;
    status.textContent = originalName ? "Lamination updated." : "Lamination saved.";
}

async function deleteLamination(name) {
    const confirmed = window.confirm(`Delete ${name}?`);

    if (!confirmed) {
        return;
    }

    const response = await fetch(`/api/laminations/${encodeURIComponent(name)}`, {
        method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
        const status = document.getElementById("laminationStatus");
        status.classList.add("error");
        status.textContent = result.error || "Could not delete lamination.";
        return;
    }

    laminations = result.laminations;
    renderLaminationSelect("");
    renderLaminationList();

    if (document.getElementById("editingOriginalLaminationName").value === name) {
        clearLaminationForm();
    }

    document.getElementById("laminationStatus").textContent = "Lamination deleted.";
}

function loadLaminations() {
    return fetch("/api/laminations").then((res) => res.json()).then((data) => {
        laminations = data;
        renderLaminationSelect();
        renderLaminationList();
    });
}

function toggleLaminationOptions() {
    const jobOption = document.getElementById("jobOptionSelect").value;
    const show = jobOption === "laminate" || jobOption === "cutlam";

    document.getElementById("laminationOptions").classList.toggle("hidden", !show);

    if (show) {
        updateLaminationDetails(document.getElementById("laminationSelect").value);
    }
}

function openTab(tabId) {
    const buttons = document.querySelectorAll(".tab-button");
    const panels = document.querySelectorAll(".tab-panel");

    buttons.forEach((item) => item.classList.toggle("active", item.dataset.tab === tabId));
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

function fillMaterialForm(name) {
    const material = materials[name];

    if (!material) {
        return;
    }

    document.getElementById("editingOriginalMaterialName").value = name;
    document.getElementById("materialName").value = name;
    document.getElementById("materialCategory").value = material.category || "";
    document.getElementById("materialRollCost").value = material.roll_cost;
    document.getElementById("materialRollWidth").value = material.roll_width_inches;
    document.getElementById("materialRollLength").value = material.roll_length_feet;

    document.getElementById("materialStatus").textContent = `Editing ${name}. Save will overwrite this material.`;
}

function clearMaterialForm() {
    document.getElementById("editingOriginalMaterialName").value = "";
    document.getElementById("materialName").value = "";
    document.getElementById("materialCategory").value = "";
    document.getElementById("materialRollCost").value = "";
    document.getElementById("materialRollWidth").value = "";
    document.getElementById("materialRollLength").value = "";
    document.getElementById("materialStatus").textContent = "Ready for a new material.";
}

async function saveMaterial() {
    const status = document.getElementById("materialStatus");
    status.classList.remove("error");
    status.textContent = "";

    const originalName = document.getElementById("editingOriginalMaterialName").value;

    const payload = {
        original_name: originalName,
        name: document.getElementById("materialName").value,
        category: document.getElementById("materialCategory").value,
        roll_cost: getNumber("materialRollCost"),
        roll_width_inches: getNumber("materialRollWidth"),
        roll_length_feet: getNumber("materialRollLength")
    };

    const response = await fetch("/api/materials", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        status.classList.add("error");
        status.textContent = result.error || "Could not save material.";
        return;
    }

    materials = result.materials;
    renderMaterialDropdown(document.getElementById("materialSearch").value);
    renderMaterialList();

    document.getElementById("editingOriginalMaterialName").value = payload.name;
    status.textContent = originalName ? "Material updated." : "Material saved.";
}

async function deleteMaterial(name) {
    const confirmed = window.confirm(`Delete ${name}?`);

    if (!confirmed) {
        return;
    }

    const response = await fetch(`/api/materials/${encodeURIComponent(name)}`, {
        method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
        const status = document.getElementById("materialStatus");
        status.classList.add("error");
        status.textContent = result.error || "Could not delete material.";
        return;
    }

    materials = result.materials;
    renderMaterialDropdown(document.getElementById("materialSearch").value);
    renderMaterialList();

    if (document.getElementById("editingOriginalMaterialName").value === name) {
        clearMaterialForm();
    }

    document.getElementById("materialStatus").textContent = "Material deleted.";
}

function renderMarkupPresetRows() {
    const list = document.getElementById("markupPresetsList");
    list.innerHTML = "";

    const presets = Array.isArray(appSettings.markup_presets)
        ? appSettings.markup_presets
        : [];

    if (!presets.length) {
        presets.push({ name: "Standard", multiplier: 3 });
    }

    presets.forEach((preset) => {
        addMarkupPresetRow(preset.name, preset.multiplier);
    });

    if (!currentMarkupValue) {
        currentMarkupValue = presets[0].multiplier.toString();
    }
}

function addMarkupPresetRow(name = "", multiplier = "") {
    const list = document.getElementById("markupPresetsList");
    const row = document.createElement("div");
    row.className = "markup-preset-row";
    row.innerHTML = `
        <div class="preset-field">
            <label>Preset Name</label>
            <input class="preset-name" type="text" value="${name}" placeholder="Standard" />
        </div>
        <div class="preset-field">
            <label>Multiplier</label>
            <input class="preset-multiplier scroll-number" type="number" step="0.1" min="0.1" value="${multiplier}" placeholder="3" />
        </div>
        <button type="button" class="small-button remove-preset">Remove</button>
    `;

    row.querySelector(".remove-preset").addEventListener("click", () => {
        row.remove();
        if (!document.querySelectorAll(".markup-preset-row").length) {
            addMarkupPresetRow();
        }
    });

    list.appendChild(row);
}

function gatherMarkupPresets() {
    return Array.from(document.querySelectorAll(".markup-preset-row"))
        .map((row) => {
            const name = row.querySelector(".preset-name").value.trim();
            const multiplier = Number(row.querySelector(".preset-multiplier").value);
            return { name, multiplier };
        })
        .filter((preset) => preset.name && preset.multiplier > 0);
}

function getMarkupOptions() {
    const presets = Array.isArray(appSettings.markup_presets) ? appSettings.markup_presets : [];
    const options = presets.map((preset) => ({
        value: preset.multiplier.toString(),
        label: `${preset.name} / ${preset.multiplier}x`
    }));
    options.push({ value: "custom", label: "Custom" });
    return options;
}

function setupMarkupDropdown() {
    const markupButton = document.getElementById("markupButton");
    const markupDropdown = document.getElementById("markupDropdown");
    const customWrap = document.getElementById("customMarkupWrap");

    function renderDropdown() {
        const markupOptions = getMarkupOptions();
        markupDropdown.innerHTML = "";
        markupOptions.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `markup-option ${option.value === currentMarkupValue ? "active" : ""}`;
            button.textContent = option.label;
            button.addEventListener("click", () => selectMarkup(option.value, option.label));
            markupDropdown.appendChild(button);
        });
    }

    function selectMarkup(value, label) {
        currentMarkupValue = value;
        markupButton.textContent = label;
        markupDropdown.classList.add("hidden");
        customWrap.classList.toggle("hidden", value !== "custom");
        renderDropdown();
    }

    markupButton.addEventListener("click", () => {
        markupDropdown.classList.toggle("hidden");
        renderDropdown();
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".markup-search-wrap")) {
            markupDropdown.classList.add("hidden");
        }
    });

    window.getMarkupValue = () => currentMarkupValue;

    function resetCurrentMarkupValue() {
        const presetOptions = getMarkupOptions().filter((option) => option.value !== "custom");
        currentMarkupValue = presetOptions.length ? presetOptions[0].value : "custom";
        markupButton.textContent = presetOptions.length
            ? presetOptions[0].label
            : "Custom";
        customWrap.classList.toggle("hidden", currentMarkupValue !== "custom");
    }

    function refreshMarkupDropdown() {
        const markupOptions = getMarkupOptions();
        if (!markupOptions.some((option) => option.value === currentMarkupValue)) {
            resetCurrentMarkupValue();
        }
        renderDropdown();
    }

    document.refreshMarkupDropdown = refreshMarkupDropdown;
    resetCurrentMarkupValue();
    renderDropdown();
}

function refreshMarkupDropdown() {
    if (typeof document.refreshMarkupDropdown === "function") {
        document.refreshMarkupDropdown();
    }
}

function setupMarkupToggle() {
    setupMarkupDropdown();
}

function setupSettingsInteractions() {
    const addPresetButton = document.getElementById("addMarkupPreset");
    addPresetButton.addEventListener("click", () => addMarkupPresetRow());
}

function calculateSqftPrice() {
    const rollCost = getNumber("rollCost");
    const rollWidthInches = getNumber("rollWidth");
    const rollLengthFeet = getNumber("rollLength");
    const jobWidthFeet = getNumber("jobWidth");
    const jobHeightFeet = getNumber("jobHeight");
    const extraFees = getNumber("extraFees");

    const jobOption = document.getElementById("jobOptionSelect").value;
    const isCut = jobOption === "cut" || jobOption === "cutlam";
    const isLaminated = jobOption === "laminate" || jobOption === "cutlam";

    const markupSelect = window.getMarkupValue();
    const markup = markupSelect === "custom" ? getNumber("customMarkup") : Number(markupSelect);

    const rollWidthFeet = rollWidthInches / 12;
    const rollSqft = rollWidthFeet * rollLengthFeet;
    const costPerSqft = rollSqft > 0 ? rollCost / rollSqft : 0;

    const materialBasePerSqft = costPerSqft;
    const materialMarkupPerSqft = costPerSqft * (markup - 1);
    const materialSellPerSqft = materialBasePerSqft + materialMarkupPerSqft;

    const selectedLamination = laminations[document.getElementById("laminationSelect").value];
    const laminationBasePerSqft = isLaminated && selectedLamination ? getMaterialCostPerSqft(selectedLamination) : 0;
    const laminationMarkupPerSqft = isLaminated ? laminationBasePerSqft * (markup - 1) : 0;
    const laminationSellPerSqft = laminationBasePerSqft + laminationMarkupPerSqft;

    const cutAddonPerSqft = isCut ? Number(appSettings.cut_addon_per_sqft) : 0;
    const finalSellPerSqft = materialSellPerSqft + laminationSellPerSqft + cutAddonPerSqft;

    const billableWidth = isCut ? jobWidthFeet + 1 : jobWidthFeet;
    const billableHeight = isCut ? jobHeightFeet + 1 : jobHeightFeet;
    const billableSqft = billableWidth * billableHeight;

    const materialBillableAmount = billableSqft * materialSellPerSqft;
    const laminationBillableAmount = billableSqft * laminationSellPerSqft;
    const cutBillableAmount = billableSqft * cutAddonPerSqft;
    const finalTotal = materialBillableAmount + laminationBillableAmount + cutBillableAmount + extraFees;

    setText("materialBasePerSqft", formatMoney(materialBasePerSqft));
    setText("materialMarkupPerSqft", formatMoney(materialMarkupPerSqft));
    setText("laminationBasePerSqft", formatMoney(laminationBasePerSqft));
    setText("laminationMarkupPerSqft", formatMoney(laminationMarkupPerSqft));
    setText("cutAddonPerSqft", formatMoney(cutAddonPerSqft));
    setText("sellPerSqftResult", formatMoney(finalSellPerSqft));
    setText("billableSizeResult", `${billableWidth.toFixed(2)} ft × ${billableHeight.toFixed(2)} ft`);
    setText("billableSqftResult", `${billableSqft.toFixed(2)} sqft`);
    setText("sqftTotalResult", formatMoney(finalTotal));
}

document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    setupMarkupToggle();
    setupMaterialSearch();
    setupJobOptionDropdown();
    setupLaminationSearch();
    setupScrollWheelNumbers();

    await loadSettings();
    await loadMaterials();
    await loadLaminations();

    setupSettingsInteractions();

    document.getElementById("calculateSqft").addEventListener("click", calculateSqftPrice);
    document.getElementById("saveSettings").addEventListener("click", saveSettings);
    document.getElementById("saveMaterial").addEventListener("click", saveMaterial);
    document.getElementById("clearMaterialForm").addEventListener("click", clearMaterialForm);
    document.getElementById("saveLamination").addEventListener("click", saveLamination);
    document.getElementById("clearLaminationForm").addEventListener("click", clearLaminationForm);
    document.getElementById("openSettings").addEventListener("click", () => openTab("settings-tab"));
    document.getElementById("backToCalculator").addEventListener("click", () => openTab("sqft-tab"));
    document.getElementById("addMarkupPreset").addEventListener("click", () => addMarkupPresetRow());
    document.querySelectorAll(".collapse-toggle").forEach((button) => {
        button.addEventListener("click", () => toggleCollapsePanel(button));
    });
});
