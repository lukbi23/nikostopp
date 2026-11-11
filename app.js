document.addEventListener('DOMContentLoaded', () => {
    const onboardingForm = document.getElementById('onboardingForm');
    const onboardingCard = document.getElementById('onboardingCard');
    const dashboardCard = document.getElementById('dashboardCard');
    const sosOverlay = document.getElementById('sosOverlay');
    const sosModalContent = document.getElementById('sosModalContent');
    const triggerOverlay = document.getElementById('triggerOverlay');
    const triggerForm = document.getElementById('triggerForm');
    const btnCancelTrigger = document.getElementById('btnCancelTrigger');
    const relapseOverlay = document.getElementById('relapseOverlay');
    const relapseModalContent = document.getElementById('relapseModalContent');
    const helpOverlay = document.getElementById('helpOverlay');
    const btnCloseHelp = document.getElementById('btnCloseHelp');

    let timerInterval = null;

    // Gespeicherte Daten beim Laden prüfen
    const savedData = localStorage.getItem('nikotinstopp_user_data');
    if (savedData) {
        showDashboard(JSON.parse(savedData));
    }

    if (onboardingForm) {
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const userData = {
                nikotinForm: document.getElementById('nikotinForm').value,
                tagesMenge: parseInt(document.getElementById('tagesMenge').value, 10),
                tagesKosten: parseFloat(document.getElementById('tagesKosten').value),
                stichtag: document.getElementById('stichtag').value,
                gruende: document.getElementById('gruende').value,
                cravingsBewaeltigt: 0,
                checkIns: [],
                triggers: [],
                erstelltAm: new Date().toISOString()
            };

            localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));
            showDashboard(userData);
        });
    }

    // Hilfsfunktionen für dynamische Bezeichnungen (Snus vs. Zigaretten vs. Nikotin)
    function getNikotinName(nikotinForm) {
        if (nikotinForm === 'snus') return 'Snus';
        if (nikotinForm === 'zigaretten') return 'Zigaretten';
        return 'Nikotin';
    }

    function getUnkonsumiertLabel(nikotinForm) {
        if (nikotinForm === 'snus') return 'Unkonsumierte Portionen Snus';
        if (nikotinForm === 'zigaretten') return 'Unkonsumierte Zigaretten';
        return 'Unkonsumierte Einheiten';
    }

    // Hauptfunktion: Dashboard rendern
    function showDashboard(data) {
        onboardingCard.style.display = 'none';
        dashboardCard.style.display = 'block';

        if (data.cravingsBewaeltigt === undefined) data.cravingsBewaeltigt = 0;
        if (!data.checkIns) data.checkIns = [];
        if (!data.triggers) data.triggers = [];

        const heuteStr = new Date().toISOString().split('T')[0];
        const heute = new Date();
        heute.setHours(0, 0, 0, 0);

        const stichtagDate = new Date(data.stichtag);
        stichtagDate.setHours(0, 0, 0, 0);

        const diffTime = heute.getTime() - stichtagDate.getTime();
        let tageRauchfrei = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (tageRauchfrei < 0) tageRauchfrei = 0;

        const gespartesGeld = (tageRauchfrei * data.tagesKosten).toFixed(2);
        const eingesparteEinheiten = tageRauchfrei * data.tagesMenge;
        const phaseInfo = getPhaseInfo(tageRauchfrei);

        const heuteCheckIn = data.checkIns.find(c => c.datum === heuteStr);

        let checkInHTML = '';
        if (!heuteCheckIn) {
            checkInHTML = `
                <div class="checkin-card" id="checkinCard">
                    <div class="checkin-title">📅 Tages-Check-in für heute</div>
                    <p style="font-size: 14px; margin: 0 0 10px 0;">Wie läuft dein Ausstieg heute?</p>
                    <div class="checkin-buttons">
                        <button id="btnCheckinClean" class="btn-success">✅ Frei geblieben</button>
                        <button id="btnCheckinSlip" class="btn-warning">⚠️ Ausrutscher</button>
                    </div>
                </div>
            `;
        } else {
            const statusText = heuteCheckIn.status === 'clean' 
                ? '✅ Heute frei geblieben! Super gemacht.' 
                : '⚠️ Ausrutscher verbucht. Schwamm drüber – direkt weitermachen!';
            checkInHTML = `
                <div class="tip-box" style="margin-bottom: 20px; background: #e8f5e9; border-left-color: #2e7d32;">
                    <strong>Tages-Check-in erledigt:</strong> ${statusText}
                </div>
            `;
        }

        let triggersHTML = '';
        if (data.triggers.length === 0) {
            triggersHTML = '<p style="font-size: 13px; color: #777;">Noch keine Auslöser eingetragen.</p>';
        } else {
            const meisteTriggers = [...data.triggers].reverse().slice(0, 5);
            triggersHTML = meisteTriggers.map(t => `
                <div class="trigger-item">
                    <div class="trigger-header">
                        <span>${escapeHtml(t.kategorie)}</span>
                        <small style="color:#777; font-weight:normal;">${t.datum}</small>
                    </div>
                    <div>${escapeHtml(t.notiz)}</div>
                </div>
            `).join('');
        }

        const nikotinName = getNikotinName(data.nikotinForm);
        const unkonsumiertText = getUnkonsumiertLabel(data.nikotinForm);

        dashboardCard.innerHTML = `
            ${checkInHTML}

            <button id="sosBtn" class="btn-sos">⚡ Craving SOS – Ich habe Drang!</button>

            <h2>Dein Fortschritt</h2>
            <div class="grid">
                <div class="stat-box">
                    <div class="stat-number">${tageRauchfrei}</div>
                    <div class="stat-label">Tage ohne ${nikotinName}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${gespartesGeld} CHF</div>
                    <div class="stat-label">Gespartes Geld</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${eingesparteEinheiten}</div>
                    <div class="stat-label">${unkonsumiertText}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${data.cravingsBewaeltigt}</div>
                    <div class="stat-label">Bewältigte Cravings</div>
                </div>
            </div>

            <div>
                <span class="phase-badge">${escapeHtml(phaseInfo.title)}</span>
                <div class="tip-box">
                    <strong>Evidenz-Hinweis:</strong> ${escapeHtml(phaseInfo.tip)}
                </div>
            </div>

            <div style="margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 16px;">🔍 Trigger-Tagebuch</h3>
                    <button id="btnOpenTrigger" style="width: auto; padding: 6px 12px; font-size: 13px; background-color: #00897b;">+ Auslöser loggen</button>
                </div>
                ${triggersHTML}
            </div>

            <div style="margin-top: 20px;">
                <p><strong>Deine Motivation:</strong> "${escapeHtml(data.gruende)}"</p>
            </div>

            <button id="btnOpenHelp" class="btn-help">📞 Beratung & Hilfsangebote</button>
            <button id="resetBtn" class="btn-danger">Daten zurücksetzen</button>
        `;

        if (!heuteCheckIn) {
            document.getElementById('btnCheckinClean')?.addEventListener('click', () => {
                speichereCheckIn(data, heuteStr, 'clean');
            });
            document.getElementById('btnCheckinSlip')?.addEventListener('click', () => {
                starteRueckfallModus(data, heuteStr);
            });
        }

        document.getElementById('btnOpenTrigger').addEventListener('click', () => {
            triggerOverlay.style.display = 'flex';
        });

        document.getElementById('btnOpenHelp').addEventListener('click', () => {
            helpOverlay.style.display = 'flex';
        });

        document.getElementById('sosBtn').addEventListener('click', () => startSosFlow(data));
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Möchtest du deine Daten wirklich löschen und das Onboarding neu starten?')) {
                localStorage.removeItem('nikotinstopp_user_data');
                location.reload();
            }
        });
    }

    if (btnCloseHelp) {
        btnCloseHelp.addEventListener('click', () => {
            helpOverlay.style.display = 'none';
        });
    }

    // RÜCKFALL-MODUS LOGIK
    function starteRueckfallModus(data, datumStr) {
        relapseOverlay.style.display = 'flex';
        relapseModalContent.innerHTML = `
            <h3>🌱 Ein Ausrutscher ist kein Scheitern!</h3>
            <p style="font-size: 14px; text-align: left; line-height: 1.5;">
                Ein Ausrutscher bedeutet nicht, dass du wieder am Anfang stehst. Fast alle Menschen haben auf dem Weg zum dauerhaften Stopp Ausrutscher.
            </p>
            <blockquote style="font-style: italic; background: #fff3e0; padding: 10px; border-left: 4px solid #f57c00; font-size: 13px; text-align: left; margin: 10px 0;">
                Wichtig ist jetzt: Kein schlechtes Gewissen haben, sondern den Auslöser verstehen und sofort weitermachen!
            </blockquote>

            <div class="form-group" style="text-align: left; margin-top: 15px;">
                <label for="relapseTrigger">Was war der Auslöser?</label>
                <select id="relapseTrigger">
                    <option value="Stress / Ärger">Stress / Ärger</option>
                    <option value="Kaffee / Mahlzeit">Kaffee / Mahlzeit</option>
                    <option value="Geselligkeit / Alkohol">Geselligkeit / Alkohol</option>
                    <option value="Langeweile / Wartezeit">Langeweile / Wartezeit</option>
                    <option value="Gewohnheit / Ort">Gewohnheit / Ort</option>
                    <option value="Spontaner Drang">Spontaner Drang</option>
                </select>
            </div>

            <button id="btnFinishRelapse" style="background-color: #2e7d32; margin-top: 10px;">Ich mache sofort weiter!</button>
        `;

        document.getElementById('btnFinishRelapse').addEventListener('click', () => {
            const ausloeser = document.getElementById('relapseTrigger').value;

            data.triggers.push({
                kategorie: `Ausrutscher: ${ausloeser}`,
                notiz: 'Auslöser beim Ausrutscher erfasst.',
                datum: new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            });

            speichereCheckIn(data, datumStr, 'slip');
            relapseOverlay.style.display = 'none';
        });
    }

    if (triggerForm) {
        triggerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const savedData = localStorage.getItem('nikotinstopp_user_data');
            if (savedData) {
                const userData = JSON.parse(savedData);
                if (!userData.triggers) userData.triggers = [];

                const neuerTrigger = {
                    kategorie: document.getElementById('triggerKategorie').value,
                    notiz: document.getElementById('triggerNotiz').value,
                    datum: new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                };

                userData.triggers.push(neuerTrigger);
                localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));
                
                triggerForm.reset();
                triggerOverlay.style.display = 'none';
                showDashboard(userData);
            }
        });
    }

    if (btnCancelTrigger) {
        btnCancelTrigger.addEventListener('click', () => {
            triggerOverlay.style.display = 'none';
        });
    }

    function speichereCheckIn(data, datum, status) {
        data.checkIns.push({ datum: datum, status: status, zeitstempel: new Date().toISOString() });
        localStorage.setItem('nikotinstopp_user_data', JSON.stringify(data));
        showDashboard(data);
    }

    // CRAVING-SOS SCHRITT-FÜR-SCHRITT PROZESS
    function startSosFlow(userData) {
        sosOverlay.style.display = 'flex';
        renderSosStep1(userData);
    }

    function renderSosStep1(userData) {
        const nikotinName = getNikotinName(userData.nikotinForm);
        sosModalContent.innerHTML = `
            <h3>1. Impuls benennen</h3>
            <p>Sprich es gedanklich aus:</p>
            <blockquote style="font-style: italic; background: #f0f0f0; padding: 10px; border-radius: 6px;">
                "Ich spüre gerade den starken Drang zu ${nikotinName}."
            </blockquote>
            <p><strong>Körper-Check:</strong> Wo spürst du den Drang aktuell in deinem Körper? (z.B. Brust, Bauch, Hals). Beobachte das Gefühl einfach, ohne dagegen zu kämpfen.</p>
            <button id="sosNext1">Weiter: Die Welle beobachten</button>
            <button id="sosCancel" class="btn-secondary">Abbrechen</button>
        `;

        document.getElementById('sosNext1').addEventListener('click', () => renderSosStep2(userData));
        document.getElementById('sosCancel').addEventListener('click', closeSos);
    }

    function renderSosStep2(userData) {
        let timeLeft = 600;

        sosModalContent.innerHTML = `
            <h3>2. Die Welle reiten & 10-Min-Timer</h3>
            <p>Ein Craving ist wie eine Welle: Es steigt an, erreicht einen Gipfel und baut sich nach <strong>10 bis 20 Minuten</strong> von selbst ab.</p>
            <div id="timerDisplay" class="timer-display">10:00</div>
            <p><small>Atme tief ein und aus. Du musst nichts tun, nur abwarten.</small></p>
            <button id="sosNext2">Weiter zur Entscheidung</button>
            <button id="sosCancel" class="btn-secondary">Abbrechen</button>
        `;

        const timerDisplay = document.getElementById('timerDisplay');
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerDisplay.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerDisplay.textContent = "0:00";
            }
        }, 1000);

        document.getElementById('sosNext2').addEventListener('click', () => {
            clearInterval(timerInterval);
            renderSosStep3(userData);
        });
        document.getElementById('sosCancel').addEventListener('click', closeSos);
    }

    function renderSosStep3(userData) {
        sosModalContent.innerHTML = `
            <h3>3. Motivation & Entscheidung</h3>
            <p><strong>Erinnere dich an dein 'Warum':</strong></p>
            <blockquote style="font-style: italic; background: #e8f5e9; padding: 10px; border-radius: 6px; color: #1b5e20;">
                "${escapeHtml(userData.gruende)}"
            </blockquote>
            <p><strong>Schnelle Ablenkungs-Tipps:</strong></p>
            <ul style="text-align: left; font-size: 14px;">
                <li>Trinke ein grosses Glas kaltes Wasser.</li>
                <li>Mache 10 schnelle Kniebeugen oder gehe kurz an die frische Luft.</li>
                <li>Rufe eine Person an oder lenke deine Hände ab.</li>
            </ul>
            
            <p style="margin-top: 15px; font-weight: bold;">Wie ist es gelaufen?</p>
            <button id="sosSuccess" style="background-color: #2e7d32; margin-top: 5px;">✅ Welle überstanden!</button>
            <button id="sosRelapse" class="btn-warning" style="margin-top: 8px;">❌ Leider nachgegeben (Ausrutscher)</button>
        `;

        // Welle erfolgreich überstanden
        document.getElementById('sosSuccess').addEventListener('click', () => {
            userData.cravingsBewaeltigt = (userData.cravingsBewaeltigt || 0) + 1;
            localStorage.setItem('nikotinstopp_user_data', JSON.stringify(userData));
            closeSos();
            showDashboard(userData);
        });

        // Ausrutscher beim SOS
        document.getElementById('sosRelapse').addEventListener('click', () => {
            closeSos();
            const heuteStr = new Date().toISOString().split('T')[0];
            starteRueckfallModus(userData, heuteStr);
        });
    }

    function closeSos() {
        if (timerInterval) clearInterval(timerInterval);
        sosOverlay.style.display = 'none';
    }

    function getPhaseInfo(tage) {
        if (tage <= 3) {
            return {
                title: "Phase 1: Tag 1–3 (Akutphase)",
                tip: "Entzugssymptome erreichen ihren Höhepunkt um Tag 3 und klingen danach stetig ab. Denke daran: Einzelne Cravings dauern meist nur 10 bis 20 Minuten."
            };
        } else if (tage <= 14) {
            return {
                title: "Phase 2: Woche 1–2 (Kritische Phase)",
                tip: "Die meisten Rückfälle passieren in den ersten 14 Tagen. Halte durch! Der schwerste körperliche Teil ist fast geschafft."
            };
        } else if (tage <= 30) {
            return {
                title: "Phase 3: Monat 1 (Stabilisierung)",
                tip: "Entzugssymptome klingen in 3 bis 4 Wochen weitgehend ab. Der körperliche Drang lässt nach, beobachte weiter deine Verhaltensauslöser."
            };
        } else {
            return {
                title: "Phase 4: Monat 2+ (Langzeit-Festigung)",
                tip: "Starke Leistung! Bleibe wachsam bei spontanen Auslösern. Akzeptiere plötzliche Impulse als kurze Wellen, ohne sie zu bekämpfen."
            };
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (match) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return map[match];
        });
    }
});