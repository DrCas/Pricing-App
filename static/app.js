let materials = {};
let laminations = {};
let appSettings = {
    laminate_addon_per_sqft: 13,
    cut_addon_per_sqft: 8.5
};

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
    const numberInputs = document.querySelectorAll(".scroll-number");

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

    document.getElementById("settingsLaminateRate").value = appSettings.laminate_addon_per_sqft;
    document.getElementById("settingsCutRate").value = appSettings.cut_addon_per_sqft;
}

async function saveSettings() {
    const status = document.getElementById("settingsStatus");
    status.classList.remove("error");
    status.textContent = "";

    const payload = {
        laminate_addon_per_sqft: getNumber("settingsLaminateRate"),
        cut_addon_per_sqft: getNumber("settingsCutRate")
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

function renderLaminationSelect(selectedName = "") {
    const select = document.getElementById("laminationSelect");
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

function setupMarkupDropdown() {
    const markupButton = document.getElementById("markupButton");
    const markupDropdown = document.getElementById("markupDropdown");
    const customWrap = document.getElementById("customMarkupWrap");
    
    const markupOptions = [
        { value: "2", label: "Conservative / 2x" },
        { value: "3", label: "Standard / 3x" },
        { value: "custom", label: "Custom" }
    ];
    
    let currentValue = "3";
    
    function renderDropdown() {
        markupDropdown.innerHTML = "";
        markupOptions.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `markup-option ${option.value === currentValue ? "active" : ""}`;
            button.textContent = option.label;
            
            button.addEventListener("click", () => selectMarkup(option.value, option.label));
            markupDropdown.appendChild(button);
        });
    }
    
    function selectMarkup(value, label) {
        currentValue = value;
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
    
    renderDropdown();
    
    window.getMarkupValue = () => currentValue;
}

function setupMarkupToggle() {
    setupMarkupDropdown();
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

    const baseSellPerSqft = costPerSqft * markup;
    const laminateAddon = isLaminated ? Number(appSettings.laminate_addon_per_sqft) : 0;
    const cutAddon = isCut ? Number(appSettings.cut_addon_per_sqft) : 0;
    const finalSellPerSqft = baseSellPerSqft + laminateAddon + cutAddon;

    const billableWidth = isCut ? jobWidthFeet + 1 : jobWidthFeet;
    const billableHeight = isCut ? jobHeightFeet + 1 : jobHeightFeet;
    const billableSqft = billableWidth * billableHeight;

    const finalTotal = billableSqft * finalSellPerSqft + extraFees;

    setText("rollSqftResult", `${rollSqft.toFixed(2)} sqft`);
    setText("costPerSqftResult", formatMoney(costPerSqft));
    setText("baseSellPerSqftResult", formatMoney(baseSellPerSqft));
    setText("laminateAddonResult", formatMoney(laminateAddon));
    setText("cutAddonResult", formatMoney(cutAddon));
    setText("sellPerSqftResult", formatMoney(finalSellPerSqft));
    setText("billableSizeResult", `${billableWidth.toFixed(2)} ft × ${billableHeight.toFixed(2)} ft`);
    setText("billableSqftResult", `${billableSqft.toFixed(2)} sqft`);
    setText("sqftTotalResult", formatMoney(finalTotal));
}

document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    setupMarkupToggle();
    setupMaterialSearch();
    setupScrollWheelNumbers();

    await loadSettings();
    await loadMaterials();
    await loadLaminations();

    document.getElementById("calculateSqft").addEventListener("click", calculateSqftPrice);
    document.getElementById("saveSettings").addEventListener("click", saveSettings);
    document.getElementById("saveMaterial").addEventListener("click", saveMaterial);
    document.getElementById("clearMaterialForm").addEventListener("click", clearMaterialForm);
    document.getElementById("saveLamination").addEventListener("click", saveLamination);
    document.getElementById("clearLaminationForm").addEventListener("click", clearLaminationForm);
    document.getElementById("jobOptionSelect").addEventListener("change", toggleLaminationOptions);
    document.getElementById("laminationSelect").addEventListener("change", (event) => updateLaminationDetails(event.target.value));
    document.getElementById("openSettings").addEventListener("click", () => openTab("settings-tab"));
    document.getElementById("backToCalculator").addEventListener("click", () => openTab("sqft-tab"));
    document.querySelectorAll(".collapse-toggle").forEach((button) => {
        button.addEventListener("click", () => toggleCollapsePanel(button));
    });
});
