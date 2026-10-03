/// <reference types="../CTAutocomplete" />
// Score300 - ChatTriggers Modul (CT 2.x, Minecraft 1.8.9) fuer Hypixel SkyBlock Dungeons
//
// - Nachricht + Titel + Sound sobald der (vorhergesagte) Score 300 erreicht
// - Overlay: Zeit, Mimic tot (Ja/Nein), Crypts x/5, aktueller Score

const MODULE = "Score300";
const PREFIX = "&8[&6Score300&8]&r ";

const EntityZombie = Java.type("net.minecraft.entity.monster.EntityZombie");

// ---------------------------------------------------------------------------
// Einstellungen (werden in data.json gespeichert)
// ---------------------------------------------------------------------------
const defaults = {
    enabled: true,      // Overlay anzeigen
    x: 10,
    y: 10,
    scale: 1,
    partyChat: false,   // 300-Score-Nachricht auch in den Party-Chat schicken
    paul: false         // Mayor Paul mit EZPZ-Perk aktiv (+10 Bonus)
};

let settings = Object.assign({}, defaults);
try {
    const raw = FileLib.read(MODULE, "data.json");
    if (raw) settings = Object.assign(settings, JSON.parse(raw));
} catch (e) {
    print(`[${MODULE}] Konnte data.json nicht lesen: ${e}`);
}
const save = () => FileLib.write(MODULE, "data.json", JSON.stringify(settings, null, 4));

// ---------------------------------------------------------------------------
// Run-Status
// ---------------------------------------------------------------------------
let run;
const resetRun = () => {
    run = {
        inDungeon: false,
        floor: null,         // z.B. "F7", "M5", "E"
        startTime: null,     // Fallback-Timer (ms), gesetzt durch Mort
        elapsed: 0,          // Sekunden
        mimicDead: false,
        princeKilled: false,
        bloodDone: false,
        inBoss: false,
        crypts: 0,
        deaths: 0,
        secretsPct: 0,
        completedRooms: 0,
        clearedPct: 0,
        puzzlesTotal: 0,
        puzzlesDone: 0,
        score: 0,
        announced: false,
        scoreTime: null      // Zeit bei der 300 erreicht wurde
    };
};
resetRun();

// Benoetigte Secret-Prozent pro Floor fuer volle Secret-Punkte
const SECRET_REQ = { E: 0.3, F1: 0.3, F2: 0.4, F3: 0.5, F4: 0.6, F5: 0.7, F6: 0.85, F7: 1 };
const MIMIC_FLOORS = ["F6", "F7", "M6", "M7"];

const clean = (s) => ChatLib.removeFormatting(s).replace(/[^\x20-\x7E✔✖✦]/g, "").trim();

const formatTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
};

const parseElapsed = (str) => {
    // "Time Elapsed: 1h 05m 12s" / "05m 12s" / "12s"
    let sec = 0;
    const h = str.match(/(\d+)h/);
    const m = str.match(/(\d+)m/);
    const s = str.match(/(\d+)s/);
    if (h) sec += parseInt(h[1]) * 3600;
    if (m) sec += parseInt(m[1]) * 60;
    if (s) sec += parseInt(s[1]);
    return sec;
};

// ---------------------------------------------------------------------------
// Scoreboard + Tablist auslesen
// ---------------------------------------------------------------------------
const readScoreboard = () => {
    let inDungeon = false;
    let lines = [];
    try {
        lines = Scoreboard.getLines().map(l => clean(l.getName()));
    } catch (e) {
        return false;
    }
    lines.forEach(line => {
        const floor = line.match(/The Catacombs \((\w+)\)/);
        if (floor) {
            inDungeon = true;
            run.floor = floor[1];
        }
        const cleared = line.match(/Cleared: (\d+)%/);
        if (cleared) run.clearedPct = parseInt(cleared[1]);
        if (line.startsWith("Time Elapsed:")) run.elapsed = parseElapsed(line);
    });
    return inDungeon;
};

const readTab = () => {
    let names = [];
    try {
        names = TabList.getNames().map(clean);
    } catch (e) {
        return;
    }
    let puzzlesTotal = 0;
    let puzzlesDone = 0;
    let inPuzzles = false;
    let puzzlesLeft = 0;

    names.forEach(line => {
        let m;
        if ((m = line.match(/^Secrets Found: ([\d.]+)%/))) run.secretsPct = parseFloat(m[1]);
        if ((m = line.match(/^Crypts: (\d+)/))) run.crypts = parseInt(m[1]);
        if ((m = line.match(/Deaths: \(?(\d+)\)?/))) run.deaths = parseInt(m[1]);
        if ((m = line.match(/^Completed Rooms: (\d+)/))) run.completedRooms = parseInt(m[1]);

        if ((m = line.match(/^Puzzles: \((\d+)\)/))) {
            puzzlesTotal = parseInt(m[1]);
            puzzlesLeft = puzzlesTotal;
            inPuzzles = true;
            return;
        }
        if (inPuzzles && puzzlesLeft > 0 && line.length) {
            if (line.includes("✔")) puzzlesDone++; // ✔
            puzzlesLeft--;
            if (puzzlesLeft === 0) inPuzzles = false;
        }
    });
    run.puzzlesTotal = puzzlesTotal;
    run.puzzlesDone = puzzlesDone;
};

// ---------------------------------------------------------------------------
// Score-Berechnung (Vorhersage wie bei Skytils / Dungeon-Score-Mods)
// ---------------------------------------------------------------------------
const calcScore = () => {
    const isMaster = run.floor && run.floor.startsWith("M");
    const totalRooms = run.clearedPct > 0
        ? Math.round(run.completedRooms / (run.clearedPct / 100))
        : 36;
    // Blood-Raum und Boss-Raum zaehlen mit, sobald man in den Boss geht
    const rooms = run.completedRooms + (run.bloodDone ? 0 : 1) + (run.inBoss ? 0 : 1);
    const roomPct = Math.min(1, totalRooms > 0 ? rooms / totalRooms : 0);

    const missingPuzzles = Math.max(0, run.puzzlesTotal - run.puzzlesDone);
    const deathPenalty = run.deaths * 2;

    const skill = 20 + Math.max(0, Math.min(80, Math.floor(80 * roomPct) - 10 * missingPuzzles - deathPenalty));

    const req = isMaster ? 1 : (SECRET_REQ[run.floor] || 1);
    const explore = Math.floor(60 * roomPct) + Math.floor(40 * Math.min(1, (run.secretsPct / 100) / req));

    const speed = 100; // wird in fast allen Runs voll erreicht

    let bonus = Math.min(5, run.crypts);
    if (run.mimicDead) bonus += 2;
    if (run.princeKilled) bonus += 1;
    if (settings.paul) bonus += 10;

    return skill + explore + speed + bonus;
};

const scoreRank = (s) => s >= 300 ? "&6S+" : s >= 270 ? "&eS" : s >= 230 ? "&5A" : s >= 160 ? "&aB" : s >= 100 ? "&9C" : "&cD";

const announce300 = () => {
    run.announced = true;
    run.scoreTime = run.elapsed;
    ChatLib.chat(`${PREFIX}&a&l300 Score erreicht! &7(${formatTime(run.elapsed)})`);
    Client.showTitle("&6&l300 Score!", "&aAb in den Boss!", 5, 50, 10);
    World.playSound("random.orb", 1, 1);
    if (settings.partyChat) ChatLib.command(`pc 300 Score erreicht! (${formatTime(run.elapsed)})`);
};

// ---------------------------------------------------------------------------
// Update-Loop
// ---------------------------------------------------------------------------
register("step", () => {
    if (!World.isLoaded()) return;
    run.inDungeon = readScoreboard();
    if (!run.inDungeon) return;

    readTab();
    if (run.elapsed === 0 && run.startTime) run.elapsed = (Date.now() - run.startTime) / 1000;

    run.score = calcScore();
    if (!run.announced && run.score >= 300) announce300();
}).setFps(4);

// ---------------------------------------------------------------------------
// Chat-Events
// ---------------------------------------------------------------------------
register("chat", (event) => {
    const msg = ChatLib.removeFormatting(ChatLib.getChatMessage(event, true));

    if (msg.includes("Here, I found this map when I first entered the dungeon.")) {
        run.startTime = Date.now();
        return;
    }
    if (msg === "[BOSS] The Watcher: You have proven yourself. You may pass.") {
        run.bloodDone = true;
        return;
    }
    if (msg.startsWith("[BOSS] ") && !msg.startsWith("[BOSS] The Watcher")) {
        run.inBoss = true;
        run.bloodDone = true;
        return;
    }
    if (msg.includes("A Prince falls. +1 Bonus Score")) {
        run.princeKilled = true;
        return;
    }
    // Andere Mods (Skytils, Odin, ...) melden den Mimic im Party-Chat
    if (msg.startsWith("Party > ") && /mimic (dead|killed)|\$SKYTILS-DUNGEON-SCORE-MIMIC\$/i.test(msg)) {
        run.mimicDead = true;
    }
});

// Mimic = Baby-Zombie ohne Ruestung
register("entityDeath", (entity) => {
    if (!run.inDungeon || run.mimicDead) return;
    const mc = entity.getEntity();
    if (!(mc instanceof EntityZombie) || !mc.func_70631_g_()) return; // isChild()
    for (let i = 0; i < 4; i++) {
        if (mc.func_82169_q(i) !== null) return; // getCurrentArmor(i)
    }
    run.mimicDead = true;
    ChatLib.chat(`${PREFIX}&aMimic getoetet!`);
    if (settings.partyChat) ChatLib.command("pc Mimic Killed!");
});

register("worldLoad", resetRun);

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------
const moveGui = new Gui();

const overlayLines = () => {
    const hasMimic = MIMIC_FLOORS.includes(run.floor);
    const mimic = run.mimicDead ? "&aJa" : (hasMimic ? "&cNein" : "&7Nein");
    const crypts = run.crypts >= 5 ? `&a${run.crypts}/5` : `&c${run.crypts}/5`;
    const scoreCol = run.score >= 300 ? "&a" : run.score >= 270 ? "&e" : "&c";
    const lines = [
        `&6&lDungeon &7${run.floor || ""}`,
        `&7Zeit: &f${formatTime(run.elapsed)}`,
        `&7Mimic: ${mimic}`,
        `&7Crypts: ${crypts}`,
        `&7Score: ${scoreCol}${run.score} ${scoreRank(run.score)}`
    ];
    if (run.scoreTime !== null) lines.push(`&7300 bei: &a${formatTime(run.scoreTime)}`);
    return lines;
};

const drawOverlay = (lines) => {
    const width = Math.max.apply(null, lines.map(l => Renderer.getStringWidth(ChatLib.addColor(l)))) + 6;
    const height = lines.length * 10 + 4;

    Renderer.retainTransforms(true);
    Renderer.translate(settings.x, settings.y);
    Renderer.scale(settings.scale, settings.scale);
    Renderer.drawRect(Renderer.color(0, 0, 0, 120), 0, 0, width, height);
    lines.forEach((l, i) => Renderer.drawStringWithShadow(ChatLib.addColor(l), 3, 3 + i * 10));
    Renderer.retainTransforms(false);
    Renderer.finishDraw();
};

register("renderOverlay", () => {
    if (moveGui.isOpen()) {
        drawOverlay(["&6&lDungeon &7F7", "&7Zeit: &f05:12", "&7Mimic: &aJa", "&7Crypts: &a5/5", "&7Score: &a300 &6S+"]);
        Renderer.drawStringWithShadow(
            ChatLib.addColor("&eZiehen zum Verschieben, Mausrad = Groesse, ESC = Fertig"),
            Renderer.screen.getWidth() / 2 - 130, Renderer.screen.getHeight() - 20
        );
        return;
    }
    if (!settings.enabled || !run.inDungeon) return;
    drawOverlay(overlayLines());
});

register("dragged", (dx, dy) => {
    if (!moveGui.isOpen()) return;
    settings.x += dx;
    settings.y += dy;
});

register("scrolled", (x, y, dir) => {
    if (!moveGui.isOpen()) return;
    settings.scale = Math.max(0.5, Math.min(3, settings.scale + (dir > 0 ? 0.1 : -0.1)));
});

moveGui.registerClosed(save);

// ---------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------
const onOff = (b) => b ? "&aAN" : "&cAUS";

register("command", (arg) => {
    switch ((arg || "").toLowerCase()) {
        case "move":
            moveGui.open();
            break;
        case "toggle":
            settings.enabled = !settings.enabled;
            save();
            ChatLib.chat(`${PREFIX}&7Overlay: ${onOff(settings.enabled)}`);
            break;
        case "pc":
            settings.partyChat = !settings.partyChat;
            save();
            ChatLib.chat(`${PREFIX}&7Party-Chat Nachricht: ${onOff(settings.partyChat)}`);
            break;
        case "paul":
            settings.paul = !settings.paul;
            save();
            ChatLib.chat(`${PREFIX}&7Paul EZPZ (+10): ${onOff(settings.paul)}`);
            break;
        case "mimic":
            run.mimicDead = !run.mimicDead;
            ChatLib.chat(`${PREFIX}&7Mimic manuell gesetzt: ${run.mimicDead ? "&aJa" : "&cNein"}`);
            break;
        case "reset":
            resetRun();
            ChatLib.chat(`${PREFIX}&7Run zurueckgesetzt.`);
            break;
        case "test":
            announce300();
            run.announced = false;
            break;
        default:
            ChatLib.chat(`${PREFIX}&6Befehle:`);
            ChatLib.chat("&e/score300 move &7- Overlay verschieben / skalieren");
            ChatLib.chat(`&e/score300 toggle &7- Overlay an/aus (${onOff(settings.enabled)}&7)`);
            ChatLib.chat(`&e/score300 pc &7- 300-Nachricht in Party-Chat (${onOff(settings.partyChat)}&7)`);
            ChatLib.chat(`&e/score300 paul &7- Paul EZPZ +10 Bonus (${onOff(settings.paul)}&7)`);
            ChatLib.chat("&e/score300 mimic &7- Mimic manuell umschalten");
            ChatLib.chat("&e/score300 reset &7- Run zuruecksetzen");
            ChatLib.chat("&e/score300 test &7- 300-Nachricht testen");
    }
}).setName("score300");
