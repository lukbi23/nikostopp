// Warten, bis das HTML vollständig geladen ist
document.addEventListener('DOMContentLoaded', () => {
    const onboardingForm = document.getElementById('onboardingForm');
    const onboardingCard = document.getElementById('onboardingCard');

    // Prüfen, ob bereits gespeicherte Daten im Browser vorliegen
    const savedData = localStorage.getItem('nikotinstopp_user_data');
    if (savedData) {
        showSuccessMessage(JSON.parse(savedData));
    }

    // Event-Listener für das Absenden des Formulars
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Verhindert, dass die Seite beim Absenden neu lädt

            // 1. Daten aus den Formularfeldern auslesen
            const userData = {
                nikotinForm: document.getElementById('nikotinForm').value,
                tagesMenge: parseInt(document.getElementById('tagesMenge').value, 10),
                tagesKosten: parseFloat(document.getElementById('tagesKosten').value),
                stichtag: document.getElementById('stichtag').value,
                gruende: document.getElementById('gruende').value,
                erstelltAm: new Date().toISOString()
            };

            // 2. Objekt in ein Textformat (JSON) umwandeln und im Browser speichern
            localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));

            // 3. Bestätigungsansicht anzeigen
            showSuccessMessage(userData);
        });
    }

    // Funktion zur Anzeige der gespeicherten Daten
    function showSuccessMessage(data) {
        onboardingCard.innerHTML = `
            <h2>Willkommen bei deinem Ausstieg!</h2>
            <p>Deine Daten wurden erfolgreich lokal gespeichert:</p>
            <ul>
                <li><strong>Nikotinform:</strong> ${escapeHtml(data.nikotinForm)}</li>
                <li><strong>Konsum pro Tag:</strong> ${data.tagesMenge}</li>
                <li><strong>Kosten pro Tag:</strong> ${data.tagesKosten.toFixed(2)} CHF</li>
                <li><strong>Stichtag:</strong> ${data.stichtag}</li>
                <li><strong>Gründe:</strong> ${escapeHtml(data.gruende)}</li>
            </ul>
            <p><em>Deine Einstellungen sind gesichert.</em></p>
        `;
    }

    // Hilfsfunktion zum Schutz vor unerwünschtem Code (HTML-Escaping)
    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (match) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return map[match];
        });
    }
});