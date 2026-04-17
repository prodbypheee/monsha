// ========================================
// INIZIALIZZAZIONE EMAILJS E DOM
// ========================================

// Inizializza EmailJS solo dopo che il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    // Inizializza EmailJS
    try {
        emailjs.init("gYs-un27FZbB_6GZc");
        console.log("EmailJS inizializzato correttamente");
    } catch (error) {
        console.error("Errore nell'inizializzazione di EmailJS:", error);
    }

    // Se siamo nella tab "home", scrolla dopo 2 secondi
    if (document.getElementById('home').classList.contains('active')) {
        setTimeout(() => {
            window.scrollBy({
                top: window.innerHeight * 0.9,
                behavior: 'smooth'
            });
        }, 2000);
    }

    // Inizializza gli event listeners per i form
    initializeFormListeners();
});

// ========================================
// VARIABILI GLOBALI
// ========================================

let selectedRoles = [];
const maxSelections = 2;
let selectedPlatform = '';
let selectedCompetitionsData = [];
let isDropdownOpen = false;
let previousClubs = [];
let selectedDays = [];

// ========================================
// GESTIONE TAB
// ========================================

function showTab(tabName) {
    // Nascondi tutte le tab
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Mostra la tab selezionata
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Aggiorna nav links desktop
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-link').forEach(link => link.classList.remove('active'));

    // Attiva il link corrispondente al tabName tramite onclick
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        const onclick = link.getAttribute('onclick') || '';
        if (onclick.includes("'" + tabName + "'") || onclick.includes('"' + tabName + '"')) {
            link.classList.add('active');
        }
    });

    // Scrolla in cima alla pagina
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// GESTIONE PIATTAFORMA
// ========================================

function handlePlatformChange() {
    const platformSelect = document.getElementById('platformSelect');
    const playerIdGroup = document.getElementById('playerIdGroup');
    const playerIdInput = document.getElementById('playerId');
    const playerIdHint = document.getElementById('playerIdHint');
    
    if (!platformSelect || !playerIdGroup || !playerIdInput || !playerIdHint) {
        console.error("Elementi del form piattaforma non trovati");
        return;
    }
    
    selectedPlatform = platformSelect.value;
    
    if (selectedPlatform) {
        // Mostra l'input ID player con animazione
        playerIdGroup.classList.add('show');
        
        // Imposta placeholder e hint specifici per piattaforma
        switch (selectedPlatform) {
            case 'playstation':
                playerIdInput.placeholder = 'Es: MonacoShaolin23';
                playerIdHint.textContent = 'Il tuo PSN ID (PlayStation Network)';
                break;
            case 'xbox':
                playerIdInput.placeholder = 'Es: MonacoShaolin23';
                playerIdHint.textContent = 'Il tuo Xbox Gamertag';
                break;
            case 'pc':
                playerIdInput.placeholder = 'Es: MonacoShaolin23';
                playerIdHint.textContent = 'Il tuo ID Origin/Steam/Epic Games';
                break;
        }
        
        // Focus sull'input con un piccolo delay
        setTimeout(() => {
            playerIdInput.focus();
        }, 300);
    } else {
        // Nascondi l'input ID player
        playerIdGroup.classList.remove('show');
        playerIdInput.value = '';
    }
}

// ========================================
// GESTIONE RUOLI
// ========================================

function openRolePopup() {
    const popup = document.getElementById('rolePopup');
    if (popup) {
        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeRolePopup() {
    const popup = document.getElementById('rolePopup');
    if (popup) {
        popup.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    // NON resettare le selezioni quando si chiude il popup
    // Le selezioni dovrebbero essere mantenute dopo la conferma
    console.log('Popup closed. Current selectedRoles:', selectedRoles);
}

function selectPosition(element) {
    if (!element) return;
    
    const role = element.getAttribute('data-role');
    const name = element.getAttribute('data-name');
    
    if (!role || !name) return;
    
    const isSelected = element.classList.contains('selected');
    
    console.log(`Selecting position: ${name}, currently selected: ${isSelected}`);
    
    if (isSelected) {
        // Deseleziona
        element.classList.remove('selected');
        selectedRoles = selectedRoles.filter(r => r.name !== name);
        console.log(`Deselected ${name}. Current roles:`, selectedRoles);
    } else {
        // Controlla il limite di 2 ruoli
        if (selectedRoles.length >= maxSelections) {
            alert('Puoi selezionare massimo 2 ruoli!');
            return;
        }
        
        // Seleziona
        element.classList.add('selected');
        selectedRoles.push({ role, name });
        console.log(`Selected ${name}. Current roles:`, selectedRoles);
    }
    
    updateSelectionDisplay();
}

function updateSelectionDisplay() {
    const selectionCount = document.getElementById('selectionCount');
    const selectedPositions = document.getElementById('selectedPositions');
    const confirmBtn = document.getElementById('confirmBtn');
    
    if (selectionCount) {
        selectionCount.textContent = selectedRoles.length;
    }
    
    if (selectedPositions) {
        selectedPositions.innerHTML = selectedRoles
            .map(r => `<span class="selected-role-tag">${r.name}</span>`)
            .join('');
    }
    
    if (confirmBtn) {
        confirmBtn.disabled = selectedRoles.length === 0;
    }
}

function confirmSelection() {
    console.log('Confirming selection. Current selectedRoles:', selectedRoles);
    
    if (selectedRoles.length === 0) {
        alert('Seleziona almeno un ruolo prima di confermare!');
        return;
    }
    
    updateRoleSelectionWidget();
    closeRolePopup();
    
    // Verifica che i ruoli siano stati salvati correttamente
    console.log('Roles confirmed and saved:', selectedRoles);
}

function updateRoleSelectionWidget() {
    const roleSelectionContent = document.getElementById('roleSelectionContent');
    const selectedRolesInWidget = document.getElementById('selectedRolesInWidget');
    const selectedRolesWidgetList = document.getElementById('selectedRolesWidgetList');
    const roleSelection = document.querySelector('.role-selection');
    
    if (!roleSelectionContent || !selectedRolesInWidget || !roleSelection) return;
    
    if (selectedRoles.length > 0) {
        roleSelectionContent.style.display = 'none';
        selectedRolesInWidget.style.display = 'block';
        roleSelection.classList.add('has-selection');
        
        if (selectedRolesWidgetList) {
            selectedRolesWidgetList.innerHTML = selectedRoles
                .map(r => `<span class="role-badge-widget">${r.name}</span>`)
                .join('');
        }
    } else {
        roleSelectionContent.style.display = 'block';
        selectedRolesInWidget.style.display = 'none';
        roleSelection.classList.remove('has-selection');
    }
}

// ========================================
// GESTIONE COMPETIZIONI
// ========================================

function toggleCompetitionsDropdown() {
    const dropdownContent = document.getElementById('competitionsDropdownContent');
    const dropdownHeader = document.querySelector('.dropdown-header');
    
    if (!dropdownContent || !dropdownHeader) return;
    
    isDropdownOpen = !isDropdownOpen;
    
    if (isDropdownOpen) {
        dropdownContent.classList.add('open');
        dropdownHeader.classList.add('open');
    } else {
        dropdownContent.classList.remove('open');
        dropdownHeader.classList.remove('open');
    }
}

function toggleCompetitionDivisions(competitionId) {
    console.log('Toggling:', competitionId); // Debug
    
    const targetDivision = document.getElementById(`${competitionId}-divisions`);
    const targetArrow = document.getElementById(`${competitionId}-arrow`);
    
    if (!targetDivision || !targetArrow) return;
    
    // Controlla se quella selezionata è già aperta
    const isAlreadyOpen = targetDivision.classList.contains('expanded');
    
    // Prima chiudi TUTTE le competizioni
    const allDivisions = document.querySelectorAll('.divisions-list');
    const allArrows = document.querySelectorAll('.expand-arrow');
    
    allDivisions.forEach(div => div.classList.remove('expanded'));
    allArrows.forEach(arr => arr.classList.remove('expanded'));
    
    // Se non era già aperta, aprila
    if (!isAlreadyOpen) {
        targetDivision.classList.add('expanded');
        targetArrow.classList.add('expanded');
        console.log('Opened:', competitionId); // Debug
    } else {
        console.log('Closed:', competitionId); // Debug
    }
}

function handleDivisionSelection(competitionName, division, radioElement) {
    if (!radioElement || !radioElement.checked) return;
    
    // Rimuovi eventuali selezioni precedenti della stessa competizione
    selectedCompetitionsData = selectedCompetitionsData.filter(
        item => item.competition !== competitionName
    );
    
    // Aggiungi la nuova selezione
    selectedCompetitionsData.push({
        competition: competitionName,
        division: division
    });
    
    updateSelectedCompetitionsDisplay();
    updateDropdownHeaderText();
}

function updateDropdownHeaderText() {
    const headerText = document.getElementById('selectedCompetitionsText');
    if (!headerText) return;
    
    if (selectedCompetitionsData.length === 0) {
        headerText.textContent = 'Seleziona le tue competizioni...';
    } else if (selectedCompetitionsData.length === 1) {
        const item = selectedCompetitionsData[0];
        headerText.textContent = `${item.competition} - ${item.division}`;
    } else {
        headerText.textContent = `${selectedCompetitionsData.length} competizioni selezionate`;
    }
}

function updateSelectedCompetitionsDisplay() {
    const selectedArea = document.getElementById('selectedCompetitionsArea');
    const selectedList = document.getElementById('selectedCompetitionsList');
    
    if (!selectedArea || !selectedList) return;
    
    if (selectedCompetitionsData.length === 0) {
        selectedArea.style.display = 'none';
        return;
    }
    
    selectedArea.style.display = 'block';
    selectedList.innerHTML = '';
    
    selectedCompetitionsData.forEach((item, index) => {
        const selectedItem = document.createElement('div');
        selectedItem.className = 'selected-item';
        selectedItem.innerHTML = `
            <span>${item.competition} - ${item.division}</span>
            <button class="remove-selected" onclick="removeSelectedCompetition(${index})" title="Rimuovi">×</button>
        `;
        selectedList.appendChild(selectedItem);
    });
}

function removeSelectedCompetition(index) {
    if (index < 0 || index >= selectedCompetitionsData.length) return;
    
    const removedItem = selectedCompetitionsData[index];
    
    // Rimuovi dall'array
    selectedCompetitionsData.splice(index, 1);
    
    // Deseleziona il radio button corrispondente
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        if (radio.parentElement && radio.parentElement.textContent.trim() === removedItem.division) {
            const competitionGroup = radio.closest('.competition-group');
            if (competitionGroup) {
                const competitionHeader = competitionGroup.querySelector('.competition-name');
                if (competitionHeader && competitionHeader.textContent === removedItem.competition) {
                    radio.checked = false;
                }
            }
        }
    });
    
    updateSelectedCompetitionsDisplay();
    updateDropdownHeaderText();
}

// ========================================
// GESTIONE CLUB
// ========================================

function handleClubKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addClubFromInput();
    }
}

function addClubFromInput() {
    const input = document.getElementById('clubsInput');
    if (!input) return;
    
    const clubName = input.value.trim();
    
    // Rimuovi eventuali messaggi di errore precedenti
    clearClubInputError();
    
    // Validazione input
    if (!clubName) {
        showClubInputError('⚠️ Inserisci il nome di un club!');
        return;
    }
    
    if (clubName.length < 2) {
        showClubInputError('⚠️ Il nome del club deve avere almeno 2 caratteri!');
        return;
    }
    
    if (clubName.length > 50) {
        showClubInputError('⚠️ Il nome del club è troppo lungo (max 50 caratteri)!');
        return;
    }
    
    // Controlla se il club esiste già
    const clubExists = previousClubs.some(club => 
        club.toLowerCase() === clubName.toLowerCase()
    );
    
    if (clubExists) {
        showClubInputError('⚠️ Questo club è già stato aggiunto!');
        return;
    }
    
    // Limita il numero massimo di club
    if (previousClubs.length >= 10) {
        showClubInputError('⚠️ Puoi aggiungere massimo 10 club!');
        return;
    }
    
    // Aggiungi il club alla lista
    previousClubs.push(clubName);
    input.value = '';
    updateClubsDisplay();
    showClubSuccessAnimation();
}

function showClubInputError(message) {
    const input = document.getElementById('clubsInput');
    if (!input) return;
    
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;
    
    input.classList.add('error');
    wrapper.classList.add('error');
    
    // Rimuovi messaggio di errore esistente
    const existingError = wrapper.parentElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Aggiungi nuovo messaggio di errore
    const errorElement = document.createElement('small');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    wrapper.parentElement.appendChild(errorElement);
    
    // Rimuovi l'errore dopo 3 secondi
    setTimeout(() => {
        clearClubInputError();
    }, 3000);
}

function clearClubInputError() {
    const input = document.getElementById('clubsInput');
    if (!input) return;
    
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;
    
    const errorMessage = wrapper.parentElement.querySelector('.error-message');
    
    input.classList.remove('error');
    wrapper.classList.remove('error');
    
    if (errorMessage) {
        errorMessage.remove();
    }
}

function showClubSuccessAnimation() {
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    
    wrapper.style.borderColor = '#27ae60';
    wrapper.style.boxShadow = '0 0 0 4px rgba(39, 174, 96, 0.3)';
    
    setTimeout(() => {
        wrapper.style.borderColor = '#fea500';
        wrapper.style.boxShadow = '0 3px 12px rgba(254, 165, 0, 0.2)';
    }, 500);
}

function updateClubsDisplay() {
    const clubsList = document.getElementById('addedClubsList');
    const clubsContainer = document.getElementById('clubsTagsContainer');
    
    if (!clubsList || !clubsContainer) return;
    
    if (previousClubs.length === 0) {
        clubsList.style.display = 'none';
        return;
    }
    
    clubsList.style.display = 'block';
    clubsContainer.innerHTML = '';
    
    previousClubs.forEach((clubName, index) => {
        const clubTag = document.createElement('div');
        clubTag.className = 'club-tag';
        clubTag.innerHTML = `
            <span class="club-name">${clubName}</span>
            <button class="remove-club-btn" onclick="removeClub(${index})" title="Rimuovi ${clubName}">×</button>
        `;
        clubsContainer.appendChild(clubTag);
    });
}

function removeClub(index) {
    if (index < 0 || index >= previousClubs.length) return;
    
    const clubTags = document.querySelectorAll('.club-tag');
    const clubTag = clubTags[index];
    
    if (clubTag) {
        clubTag.classList.add('removing');
        
        setTimeout(() => {
            previousClubs.splice(index, 1);
            updateClubsDisplay();
        }, 400);
    }
}

// ========================================
// GESTIONE CALENDARIO
// ========================================

function toggleDay(day) {
    const dayContainer = document.querySelector(`#${day}-check`);
    if (!dayContainer) return;
    
    const container = dayContainer.parentElement;
    const checkbox = document.getElementById(`${day}-check`);
    
    if (!container || !checkbox) return;
    
    if (selectedDays.includes(day)) {
        selectedDays = selectedDays.filter(d => d !== day);
        container.classList.remove('selected');
        checkbox.innerHTML = '☐';
    } else {
        selectedDays.push(day);
        container.classList.add('selected');
        checkbox.innerHTML = '☑';
    }
    
    updateAvailabilitySummary();
}

function updateAvailabilitySummary() {
    const summary = document.getElementById('availabilitySummary');
    const daysList = document.getElementById('selectedDaysList');
    
    if (!summary) return;
    
    if (selectedDays.length > 0) {
        const dayNames = {
            'monday': 'Lunedì',
            'tuesday': 'Martedì',
            'wednesday': 'Mercoledì',
            'thursday': 'Giovedì'
        };
        
        const selectedDayNames = selectedDays.map(day => dayNames[day] || day);
        if (daysList) {
            daysList.innerHTML = selectedDayNames.join(', ');
        }
        summary.classList.add('show');
    } else {
        summary.classList.remove('show');
    }
}

// ========================================
// GESTIONE TELEFONO
// ========================================

function formatPhoneNumber(input) {
    if (!input) return;
    
    let value = input.value.replace(/\D/g, '');
    if (value.startsWith('39')) {
        value = '+' + value;
    } else if (value.length > 0 && !value.startsWith('+')) {
        value = '+39' + value;
    }
    
    // Formatta con spazi per leggibilità
    if (value.length > 3) {
        value = value.slice(0, 3) + ' ' + value.slice(3);
    }
    if (value.length > 7) {
        value = value.slice(0, 7) + ' ' + value.slice(7);
    }
    if (value.length > 11) {
        value = value.slice(0, 11) + ' ' + value.slice(11);
    }
    
    input.value = value;
}

// ========================================
// GESTIONE FORM E SUBMIT
// ========================================

function collectFormData() {
    const platform = document.getElementById('platformSelect')?.value || '';
    const playerId = document.getElementById('playerId')?.value || '';
    const phone = document.getElementById('phoneInput')?.value || '';
    const additionalInfo = document.getElementById('additionalInfo')?.value || '';
    
    // Debug: verifica i ruoli selezionati
    console.log('selectedRoles array:', selectedRoles);
    console.log('selectedRoles length:', selectedRoles.length);
    
    const roles = selectedRoles.map(role => role.name || role);
    const competitions = selectedCompetitionsData.map(comp => 
        `${comp.competition} - ${comp.division}`
    );
    const clubs = [...previousClubs];
    
    const dayNames = {
        'monday': 'Lunedì',
        'tuesday': 'Martedì',
        'wednesday': 'Mercoledì',
        'thursday': 'Giovedì'
    };
    const availableDays = selectedDays.map(day => dayNames[day] || day);
    
    const formData = {
        platform,
        playerId,
        selectedRoles: roles,
        selectedCompetitions: competitions,
        clubs,
        availableDays,
        phone,
        additionalInfo
    };
    
    // Debug: verifica i dati raccolti
    console.log('Form data collected:', formData);
    
    return formData;
}

function validateForm(data) {
    const errors = [];
    
    console.log('Validating form data:', data);
    console.log('Selected roles for validation:', data.selectedRoles);
    console.log('Selected roles length:', data.selectedRoles ? data.selectedRoles.length : 'undefined');
    
    if (!data.platform) errors.push("Seleziona una piattaforma");
    if (!data.playerId) errors.push("Inserisci il tuo ID Player");
    
    // Validazione ruoli più robusta
    if (!data.selectedRoles || !Array.isArray(data.selectedRoles) || data.selectedRoles.length === 0) {
        errors.push("Seleziona almeno un ruolo");
        console.log('Ruoli non validi:', data.selectedRoles);
    }
    
    if (!data.availableDays || !Array.isArray(data.availableDays) || data.availableDays.length === 0) {
        errors.push("Seleziona almeno un giorno disponibile");
        console.log('Giorni non validi:', data.availableDays);
    }
    
    console.log('Validation errors:', errors);
    return errors;
}

async function submitForm() {
    const submitBtn = document.querySelector('.submit-btn');
    const submitLoader = document.getElementById('submitLoader');
    const submitMessage = document.getElementById('submitMessage');
    const submitIcon = document.querySelector('.submit-icon');
    const submitText = document.querySelector('.submit-text');
    
    if (!submitBtn || !submitLoader || !submitIcon || !submitText) {
        console.error("Elementi del form submit non trovati");
        return;
    }
    
    const formData = collectFormData();
    const errors = validateForm(formData);
    
    if (errors.length > 0) {
        showMessage('❌ Completa tutti i campi obbligatori:\n' + errors.join('\n'), 'error');
        return;
    }
    
    // Stato di caricamento
    submitBtn.disabled = true;
    submitIcon.style.display = 'none';
    submitLoader.style.display = 'block';
    submitText.textContent = 'INVIO IN CORSO...';
    
    try {
        // Parametri per EmailJS
        const templateParams = {
            from_email: 'candidatura@monacishaolin.com',
            platform: formData.platform || 'Non specificata',
            player_id: formData.playerId || 'Non specificato',
            selected_roles: formData.selectedRoles.length > 0 ? 
                formData.selectedRoles.map(role => `- ${role}`).join('\n') : 
                'Nessun ruolo selezionato',
            selected_competitions: formData.selectedCompetitions.length > 0 ? 
                formData.selectedCompetitions.map(comp => `- ${comp}`).join('\n') : 
                'Nessuna competizione specificata',
            clubs: formData.clubs.length > 0 ? 
                formData.clubs.map(club => `- ${club}`).join('\n') : 
                'Nessun club specificato',
            available_days: formData.availableDays.length > 0 ? 
                formData.availableDays.map(day => `- ${day}`).join('\n') : 
                'Nessun giorno selezionato',
            phone: formData.phone || 'Non specificato',
            additional_info: formData.additionalInfo || 'Nessuna informazione aggiuntiva'
        };
        
        // Invia l'email tramite EmailJS
        const response = await emailjs.send(
            'Angelica70',
            'template_atxhyt9',
            templateParams
        );
        
        console.log('Email inviata con successo:', response);
        
        setTimeout(() => {
            showMessage('✅ Candidatura inviata con successo! Ti contatteremo presto.', 'success');
            resetSubmitButton();
        }, 1000);
        
    } catch (error) {
        console.error('Errore nell\'invio email:', error);
        showMessage('❌ Errore nell\'invio. Riprova tra qualche minuto.', 'error');
        resetSubmitButton();
    }
}

// Aggiungi una nuova funzione per resettare solo quando necessario
function cancelRoleSelection() {
    // Reset selezioni quando si annulla
    const positions = document.querySelectorAll('.player-position');
    positions.forEach(pos => pos.classList.remove('selected'));
    
    // Ripristina lo stato precedente dei ruoli selezionati
    selectedRoles.forEach(role => {
        const position = document.querySelector(`[data-name="${role.name}"]`);
        if (position) {
            position.classList.add('selected');
        }
    });
    
    updateSelectionDisplay();
    closeRolePopup();
}

function showMessage(message, type) {
    const submitMessage = document.getElementById('submitMessage');
    if (!submitMessage) return;
    
    submitMessage.textContent = message;
    submitMessage.className = `submit-message ${type}`;
    submitMessage.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            submitMessage.style.display = 'none';
        }, 5000);
    }
}

function resetSubmitButton() {
    const submitBtn = document.querySelector('.submit-btn');
    const submitLoader = document.getElementById('submitLoader');
    const submitIcon = document.querySelector('.submit-icon');
    const submitText = document.querySelector('.submit-text');
    
    if (submitBtn) submitBtn.disabled = false;
    if (submitIcon) submitIcon.style.display = 'inline';
    if (submitLoader) submitLoader.style.display = 'none';
    if (submitText) submitText.textContent = 'INVIA CANDIDATURA';
}

// ========================================
// INIZIALIZZAZIONE EVENT LISTENERS
// ========================================

function initializeFormListeners() {
    // Event listener per il player ID input
    const playerIdInput = document.getElementById('playerId');
    if (playerIdInput) {
        playerIdInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^a-zA-Z0-9_-]/g, '');
            if (this.value.length > 20) {
                this.value = this.value.substring(0, 20);
            }
        });
    }
    
    // Event listener per il telefono
    const phoneInput = document.getElementById('phoneInput');
    if (phoneInput) {
        phoneInput.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
    }
    
    // Event listener per chiusure popup
    const rolePopup = document.getElementById('rolePopup');
    if (rolePopup) {
        rolePopup.addEventListener('click', function(e) {
            if (e.target === this) {
                closeRolePopup();
            }
        });
    }
    
    const popupContent = document.querySelector('.popup-content');
    if (popupContent) {
        popupContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Event listener per chiudere dropdown competizioni
    document.addEventListener('click', function(event) {
        const dropdownWrapper = document.querySelector('.dropdown-wrapper');
        
        if (dropdownWrapper && !dropdownWrapper.contains(event.target)) {
            const dropdownContent = document.getElementById('competitionsDropdownContent');
            const dropdownHeader = document.querySelector('.dropdown-header');
            
            if (dropdownContent && dropdownHeader) {
                dropdownContent.classList.remove('open');
                dropdownHeader.classList.remove('open');
                isDropdownOpen = false;
            }
        }
    });
    
    // Previeni chiusura dropdown quando si clicca all'interno
    const dropdownContent = document.getElementById('competitionsDropdownContent');
    if (dropdownContent) {
        dropdownContent.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    }
}
document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('.section');
    const sectionHeaders = document.querySelectorAll('.section-header');

    function closeAllSections() {
        sections.forEach(section => {
            section.classList.remove('active');
            const content = section.querySelector('.section-content');
            content.style.maxHeight = '0px';
        });
    }

    function openSection(targetSection) {
        targetSection.classList.add('active');
        const content = targetSection.querySelector('.section-content');
        content.style.maxHeight = content.scrollHeight + 'px';
        
        // Smooth scroll to section
        setTimeout(() => {
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        }, 300);
    }

    sectionHeaders.forEach((header, index) => {
        header.addEventListener('click', function(e) {
            e.preventDefault();
            const parentSection = this.parentElement;
            const isCurrentlyActive = parentSection.classList.contains('active');

            closeAllSections();

            if (!isCurrentlyActive) {
                setTimeout(() => {
                    openSection(parentSection);
                }, 100);
            }
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllSections();
        }
        
        // Navigazione con frecce
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const activeSection = document.querySelector('.section.active');
            if (!activeSection) return;
            
            const allSections = Array.from(sections);
            const currentIndex = allSections.indexOf(activeSection);
            let nextIndex;
            
            if (e.key === 'ArrowDown') {
                nextIndex = (currentIndex + 1) % allSections.length;
            } else {
                nextIndex = currentIndex === 0 ? allSections.length - 1 : currentIndex - 1;
            }
            
            closeAllSections();
            setTimeout(() => {
                openSection(allSections[nextIndex]);
            }, 100);
        }
    });

    // Preload delle immagini per performance migliori
    const imageUrls = [
        './ig/gruppo-portieri.jpeg',
        './ig/gruppo-difensori.jpeg',
        './ig/gruppo-centrocampisti.jpeg',
        './ig/gruppo-attaccanti.jpeg',
        './ig/gruppo-staff.jpeg'
    ];

    imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
    });
});

// ========================================
// MOBILE MENU
// ========================================

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
    document.getElementById('navHamburger').classList.toggle('open');
    document.body.classList.toggle('menu-open');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.remove('open');
    document.getElementById('navHamburger').classList.remove('open');
    document.body.classList.remove('menu-open');
}

// ========================================
// SCROLL REVEAL
// ========================================

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ========================================
// PREMIUM UPGRADE: scroll progress, back-to-top,
// stat counters, hero parallax, player card tilt
// ========================================

// Scroll progress bar + back-to-top
(function(){
    const bar = document.getElementById('scrollProgress');
    const btn = document.getElementById('backToTop');
    function onScroll(){
        const h = document.documentElement;
        const scrolled = h.scrollTop;
        const max = (h.scrollHeight - h.clientHeight) || 1;
        const pct = (scrolled / max) * 100;
        if (bar) bar.style.width = pct + '%';
        if (btn) btn.classList.toggle('visible', scrolled > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();

// Animated stat counters
(function(){
    const stats = document.querySelectorAll('.stat-number');
    if (!stats.length) return;
    const animate = (el) => {
        const raw = (el.textContent || '').trim();
        const match = raw.match(/^(\d+)(\+|)$/);
        if (!match) return; // leave symbols like ∞
        const target = parseInt(match[1], 10);
        const suffix = match[2] || '';
        const duration = 1400;
        const start = performance.now();
        function step(now){
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.floor(target * eased) + suffix;
            if (t < 1) requestAnimationFrame(step);
            else el.textContent = target + suffix;
        }
        requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                entry.target.dataset.counted = '1';
                animate(entry.target);
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    stats.forEach(s => io.observe(s));
})();

// Subtle hero parallax (mouse move)
(function(){
    const hero = document.querySelector('.hero-section');
    const text = document.querySelector('.hero-text');
    if (!hero || !text) return;
    let raf;
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            text.style.transform = `translate3d(${x * -8}px, ${y * -8}px, 0)`;
        });
    });
    hero.addEventListener('mouseleave', () => {
        if (text) text.style.transform = '';
    });
})();

// FIFA-style 3D tilt on player & trophy cards
(function(){
    const cards = document.querySelectorAll('.player-card, .trophy-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform =
                `perspective(800px) rotateX(${y * -6}deg) rotateY(${x * 8}deg) translateY(-6px) scale(1.02)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
})();